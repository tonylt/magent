import { evaluateCapabilities } from "./capability-gate.ts";
import { createBoundedDiagnostics } from "./diagnostics.ts";
import type {
  CapabilitySnapshot,
  PlatformAdapter,
  PlatformEvent,
  ProductionShell,
  ProductionDiagnostics,
  ShellState,
  ShellViewModel,
  SemanticCommand,
} from "./contracts.ts";

export function createProductionShell({
  adapter,
  render,
  diagnostics = createBoundedDiagnostics(),
}: {
  adapter: PlatformAdapter;
  render: (viewModel: ShellViewModel) => void;
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
  let unsubscribe: (() => void) | null = null;
  let currentViewModel: ShellViewModel | null = null;

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

  function renderDecision(snapshot: CapabilitySnapshot): void {
    const decision = evaluateCapabilities(snapshot);
    diagnostics.record("capability-decision", decision.compatibility);
    updateState({
      status: decision.compatibility === "supported" ? "ready" : decision.compatibility,
      lifecycle: snapshot.lifecycle,
      capabilitiesChecked: true,
    });

    if (decision.compatibility === "supported") {
      emit({
        screen: "ready",
        title: "PASEO R1",
        status: "READY FOR RELAY",
        reasons: [],
        items: [
          { title: "DEVICE CAPABILITIES", detail: "CHECKED BEFORE DATA" },
          { title: "RELAY NOT CONFIGURED", detail: "S04 REQUIRED" },
        ],
        focus: current.focus,
      });
      return;
    }

    if (decision.compatibility === "limited") {
      emit({
        screen: "limited",
        title: "LIMITED",
        status: "READ ONLY",
        reasons: decision.reasons,
        focus: current.focus,
      });
      return;
    }

    emit({
      screen: "unsupported",
      title: "UNSUPPORTED",
      status: "NO DATA",
      reasons: decision.reasons,
      focus: current.focus,
    });
  }

  async function start(): Promise<void> {
    if (started || disposed) return;
    started = true;
    diagnostics.record("capability-probe", "started");
    updateState({ status: "probing" });
    emit({
      screen: "checking",
      title: "CHECKING DEVICE",
      status: "NO DATA",
      reasons: [],
      focus: 0,
    });
    unsubscribe = adapter.subscribe(handlePlatformEvent);
    const snapshot = await adapter.inspectCapabilities();
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
    if (current.status !== "ready" || currentViewModel?.screen !== "ready") {
      diagnostics.record("command-rejected", "not-ready");
      return "not-ready";
    }
    if (command.type === "hold-start" || command.type === "hold-end") {
      diagnostics.record("command-rejected", "not-ready");
      return "not-ready";
    }

    let focus = current.focus;
    if (command.type === "previous") focus = Math.max(0, focus - 1);
    else if (command.type === "next") focus = Math.min(1, focus + 1);
    else if (command.type === "focus-at") focus = Math.max(0, Math.min(1, Math.trunc(command.index)));

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
