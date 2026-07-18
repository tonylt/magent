import type { InputSource, SemanticCommand } from "./contracts.ts";

interface Clock {
  now(): number;
  setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
}

const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (timer) => clearTimeout(timer),
};

export function createProductionInputController({
  emit,
  clock = systemClock,
  maxHoldMs = 30_000,
  lateClickSuppressionMs = 500,
}: {
  emit: (command: SemanticCommand, source: InputSource) => void;
  clock?: Clock;
  maxHoldMs?: number;
  lateClickSuppressionMs?: number;
}) {
  let hold: { source: InputSource; startedAt: number } | null = null;
  let capTimer: ReturnType<typeof setTimeout> | null = null;
  let awaitingReleaseAfterCap: InputSource | null = null;
  let suppressClickUntil = 0;
  let disposed = false;

  function clearCapTimer(): void {
    if (capTimer === null) return;
    clock.clearTimeout(capTimer);
    capTimer = null;
  }

  function suppressTrailingClick(): void {
    suppressClickUntil = clock.now() + lateClickSuppressionMs;
  }

  function startHold(source: InputSource): void {
    if (hold || awaitingReleaseAfterCap !== null) return;
    const startedAt = clock.now();
    hold = { source, startedAt };
    emit({ type: "hold-start" }, source);
    capTimer = clock.setTimeout(() => {
      if (!hold || hold.startedAt !== startedAt) return;
      const active = hold;
      hold = null;
      capTimer = null;
      awaitingReleaseAfterCap = active.source;
      suppressTrailingClick();
      emit({ type: "hold-end" }, active.source);
    }, maxHoldMs);
  }

  function endHold(source: InputSource): void {
    if (!hold) {
      if (awaitingReleaseAfterCap === source) {
        awaitingReleaseAfterCap = null;
        suppressTrailingClick();
      }
      return;
    }
    if (hold.source !== source) return;
    const active = hold;
    hold = null;
    clearCapTimer();
    suppressTrailingClick();
    emit({ type: "hold-end" }, active.source);
  }

  function handle(command: SemanticCommand, source: InputSource): boolean {
    if (disposed) return false;
    if (command.type === "hold-start") {
      startHold(source);
      return true;
    }
    if (command.type === "hold-end") {
      endHold(source);
      return true;
    }
    if (hold || awaitingReleaseAfterCap !== null) return false;
    if (command.type === "activate" && suppressClickUntil > clock.now()) {
      suppressClickUntil = 0;
      return false;
    }
    if (suppressClickUntil <= clock.now()) suppressClickUntil = 0;
    emit(command, source);
    return true;
  }

  function interrupt(): void {
    if (hold) {
      hold = null;
      clearCapTimer();
      suppressTrailingClick();
    }
    if (awaitingReleaseAfterCap !== null) {
      awaitingReleaseAfterCap = null;
      suppressTrailingClick();
    }
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    hold = null;
    awaitingReleaseAfterCap = null;
    suppressClickUntil = 0;
    clearCapTimer();
  }

  return { handle, interrupt, dispose };
}
