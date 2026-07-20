// Deterministic mock Paseo data for UX-first development. Timestamps are relative to
// load time so recency labels look natural. Replaced by the daemon-wired repository
// in M2-S05.

import type {
  AgentSession,
  Attention,
  HostSnapshot,
  PermissionRequest,
  Project,
  TimelineEvent,
  Workspace,
} from "../domain/types";

const now = Date.now();
const min = 60 * 1000;

export const projects: Project[] = [
  { id: "p1", name: "Mobile app" },
  { id: "p2", name: "Billing service" },
];

export const workspaces: Workspace[] = [
  { id: "w1", projectId: "p1", name: "mobile-app", status: "attention" },
  { id: "w2", projectId: "p2", name: "billing-api", status: "active" },
  { id: "w3", projectId: "p1", name: "design-system", status: "idle" },
];

export const agents: AgentSession[] = [
  { id: "a1", workspaceId: "w1", title: "Release auth fix", provider: "anthropic", model: "claude", lifecycle: "waiting", lastActivityAt: now - 2 * min },
  { id: "a2", workspaceId: "w1", title: "Refactor navigation", provider: "openai", model: "gpt", lifecycle: "error", lastActivityAt: now - 9 * min },
  { id: "a1s", workspaceId: "w1", title: "Write migration", provider: "anthropic", model: "claude", lifecycle: "running", parentAgentId: "a1", native: true, lastActivityAt: now - 1 * min },
  { id: "a3", workspaceId: "w2", title: "Add retry policy", provider: "anthropic", model: "claude", lifecycle: "done", lastActivityAt: now - 26 * min },
  { id: "a4", workspaceId: "w3", title: "Token audit", provider: "openai", model: "gpt", lifecycle: "idle", lastActivityAt: now - 3 * 60 * min },
];

export const attention: Attention[] = [
  { id: "at1", agentId: "a1", workspaceId: "w1", reason: "permission", summary: "Allow write to auth/config.ts", createdAt: now - 2 * min, freshness: "live" },
  { id: "at2", agentId: "a2", workspaceId: "w1", reason: "error", summary: "Type error blocked the turn", createdAt: now - 9 * min, freshness: "live" },
  { id: "at3", agentId: "a3", workspaceId: "w2", reason: "finished", summary: "Finished: added retry with backoff", createdAt: now - 26 * min, freshness: "stale" },
];

export const timelines: Record<string, TimelineEvent[]> = {
  a1: [
    { id: "e1", agentId: "a1", at: now - 6 * min, kind: "message", text: "Fix the auth token refresh race." },
    { id: "e2", agentId: "a1", at: now - 5 * min, kind: "tool", text: "Edited auth/refresh.ts (+18 −4)", truncated: true },
    { id: "e3", agentId: "a1", at: now - 2 * min, kind: "permission", text: "Requesting permission to write auth/config.ts" },
  ],
  a2: [
    { id: "e4", agentId: "a2", at: now - 12 * min, kind: "message", text: "Split the router into stack + tabs." },
    { id: "e5", agentId: "a2", at: now - 9 * min, kind: "error", text: "TS2345: navigation param type mismatch" },
  ],
  a3: [
    { id: "e6", agentId: "a3", at: now - 30 * min, kind: "message", text: "Add exponential backoff to the billing client." },
    { id: "e7", agentId: "a3", at: now - 26 * min, kind: "finished", text: "Finished: retry with jittered backoff, 3 attempts." },
  ],
};

export const permissions: PermissionRequest[] = [
  { id: "at1", agentId: "a1", title: "Write auth/config.ts", detail: "The Agent wants to modify auth/config.ts to persist the refreshed token TTL.", createdAt: now - 2 * min },
];

export const hostSnapshot: HostSnapshot = {
  hostName: "workstation",
  freshness: "live",
  auth: "active",
  lastSyncedAt: now - 20 * 1000,
};
