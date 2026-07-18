const DEFAULT_CLOCK = {
  now: () => Date.now(),
  setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeout: (timer) => globalThis.clearTimeout(timer),
};

const PASSTHROUGH_COMMANDS = new Set(["previous", "next", "select", "back"]);

export function createInputController({
  emit,
  onIgnored = () => {},
  clock = DEFAULT_CLOCK,
  minHoldMs = 250,
  maxHoldMs = 30_000,
  lateClickSuppressionMs = 500,
} = {}) {
  if (typeof emit !== "function") throw new TypeError("emit must be a function");

  let hold = null;
  let limitTimer = null;
  let suppressNextClickUntil = 0;
  let awaitingReleaseAfterLimit = false;
  let disposed = false;

  function event(type, source, details = {}) {
    return { type, source, at: clock.now(), ...details };
  }

  function ignore(type, source, reason) {
    onIgnored(event(type, source, { reason }));
  }

  function clearLimitTimer() {
    if (limitTimer === null) return;
    clock.clearTimeout(limitTimer);
    limitTimer = null;
  }

  function suppressTrailingClick() {
    suppressNextClickUntil = clock.now() + lateClickSuppressionMs;
  }

  function startHold(source) {
    if (awaitingReleaseAfterLimit) {
      ignore("hold-start", source, "hold-consumed");
      return;
    }
    if (hold) {
      ignore("hold-start", source, "duplicate-hold-start");
      return;
    }

    const startedAt = clock.now();
    hold = { source, startedAt };
    emit(event("hold-start", source));
    limitTimer = clock.setTimeout(() => {
      if (!hold || hold.startedAt !== startedAt) return;
      const active = hold;
      hold = null;
      limitTimer = null;
      awaitingReleaseAfterLimit = true;
      suppressTrailingClick();
      emit(event("hold-limit", active.source, {
        durationMs: maxHoldMs,
        tooShort: false,
      }));
    }, maxHoldMs);
  }

  function endHold(source) {
    if (!hold) {
      if (awaitingReleaseAfterLimit) {
        awaitingReleaseAfterLimit = false;
        suppressTrailingClick();
        ignore("hold-end", source, "capped-hold-end");
        return;
      }
      ignore("hold-end", source, "orphan-hold-end");
      return;
    }

    const active = hold;
    const durationMs = Math.max(0, clock.now() - active.startedAt);
    hold = null;
    clearLimitTimer();
    suppressTrailingClick();
    emit(event("hold-end", active.source, {
      durationMs,
      tooShort: durationMs < minHoldMs,
    }));
  }

  function handle(type, source = "unknown") {
    if (disposed) return;

    if (type === "hold-start") {
      startHold(source);
      return;
    }
    if (type === "hold-end") {
      endHold(source);
      return;
    }
    if (!PASSTHROUGH_COMMANDS.has(type)) {
      ignore(type, source, "unknown-command");
      return;
    }

    if (hold || awaitingReleaseAfterLimit) {
      ignore(type, source, "hold-consumed");
      return;
    }
    if (type === "select" && suppressNextClickUntil > clock.now()) {
      suppressNextClickUntil = 0;
      ignore(type, source, "trailing-click");
      return;
    }

    if (suppressNextClickUntil <= clock.now()) suppressNextClickUntil = 0;
    emit(event(type, source));
  }

  function interrupt(reason = "interrupted") {
    if (disposed) return false;
    if (!hold && awaitingReleaseAfterLimit) {
      awaitingReleaseAfterLimit = false;
      suppressTrailingClick();
      return true;
    }
    if (!hold) return false;
    const active = hold;
    const durationMs = Math.max(0, clock.now() - active.startedAt);
    hold = null;
    clearLimitTimer();
    suppressTrailingClick();
    emit(event("hold-interrupted", active.source, { reason, durationMs }));
    return true;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    hold = null;
    awaitingReleaseAfterLimit = false;
    suppressNextClickUntil = 0;
    clearLimitTimer();
  }

  return {
    handle,
    interrupt,
    dispose,
    isHolding: () => Boolean(hold),
  };
}
