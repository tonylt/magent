// Daemon-backed PaseoRepository. The transport moves opaque frames; a PaseoProtocol
// codec translates the real wire format to/from domain events. The repository keeps an
// in-memory projection updated by decoded events and answers queries from it.
//
// Only `PaseoProtocol` needs the real daemon/relay format (handshake messages + frame
// decoding). Everything else — connection, projection, freshness, query mapping — is
// implemented and unit-tested here with fakes, so wiring the real codec (M2-S05
// finalization) is isolated and low-risk.

import type { PaseoRepository } from "../repository";
import type { RelayTransport } from "./transport";
import type { PairInfo } from "./pairUrl";
import type {
  AgentSession,
  Attention,
  HostSnapshot,
  PermissionRequest,
  TimelineEvent,
  Workspace,
} from "../../domain/types";

/** Decoded domain updates the projection applies. */
export type PaseoEvent =
  | { readonly type: "host"; readonly host: HostSnapshot }
  | { readonly type: "workspaces"; readonly workspaces: readonly Workspace[] }
  | { readonly type: "agents"; readonly agents: readonly AgentSession[] }
  | { readonly type: "attention"; readonly attention: readonly Attention[] }
  | { readonly type: "timeline"; readonly agentId: string; readonly events: readonly TimelineEvent[] }
  | { readonly type: "permission"; readonly permission: PermissionRequest };

/** The seam that carries the real Paseo wire format. Fill with the daemon's protocol. */
export interface PaseoProtocol {
  /** Messages to send once the transport opens (e.g. hello, auth, subscribe). */
  handshake(pair: PairInfo): readonly unknown[];
  /** Translate one inbound frame to a domain event, or null to ignore it. */
  decode(frame: unknown): PaseoEvent | null;
}

interface Projection {
  host: HostSnapshot | null;
  workspaces: Workspace[];
  agents: AgentSession[];
  attention: Attention[];
  timelines: Map<string, TimelineEvent[]>;
  permissions: Map<string, PermissionRequest>;
}

export interface DaemonRepository extends PaseoRepository {
  /** Resolves after the first decoded event (initial sync), or rejects on close/timeout. */
  ready(): Promise<void>;
  close(): void;
}

export function createDaemonRepository({
  transport,
  pair,
  protocol,
  readyTimeoutMs = 8000,
}: {
  transport: RelayTransport;
  pair: PairInfo;
  protocol: PaseoProtocol;
  readyTimeoutMs?: number;
}): DaemonRepository {
  const projection: Projection = {
    host: null,
    workspaces: [],
    agents: [],
    attention: [],
    timelines: new Map(),
    permissions: new Map(),
  };

  let firstEvent = false;
  let closed = false;
  let resolveReady: (() => void) | null = null;
  let rejectReady: ((reason: Error) => void) | null = null;
  const readyPromise = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const readyTimer = setTimeout(() => {
    if (!firstEvent) rejectReady?.(new Error("Paseo daemon sync timed out"));
  }, readyTimeoutMs);

  function apply(event: PaseoEvent): void {
    switch (event.type) {
      case "host":
        projection.host = event.host;
        break;
      case "workspaces":
        projection.workspaces = [...event.workspaces];
        break;
      case "agents":
        projection.agents = [...event.agents];
        break;
      case "attention":
        projection.attention = [...event.attention];
        break;
      case "timeline":
        projection.timelines.set(event.agentId, [...event.events]);
        break;
      case "permission":
        projection.permissions.set(event.permission.id, event.permission);
        break;
      default:
        break;
    }
    if (!firstEvent) {
      firstEvent = true;
      clearTimeout(readyTimer);
      resolveReady?.();
    }
  }

  const unsubscribeMessage = transport.onMessage((frame) => {
    if (closed) return;
    const event = protocol.decode(frame);
    if (event) apply(event);
  });
  const unsubscribeStatus = transport.onStatus((status) => {
    if (status === "open") {
      for (const message of protocol.handshake(pair)) transport.send(message);
    } else if (status === "closed" && !firstEvent) {
      rejectReady?.(new Error("Relay closed before initial sync"));
    }
  });

  async function ready(): Promise<void> {
    return readyPromise;
  }

  return {
    ready,
    getHostSnapshot: async () => projection.host ?? {
      hostName: pair.hostId ?? "host",
      freshness: "syncing",
      auth: "active",
      lastSyncedAt: Date.now(),
    },
    listAttention: async () => projection.attention.slice(),
    listWorkspaces: async () => projection.workspaces.slice(),
    listAgents: async (workspaceId) =>
      projection.agents.filter((a) => !workspaceId || a.workspaceId === workspaceId),
    getAgent: async (agentId) => projection.agents.find((a) => a.id === agentId) ?? null,
    listSubagents: async (parentAgentId) =>
      projection.agents.filter((a) => a.parentAgentId === parentAgentId),
    getTimeline: async (agentId) => (projection.timelines.get(agentId) ?? []).slice(),
    getPermission: async (permissionId) => projection.permissions.get(permissionId) ?? null,
    close() {
      if (closed) return;
      closed = true;
      clearTimeout(readyTimer);
      unsubscribeMessage();
      unsubscribeStatus();
      transport.close();
    },
  };
}
