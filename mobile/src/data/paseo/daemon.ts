// Real Paseo data via the official SDK (@getpaseo/client). Parses the pairing offer,
// connects over the relay with E2EE, and maps daemon payloads to our domain types.
// Attention is derived from agents whose snapshot has requiresAttention.

import { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { parseConnectionOfferFromUrl } from "@getpaseo/protocol/connection-offer";
import { buildRelayWebSocketUrl } from "@getpaseo/protocol/daemon-endpoints";
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

function mapWorkspace(workspace: WorkspaceDescriptorPayload, agents: AgentSnapshotPayload[]): Workspace {
  const own = agents.filter((a) => a.workspaceId === workspace.id);
  const status: WorkspaceStatus = own.some((a) => a.requiresAttention)
    ? "attention"
    : own.some((a) => mapLifecycle(String(a.status)) === "running")
      ? "active"
      : "idle";
  return {
    id: workspace.id,
    projectId: workspace.projectId,
    name: workspace.name,
    status,
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

function mapTimeline(agentId: string, payload: unknown): TimelineEvent[] {
  // The daemon timeline is a rich union; extract a text + kind defensively for the MVP.
  const items = (payload as { items?: unknown[]; entries?: unknown[] })?.items
    ?? (payload as { entries?: unknown[] })?.entries
    ?? [];
  const kinds: TimelineKind[] = ["message", "tool", "error", "finished", "permission"];
  return (items as Record<string, unknown>[]).map((raw, index) => {
    const kindRaw = String(raw.kind ?? raw.type ?? "message");
    const kind: TimelineKind = kinds.includes(kindRaw as TimelineKind)
      ? (kindRaw as TimelineKind)
      : kindRaw.includes("error")
        ? "error"
        : kindRaw.includes("tool")
          ? "tool"
          : "message";
    const text = String(raw.text ?? raw.summary ?? raw.message ?? "");
    return {
      id: String(raw.id ?? `${agentId}-${index}`),
      agentId,
      at: toMs((raw.at ?? raw.createdAt ?? raw.timestamp) as string | undefined),
      kind,
      text,
    };
  });
}

export interface DaemonConnection {
  repository: PaseoRepository;
  hostName: string;
  close(): void;
}

export async function connectDaemonRepository(
  pairUrl: string,
  options: { clientId: string; appVersion?: string; connectTimeoutMs?: number } = { clientId: "paseo-mobile" },
): Promise<DaemonConnection> {
  const offer = parseConnectionOfferFromUrl(pairUrl);
  if (!offer) throw new Error("Not a Paseo pairing offer URL (missing #offer=)");

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
    e2ee: { enabled: true, daemonPublicKeyB64: offer.daemonPublicKeyB64 },
    ...(options.connectTimeoutMs ? { connectTimeoutMs: options.connectTimeoutMs } : {}),
  });

  await client.connect();

  async function agents(): Promise<AgentSnapshotPayload[]> {
    const payload = await client.fetchAgents();
    return payload.entries.map((entry) => entry.agent);
  }

  const repository: PaseoRepository = {
    getHostSnapshot: async (): Promise<HostSnapshot> => ({
      hostName: offer.serverId,
      freshness: "live",
      auth: "active",
      lastSyncedAt: Date.now(),
    }),
    listAttention: async () => (await agents()).filter((a) => a.requiresAttention).map(mapAttention),
    listWorkspaces: async () => {
      const [workspaces, agentList] = await Promise.all([client.fetchWorkspaces(), agents()]);
      return workspaces.entries.map((w) => mapWorkspace(w, agentList));
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
    getTimeline: async (agentId) => mapTimeline(agentId, await client.fetchAgentTimeline(agentId)),
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
  };

  return { repository, hostName: offer.serverId, close: () => void client.close() };
}
