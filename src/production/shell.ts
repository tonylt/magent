import { evaluateCapabilities } from "./capability-gate.ts";
import type {
  CapabilitySnapshot,
  PlatformAdapter,
  PlatformEvent,
  ProductionShell,
  ShellState,
  ShellViewModel,
} from "./contracts.ts";

export function createProductionShell({
  adapter,
  render,
}: {
  adapter: PlatformAdapter;
  render: (viewModel: ShellViewModel) => void;
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

  function updateState(next: Partial<ShellState>): void {
    current = { ...current, ...next };
  }

  function handlePlatformEvent(event: PlatformEvent): void {
    if (disposed || event.type !== "lifecycle") return;
    updateState({ lifecycle: event.state });
  }

  function renderDecision(snapshot: CapabilitySnapshot): void {
    const decision = evaluateCapabilities(snapshot);
    updateState({
      status: decision.compatibility === "supported" ? "ready" : decision.compatibility,
      lifecycle: snapshot.lifecycle,
      capabilitiesChecked: true,
    });

    if (decision.compatibility === "supported") {
      render({
        screen: "ready",
        title: "PASEO R1",
        status: "READY FOR RELAY",
        reasons: [],
        focus: current.focus,
      });
      return;
    }

    if (decision.compatibility === "limited") {
      render({
        screen: "limited",
        title: "LIMITED",
        status: "READ ONLY",
        reasons: decision.reasons,
        focus: current.focus,
      });
      return;
    }

    render({
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
    updateState({ status: "probing" });
    render({
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

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    unsubscribe?.();
    unsubscribe = null;
    adapter.dispose();
    updateState({ status: "disposed" });
  }

  return {
    start,
    state: () => ({ ...current }),
    dispose,
  };
}
