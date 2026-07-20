// The data boundary the UI depends on. MVP ships a deterministic mock; M2-S05 wires
// the same interface to the daemon over the Relay contract, so screens never change.

import type {
  AgentSession,
  Attention,
  HostSnapshot,
  PermissionRequest,
  TimelineEvent,
  Workspace,
} from "../domain/types";
import * as mock from "./mock";

export interface PaseoRepository {
  getHostSnapshot(): Promise<HostSnapshot>;
  listAttention(): Promise<Attention[]>;
  listWorkspaces(): Promise<Workspace[]>;
  listAgents(workspaceId?: string): Promise<AgentSession[]>;
  getAgent(agentId: string): Promise<AgentSession | null>;
  listSubagents(parentAgentId: string): Promise<AgentSession[]>;
  getTimeline(agentId: string): Promise<TimelineEvent[]>;
  getPermission(permissionId: string): Promise<PermissionRequest | null>;
  /** Send a reviewed Follow-up to an Agent. No-op in the mock repository. */
  sendFollowup(agentId: string, text: string): Promise<void>;
}

/** Simulated latency so freshness/loading states are exercised realistically. */
function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function createMockRepository(): PaseoRepository {
  return {
    getHostSnapshot: () => delay(mock.hostSnapshot),
    listAttention: () => delay(mock.attention.slice()),
    listWorkspaces: () => delay(mock.workspaces.slice()),
    listAgents: (workspaceId) =>
      delay(mock.agents.filter((a) => !workspaceId || a.workspaceId === workspaceId)),
    getAgent: (agentId) => delay(mock.agents.find((a) => a.id === agentId) ?? null),
    listSubagents: (parentAgentId) =>
      delay(mock.agents.filter((a) => a.parentAgentId === parentAgentId)),
    getTimeline: (agentId) => delay(mock.timelines[agentId] ?? []),
    getPermission: (permissionId) =>
      delay(mock.permissions.find((p) => p.id === permissionId) ?? null),
    sendFollowup: async () => {
      // Demo mode never sends.
    },
  };
}
