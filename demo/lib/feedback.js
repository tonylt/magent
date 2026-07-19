// Wheel feedback: a short click tone (Web Audio, no audio asset -> CSP-safe) plus a
// light haptic (Vibration API). Everything is best-effort and degrades to a no-op
// when the API is missing, so it never throws or blocks input.

export function createFeedback({ host = globalThis.window, enabled = true } = {}) {
  let audioContext = null;

  function ensureAudio() {
    if (!enabled) return null;
    const Ctx = host.AudioContext || host.webkitAudioContext;
    if (typeof Ctx !== "function") return null;
    if (!audioContext) {
      try {
        audioContext = new Ctx();
      } catch {
        audioContext = null;
        return null;
      }
    }
    if (audioContext.state === "suspended") {
      try {
        audioContext.resume();
      } catch {
        // Resume is best-effort; a still-suspended context simply stays silent.
      }
    }
    return audioContext;
  }

  function blip() {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      oscillator.type = "square";
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.05);
    } catch {
      // Audio is best-effort.
    }
  }

  function haptic(durationMs = 12) {
    if (!enabled) return;
    try {
      host.navigator?.vibrate?.(durationMs);
    } catch {
      // Vibration is best-effort.
    }
  }

  return {
    tick() {
      haptic();
      blip();
    },
    blip,
    haptic,
    dispose() {
      try {
        audioContext?.close?.();
      } catch {
        // Teardown is best-effort.
      }
      audioContext = null;
    },
  };
}
