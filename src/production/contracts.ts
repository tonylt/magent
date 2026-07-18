export type Support = "available" | "missing" | "unknown";
export type PlatformKind = "browser" | "rabbit";
export type LifecycleState = "foreground" | "background";

export interface CapabilitySnapshot {
  readonly platform: PlatformKind;
  readonly lifecycle: LifecycleState;
  readonly viewport: Readonly<{
    width: number;
    height: number;
    orientation: "portrait" | "landscape" | "unknown";
  }>;
  readonly firmware: Readonly<{
    id?: string;
    status: "tested" | "unknown" | "unsupported";
  }>;
  readonly features: Readonly<{
    semanticInput: Support;
    voice: Support;
    secureStorage: Support;
    deviceLock: Support;
    https: Support;
    wss: Support;
    crypto: Support;
    identity: Support;
    dataIntegrity: Support;
  }>;
}

export type InputSource = "rabbit" | "keyboard" | "touch" | "fixture";

export type SemanticCommand =
  | Readonly<{ type: "previous" | "next" | "activate" | "back" | "hold-start" | "hold-end" }>
  | Readonly<{ type: "focus-at"; index: number }>;

export type VoiceError =
  | "unsupported"
  | "busy"
  | "not-active"
  | "bridge-error"
  | "empty-transcript"
  | "interrupted";

export type VoiceResult =
  | Readonly<{ type: "transcript"; text: string }>
  | Readonly<{ type: "error"; code: VoiceError }>;

export type PlatformEvent =
  | Readonly<{
      type: "command";
      command: SemanticCommand;
      source: InputSource;
      sequence: number;
    }>
  | Readonly<{
      type: "lifecycle";
      state: LifecycleState;
      cause: "visibility" | "pagehide" | "pageshow" | "suspend" | "resume";
      sequence: number;
    }>
  | Readonly<{
      type: "voice-result";
      requestId: string;
      result: VoiceResult;
      sequence: number;
    }>;

export type VoiceActionResult =
  | Readonly<{ ok: true; requestId: string }>
  | Readonly<{ ok: false; error: VoiceError }>;

export interface PlatformAdapter {
  readonly kind: PlatformKind;
  inspectCapabilities(): Promise<CapabilitySnapshot>;
  subscribe(listener: (event: PlatformEvent) => void): () => void;
  startVoice(requestId: string): Promise<VoiceActionResult>;
  stopVoice(requestId: string): Promise<VoiceActionResult>;
  cancelVoice(requestId: string, reason: "background" | "user" | "timeout"): Promise<void>;
  dispose(): void;
}

export type GateReason =
  | "UNKNOWN FIRMWARE"
  | "UNSUPPORTED FIRMWARE"
  | "NO SEMANTIC INPUT"
  | "INSECURE ORIGIN"
  | "NO SECURE WEBSOCKET"
  | "NO CRYPTO"
  | "NO IDENTITY"
  | "NO DATA INTEGRITY"
  | "VOICE UNAVAILABLE"
  | "NO SECURE STORAGE"
  | "DEVICE LOCK UNVERIFIED";

export type GateDecision = Readonly<{
  compatibility: "supported" | "limited" | "unsupported";
  reasons: readonly GateReason[];
}>;

export type ShellViewModel =
  | Readonly<{
      screen: "checking";
      title: "CHECKING DEVICE";
      status: "NO DATA";
      reasons: readonly [];
      focus: 0;
    }>
  | Readonly<{
      screen: "ready";
      title: "PASEO R1";
      status: "READY FOR RELAY";
      reasons: readonly [];
      focus: number;
    }>
  | Readonly<{
      screen: "limited";
      title: "LIMITED";
      status: "READ ONLY";
      reasons: readonly GateReason[];
      focus: number;
    }>
  | Readonly<{
      screen: "unsupported";
      title: "UNSUPPORTED";
      status: "NO DATA";
      reasons: readonly GateReason[];
      focus: number;
    }>;

export interface ShellState {
  readonly status: "idle" | "probing" | "ready" | "limited" | "unsupported" | "disposed";
  readonly lifecycle: LifecycleState;
  readonly focus: number;
  readonly capabilitiesChecked: boolean;
  readonly productDataEnabled: false;
}

export interface ProductionShell {
  start(): Promise<void>;
  dispatch(command: SemanticCommand): "accepted" | "background" | "not-ready" | "disposed";
  state(): ShellState;
  dispose(): void;
}
