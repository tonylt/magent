import { evaluateCapabilities } from "./capability-gate.ts";
import { createBoundedDiagnostics } from "./diagnostics.ts";
import { negotiate } from "./negotiation.ts";
import type {
  CapabilitySnapshot,
  GateDecision,
  PlatformAdapter,
  PlatformEvent,
  ProductionShell,
  ProductionDiagnostics,
  RelayCompatibilitySource,
  ShellState,
  ShellViewModel,
  SemanticCommand,
} from "./contracts.ts";
import type { CompatibilityReport } from "./relay/relay-client.ts";

const UNREACHABLE_RELAY: CompatibilityReport = {
  compatibility: "unsupported",
  stage: "hello",
  failure: "TRANSPORT CLOSED",
  framesValidated: 0,
};

export function createProductionShell({
  adapter,
  render,
  relaySource,
  diagnostics = createBoundedDiagnostics(),
}: {
  adapter: PlatformAdapter;
  render: (viewModel: ShellViewModel) => void;
  relaySource?: RelayCompatibilitySource;
  diagnostics?: ProductionDiagnostics;
}): ProductionShell {
  let current: ShellState = {
    status: "idle",
    lifecycle: "foreground",
    focus: 0,
    capabilitiesChecked: false,
    productDataEnabled: false,
  };
  let started = false;
  let disposed = false;
  let negotiating = false;
  let unsubscribe: (() => void) | null = null;
  let currentViewModel: ShellViewModel | null = null;
  let lastDeviceDecision: GateDecision | null = null;

  function emit(viewModel: ShellViewModel): void {
    currentViewModel = viewModel;
    render(viewModel);
  }

  function updateState(next: Partial<ShellState>): void {
    current = { ...current, ...next };
  }

  function handlePlatformEvent(event: PlatformEvent): void {
    if (disposed) return;
    if (event.type === "lifecycle") {
      updateState({ lifecycle: event.state });
      diagnostics.record("lifecycle", event.state);
      return;
    }
    if (event.type === "command") dispatch(event.command);
  }

  function renderDeviceOnly(decision: GateDecision): void {
    if (decision.compatibility === "supported") {
      updateState({ status: "ready", focus: 0 });
      emit({
        screen: "ready",
        title: "PASEO R1",
        status: "READY FOR RELAY",
        reasons: [],
        items: [
          { title: "DEVICE CAPABILITIES", detail: "CHECKED BEFORE DATA" },
          { title: "RELAY NOT CONFIGURED", detail: "S04 REQUIRED" },
        ],
        focus: 0,
      });
      return;
    }
    updateState({ status: "limited", focus: 0 });
    emit({ screen: "limited", title: "LIMITED", status: "READ ONLY", reasons: decision.reasons, focus: 0 });
  }

  function renderNegotiated(decision: GateDecision, report: CompatibilityReport): void {
    const outcome = negotiate(decision, report);
    diagnostics.record("relay-negotiation", outcome.compatibility);

    if (outcome.compatibility === "supported") {
      updateState({ status: "ready", focus: 0 });
      emit({
        screen: "ready",
        title: "PASEO R1",
        status: "RELAY COMPATIBLE",
        reasons: [],
        items: [
          { title: "DEVICE CAPABILITIES", detail: "CHECKED BEFORE DATA" },
          { title: "RELAY COMPATIBLE", detail: "S05 REQUIRED" },
        ],
        focus: 0,
      });
      return;
    }
    if (outcome.compatibility === "limited") {
      updateState({ status: "limited", focus: 0 });
      emit({ screen: "limited", title: "LIMITED", status: "READ ONLY", reasons: outcome.reasons, focus: 0 });
      return;
    }
    // upgrade-required or relay-origin unsupported: recoverable recovery screen.
    updateState({ status: outcome.compatibility, focus: 0 });
    emit({
      screen: "recover",
      title: outcome.compatibility === "upgrade-required" ? "UPGRADE REQUIRED" : "UNSUPPORTED",
      status: "NO DATA",
      reasons: outcome.reasons,
      recoverable: outcome.recoverable,
      focus: 0,
    });
  }

  async function negotiateRelay(decision: GateDecision, source: RelayCompatibilitySource): Promise<void> {
    if (negotiating) return;
    negotiating = true;
    updateState({ status: "negotiating", focus: 0 });
    diagnostics.record("relay-negotiation", "negotiating");
    emit({ screen: "checking-relay", title: "CHECKING RELAY", status: "NO DATA", reasons: [], focus: 0 });

    let report: CompatibilityReport;
    try {
      report = await source();
    } catch {
      report = UNREACHABLE_RELAY;
    }
    negotiating = false;
    if (disposed) return;
    renderNegotiated(decision, report);
  }

  function renderDecision(snapshot: CapabilitySnapshot): void {
    const decision = evaluateCapabilities(snapshot);
    lastDeviceDecision = decision;
    diagnostics.record("capability-decision", decision.compatibility);
    updateState({ lifecycle: snapshot.lifecycle, capabilitiesChecked: true });

    // Device hardware gate is terminal and never contacts the relay.
    if (decision.compatibility === "unsupported") {
      updateState({ status: "unsupported", focus: 0 });
      emit({ screen: "unsupported", title: "UNSUPPORTED", status: "NO DATA", reasons: decision.reasons, focus: 0 });
      return;
    }

    if (!relaySource) {
      renderDeviceOnly(decision);
      return;
    }
    void negotiateRelay(decision, relaySource);
  }

  async function start(): Promise<void> {
    if (started || disposed) return;
    started = true;
    diagnostics.record("capability-probe", "started");
    updateState({ status: "probing" });
    emit({ screen: "checking", title: "CHECKING DEVICE", status: "NO DATA", reasons: [], focus: 0 });
    unsubscribe = adapter.subscribe(handlePlatformEvent);
    let snapshot: CapabilitySnapshot;
    try {
      snapshot = await adapter.inspectCapabilities();
    } catch {
      if (disposed) return;
      diagnostics.record("capability-decision", "unsupported");
      updateState({ status: "unsupported", capabilitiesChecked: true });
      emit({
        screen: "unsupported",
        title: "UNSUPPORTED",
        status: "NO DATA",
        reasons: ["CAPABILITY PROBE FAILED"],
        focus: current.focus,
      });
      return;
    }
    if (disposed) return;
    renderDecision(snapshot);
  }

  function dispatch(
    command: SemanticCommand,
  ): "accepted" | "background" | "not-ready" | "disposed" {
    if (disposed) {
      diagnostics.record("command-rejected", "disposed");
      return "disposed";
    }
    if (current.lifecycle === "background") {
      diagnostics.record("command-rejected", "background");
      return "background";
    }

    // Recoverable recovery screen: side click retries the relay negotiation.
    if (currentViewModel?.screen === "recover") {
      if (currentViewModel.recoverable && command.type === "activate" && lastDeviceDecision && relaySource) {
        diagnostics.record("relay-negotiation", "retry");
        void negotiateRelay(lastDeviceDecision, relaySource);
        return "accepted";
      }
      diagnostics.record("command-rejected", "not-ready");
      return "not-ready";
    }

    if (current.status !== "ready" || currentViewModel?.screen !== "ready") {
      diagnostics.record("command-rejected", "not-ready");
      return "not-ready";
    }
    if (command.type === "hold-start" || command.type === "hold-end") {
      diagnostics.record("command-rejected", "not-ready");
      return "not-ready";
    }

    const maxFocus = Math.max(0, currentViewModel.items.length - 1);
    let focus = current.focus;
    if (command.type === "previous") focus = Math.max(0, focus - 1);
    else if (command.type === "next") focus = Math.min(maxFocus, focus + 1);
    else if (command.type === "focus-at") focus = Math.max(0, Math.min(maxFocus, Math.trunc(command.index)));

    updateState({ focus });
    emit({ ...currentViewModel, focus });
    return "accepted";
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    unsubscribe?.();
    unsubscribe = null;
    adapter.dispose();
    updateState({ status: "disposed" });
    diagnostics.record("shell-disposed", "disposed");
  }

  return {
    start,
    dispatch,
    state: () => ({ ...current }),
    diagnostics: () => diagnostics.snapshot(),
    dispose,
  };
}
