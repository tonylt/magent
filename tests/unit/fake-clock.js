export function createFakeClock(startAt = 1_000) {
  let now = startAt;
  let nextId = 1;
  const timers = new Map();

  function runDueTimers() {
    let due;
    do {
      due = [...timers.entries()]
        .filter(([, timer]) => timer.at <= now)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0]);
      for (const [id, timer] of due) {
        timers.delete(id);
        timer.callback();
      }
    } while (due.length > 0);
  }

  return {
    now: () => now,
    setTimeout(callback, delay) {
      const id = nextId++;
      timers.set(id, { at: now + delay, callback });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    advance(ms) {
      now += ms;
      runDueTimers();
    },
    pendingTimers: () => timers.size,
  };
}
