// Real Paseo data via the official SDK (@getpaseo/client). Parses the pairing offer,
// connects over the relay with E2EE, and maps daemon payloads to our domain types.
// Attention is derived from agents whose snapshot has requiresAttention.

import { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import type {
  ConnectionState,
  FetchAgentTimelinePayload,
} from "@getpaseo/client/internal/daemon-client";
import { parseConnectionOfferFromUrl } from "@getpaseo/protocol/connection-offer";
import { buildRelayWebSocketUrl } from "@getpaseo/protocol/daemon-endpoints";
import type { ToolCallTimelineItem } from "@getpaseo/protocol/agent-types";
import type {
  AgentSnapshotPayload,
  WorkspaceDescriptorPayload,
} from "@getpaseo/protocol/messages";

import type { PaseoRepository } from "../repository";
import type {
  AgentLifecycle,
  AgentSession,
  Attention,
  AttentionReason,
  HostSnapshot,
  PermissionRequest,
  TimelineEvent,
  TimelineKind,
  Workspace,
  WorkspaceStatus,
} from "../../domain/types";

function toMs(iso: string | null | undefined): number {
  if (!iso) return Date.now();
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function mapLifecycle(status: string): AgentLifecycle {
  switch (status) {
    case "running":
      return "running";
    case "initializing":
      return "waiting";
    case "error":
      return "error";
    case "closed":
      return "done";
    case "idle":
    default:
      return "idle";
  }
}

function mapAgent(agent: AgentSnapshotPayload): AgentSession {
  return {
    id: agent.id,
    workspaceId: agent.workspaceId ?? "",
    title: agent.title ?? "Untitled agent",
    provider: String(agent.provider),
    model: agent.model ?? "",
    lifecycle: mapLifecycle(String(agent.status)),
    lastActivityAt: toMs(agent.updatedAt),
  };
}

function basename(pathValue: string): string {
  const parts = String(pathValue).split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? pathValue;
}

function workspaceStatusFrom(agentList: AgentSnapshotPayload[]): WorkspaceStatus {
  if (agentList.some((a) => a.requiresAttention)) return "attention";
  if (agentList.some((a) => mapLifecycle(String(a.status)) === "running")) return "active";
  return "idle";
}

// Older/agent-by-cwd daemons expose agents but no workspace registry rows. Synthesize
// one workspace per distinct agent workspaceId (matching the official app's legacy
// shim) so the Workspaces view is never empty when agents exist.
function synthesizeWorkspaces(agentList: AgentSnapshotPayload[]): Workspace[] {
  const byId = new Map<string, AgentSnapshotPayload[]>();
  for (const agent of agentList) {
    const id = agent.workspaceId ?? "";
    const group = byId.get(id);
    if (group) group.push(agent);
    else byId.set(id, [agent]);
  }
  return [...byId.entries()].map(([id, list]) => ({
    id,
    projectId: "",
    name: list[0]?.cwd ? basename(list[0].cwd) : id || "workspace",
    status: workspaceStatusFrom(list),
  }));
}

function mapWorkspace(workspace: WorkspaceDescriptorPayload, agentList: AgentSnapshotPayload[]): Workspace {
  const own = agentList.filter((a) => a.workspaceId === workspace.id);
  return {
    id: workspace.id,
    projectId: workspace.projectId,
    name: workspace.name,
    status: workspaceStatusFrom(own),
  };
}

function mapAttention(agent: AgentSnapshotPayload): Attention {
  const reason = (agent.attentionReason ?? "finished") as AttentionReason;
  return {
    id: agent.id,
    agentId: agent.id,
    workspaceId: agent.workspaceId ?? "",
    reason,
    summary: agent.title ?? (agent.lastError ? String(agent.lastError) : "Needs review"),
    createdAt: toMs(agent.attentionTimestamp ?? agent.updatedAt),
    freshness: "live",
  };
}

function mapFreshness(state: ConnectionState): "live" | "syncing" | "stale" {
  switch (state.status) {
    case "connected":
      return "live";
    case "connecting":
      return "syncing";
    default:
      return "stale";
  }
}

function truncate(value: string, max = 1200): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}\n…` : trimmed;
}

/** One-line title + expandable detail for a tool call, per ToolCallDetail variant. */
function describeTool(item: ToolCallTimelineItem): { title: string; detail?: string } {
  const d = item.detail;
  const detail = (value: string): string | undefined => truncate(value) || undefined;
  switch (d.type) {
    case "shell":
      return {
        title: d.command,
        detail: detail([`$ ${d.command}`, d.output ?? "", d.exitCode != null ? `[exit ${d.exitCode}]` : ""].filter(Boolean).join("\n\n")),
      };
    case "read":
      return { title: `read ${d.filePath}`, detail: d.content ? detail(d.content) : undefined };
    case "edit":
      return {
        title: `edit ${d.filePath}`,
        detail: detail(d.unifiedDiff ?? [d.oldString ? `- ${d.oldString}` : "", d.newString ? `+ ${d.newString}` : ""].filter(Boolean).join("\n")),
      };
    case "write":
      return { title: `write ${d.filePath}`, detail: d.content ? detail(d.content) : undefined };
    case "search":
      return {
        title: `search ${d.query}`,
        detail: detail([
          d.numMatches != null ? `${d.numMatches} matches` : "",
          d.numFiles != null ? `${d.numFiles} files` : "",
          ...(d.filePaths ?? []),
          ...(d.webResults ?? []).map((w) => `${w.title} — ${w.url}`),
        ].filter(Boolean).join("\n")),
      };
    case "fetch":
      return { title: `fetch ${d.url}`, detail: detail([d.url, d.result ?? ""].filter(Boolean).join("\n\n")) };
    case "worktree_setup":
      return { title: `worktree ${d.branchName}`, detail: detail(d.log) };
    case "sub_agent":
      return { title: `subagent ${d.subAgentType ?? ""}`.trim(), detail: detail([d.description ?? "", d.log].filter(Boolean).join("\n\n")) };
    case "plan":
      return { title: "plan", detail: detail(d.text) };
    case "plain_text":
      return { title: d.label ?? item.name, detail: d.text ? detail(d.text) : undefined };
    default:
      return { title: item.name };
  }
}

function mapTimeline(agentId: string, payload: FetchAgentTimelinePayload): TimelineEvent[] {
  return payload.entries.map((entry, index) => {
    const item = entry.item;
    let kind: TimelineKind = "message";
    let text = "";
    let detail: string | undefined;
    switch (item.type) {
      case "user_message":
        kind = "user";
        text = item.text;
        break;
      case "assistant_message":
        kind = "assistant";
        text = item.text;
        break;
      case "reasoning":
        kind = "reasoning";
        text = item.text;
        break;
      case "tool_call": {
        kind = item.status === "failed" ? "error" : "tool";
        const described = describeTool(item);
        text = item.status && item.status !== "completed" ? `${described.title} · ${item.status}` : described.title;
        detail = described.detail;
        break;
      }
      case "todo":
        kind = "todo";
        text = item.items.map((t) => `${t.completed ? "✓" : "○"} ${t.text}`).join("\n");
        break;
      case "error":
        kind = "error";
        text = item.message;
        break;
      case "compaction":
        kind = "reasoning";
        text = "Compacted earlier context";
        break;
      default:
        break;
    }
    return { id: `${agentId}-${entry.seqStart}-${index}`, agentId, at: toMs(entry.timestamp), kind, text, detail };
  });
}

export interface DaemonConnection {
  repository: PaseoRepository;
  hostName: string;
  close(): void;
}

// Strip anything credential-like from a message before it can reach the UI or logs:
// URLs, #offer fragments, and long base64/token-looking strings (keys, secrets).
export function redactSecrets(message: string): string {
  return String(message)
    .replace(/#offer=\S+/gi, "#offer=<redacted>")
    .replace(/(wss?|https?):\/\/\S+/gi, "<url>")
    .replace(/[A-Za-z0-9+/_-]{40,}={0,2}/g, "<token>");
}

// The SDK may otherwise log connection URLs/frames; keep it silent so the offer and
// derived connection details never hit the console/Metro logs.
const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

function connectErrorMessage(error: unknown): string {
  const raw = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (raw.includes("timeout") || raw.includes("timed out")) return "Connection timed out — check the host is reachable.";
  if (raw.includes("refused") || raw.includes("econnrefused")) return "Connection refused by the relay.";
  if (raw.includes("closed")) return "The relay closed the connection.";
  if (raw.includes("unauthor") || raw.includes("forbidden")) return "The host rejected this device.";
  return "Could not connect to the Paseo host.";
}

export async function connectDaemonRepository(
  pairUrl: string,
  options: {
    clientId: string;
    appVersion?: string;
    connectTimeoutMs?: number;
    onStatusChange?: () => void;
  } = { clientId: "paseo-mobile" },
): Promise<DaemonConnection> {
  let offer;
  try {
    offer = parseConnectionOfferFromUrl(pairUrl);
  } catch {
    // Never surface the raw parse error — it can echo offer field values.
    throw new Error("Invalid pairing offer.");
  }
  if (!offer) throw new Error("Not a Paseo pairing offer URL (needs an #offer= link).");

  const url = buildRelayWebSocketUrl({
    endpoint: offer.relay.endpoint,
    useTls: offer.relay.useTls ?? true,
    serverId: offer.serverId,
    role: "client",
  });

  const client = new DaemonClient({
    url,
    clientId: options.clientId,
    clientType: "mobile",
    appVersion: options.appVersion,
    suppressSendErrors: true,
    logger: noopLogger,
    e2ee: { enabled: true, daemonPublicKeyB64: offer.daemonPublicKeyB64 },
    ...(options.connectTimeoutMs ? { connectTimeoutMs: options.connectTimeoutMs } : {}),
  });

  try {
    await client.connect();
  } catch (error) {
    console.log(`[paseo] connect error: ${redactSecrets(error instanceof Error ? error.message : String(error))}`);
    try {
      void client.close();
    } catch {
      // ignore
    }
    throw new Error(connectErrorMessage(error));
  }

  // Dedupe the several agent fetches a single screen load triggers (attention +
  // workspaces + agents) into one request within a short window.
  let agentsCache: { at: number; value: Promise<AgentSnapshotPayload[]> } | null = null;
  function agents(): Promise<AgentSnapshotPayload[]> {
    const now = Date.now();
    if (agentsCache && now - agentsCache.at < 1500) return agentsCache.value;
    const value = client
      .fetchAgents({ page: { limit: 200 }, sort: [{ key: "updated_at", direction: "desc" }] })
      .then((payload) => payload.entries.map((entry) => entry.agent))
      .catch((error) => {
        agentsCache = null;
        console.log(`[paseo] fetchAgents error: ${redactSecrets(error instanceof Error ? error.message : String(error))}`);
        return [] as AgentSnapshotPayload[];
      });
    agentsCache = { at: now, value };
    return value;
  }

  const unsubscribeStatus = client.subscribeConnectionStatus(() => options.onStatusChange?.());

  const repository: PaseoRepository = {
    getHostSnapshot: async (): Promise<HostSnapshot> => ({
      hostName: offer.serverId,
      freshness: mapFreshness(client.getConnectionState()),
      auth: "active",
      lastSyncedAt: Date.now(),
    }),
    listAttention: async () => (await agents()).filter((a) => a.requiresAttention).map(mapAttention),
    listWorkspaces: async () => {
      const [workspacesPayload, agentList] = await Promise.all([
        client.fetchWorkspaces({ page: { limit: 200 } }).catch(() => null),
        agents(),
      ]);
      const daemonWorkspaces = workspacesPayload?.entries ?? [];
      if (daemonWorkspaces.length > 0) {
        return daemonWorkspaces.map((w) => mapWorkspace(w, agentList));
      }
      return synthesizeWorkspaces(agentList);
    },
    listAgents: async (workspaceId) => {
      const list = await agents();
      return list.filter((a) => !workspaceId || a.workspaceId === workspaceId).map(mapAgent);
    },
    getAgent: async (agentId) => {
      const found = (await agents()).find((a) => a.id === agentId);
      return found ? mapAgent(found) : null;
    },
    listSubagents: async () => [],
    getTimeline: async (agentId) =>
      mapTimeline(agentId, await client.fetchAgentTimeline(agentId, { limit: 100, direction: "tail", projection: "canonical" })),
    getPermission: async (permissionId) => {
      const agent = (await agents()).find((a) => a.id === permissionId || a.pendingPermissions?.some((p) => p.id === permissionId));
      if (!agent) return null;
      const permission = agent.pendingPermissions?.find((p) => p.id === permissionId) ?? agent.pendingPermissions?.[0];
      const request: PermissionRequest = {
        id: permissionId,
        agentId: agent.id,
        title: permission?.title ?? permission?.name ?? "Permission request",
        detail: permission?.description ?? "The agent is requesting permission. Continue in Paseo to resolve it.",
        createdAt: toMs(agent.attentionTimestamp ?? agent.updatedAt),
      };
      return request;
    },
    sendFollowup: async (agentId, text) => {
      await client.sendAgentMessage(agentId, text);
      agentsCache = null;
    },
  };

  return {
    repository,
    hostName: offer.serverId,
    close: () => {
      unsubscribeStatus();
      void client.close();
    },
  };
}
