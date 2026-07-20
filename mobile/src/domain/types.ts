// Paseo domain types for the mobile companion, narrowed from CONTEXT.md. Pure types
// only — no React Native imports — so the domain/selectors layer is unit-testable
// with plain Node.

/** Whether the current projection is stale, syncing, or live after reconciliation. */
export type Freshness = "live" | "syncing" | "stale";

/** Device authorization for the bound Host. */
export type AuthState = "unauthorized" | "active" | "auth-required";

/** Literal execution state of one Agent session. */
export type AgentLifecycle = "running" | "waiting" | "idle" | "error" | "done";

/** Aggregate priority state of work within one Workspace. */
export type WorkspaceStatus = "attention" | "active" | "idle";

/** Server-backed reason an Agent session needs review. */
export type AttentionReason = "permission" | "error" | "finished";

export interface Project {
  readonly id: string;
  readonly name: string;
}

export interface Workspace {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly status: WorkspaceStatus;
}

export interface AgentSession {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly provider: string;
  readonly model: string;
  readonly lifecycle: AgentLifecycle;
  /** Parent Agent for a Subagent; null/undefined for a root Agent. */
  readonly parentAgentId?: string | null;
  /** Provider-managed Subagent, exposed read-only. */
  readonly native?: boolean;
  readonly lastActivityAt: number;
}

export interface Attention {
  readonly id: string;
  readonly agentId: string;
  readonly workspaceId: string;
  readonly reason: AttentionReason;
  readonly summary: string;
  readonly createdAt: number;
  readonly freshness: Freshness;
}

export type TimelineKind = "message" | "tool" | "error" | "finished" | "permission";

export interface TimelineEvent {
  readonly id: string;
  readonly agentId: string;
  readonly at: number;
  readonly kind: TimelineKind;
  readonly text: string;
  readonly truncated?: boolean;
}

export interface PermissionRequest {
  readonly id: string;
  readonly agentId: string;
  readonly title: string;
  readonly detail: string;
  readonly createdAt: number;
}

/** One unsent Follow-up bound to a specific Host/Workspace/Agent. */
export interface Draft {
  readonly agentId: string;
  readonly text: string;
}

/** Overall connection snapshot the UI can trust. */
export interface HostSnapshot {
  readonly hostName: string;
  readonly freshness: Freshness;
  readonly auth: AuthState;
  readonly lastSyncedAt: number;
}
