const DEFAULT_CAPACITY = 64;
const DEFAULT_MAX_BYTES = 16 * 1024;

const oneOf = (...values) => {
  const allowed = new Set(values);
  return (value) => allowed.has(value);
};

const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const boolean = (value) => typeof value === "boolean";

const EVENT_FIELDS = Object.freeze({
  boot: {
    source: oneOf("system", "rabbit", "browser"),
    width: integer,
    height: integer,
  },
  capability: {
    capability: oneOf("voice", "secure-storage", "sensors", "https", "viewport"),
    available: boolean,
    result: oneOf("supported", "limited", "unsupported"),
  },
  input: {
    command: oneOf("previous", "next", "select", "back", "focus", "voice-start", "voice-stop", "interrupt"),
    source: oneOf("rabbit", "keyboard", "touch", "lifecycle", "system"),
    result: oneOf("emitted", "ignored", "interrupted"),
    code: oneOf("duplicate", "wrong-state", "late-click", "hidden", "timeout", "unavailable"),
  },
  navigation: {
    view: oneOf("home", "diagnostics", "transport", "voice", "composer"),
    focus: integer,
    result: oneOf("entered", "restored", "unchanged"),
  },
  voice: {
    state: oneOf("recording", "transcribing", "review", "failed"),
    result: oneOf("started", "stopped", "received", "interrupted", "failed"),
    code: oneOf("hidden", "timeout", "too-short", "unavailable", "bridge-error"),
    sizeBucket: oneOf("empty", "1-32", "33-128", "129-512", "513+"),
  },
  lifecycle: {
    state: oneOf("foreground", "background", "hidden", "suspended", "resumed"),
    result: oneOf("observed", "interrupted"),
  },
  network: {
    online: boolean,
    result: oneOf("online", "offline"),
  },
  error: {
    kind: oneOf("runtime", "rejection", "bridge", "storage"),
    code: oneOf("unhandled", "unsupported", "invalid-message", "read-failed", "write-failed"),
  },
  diagnostic: {
    result: oneOf("dropped", "rejected"),
    code: oneOf("unknown-event", "over-budget", "invalid-field"),
    count: integer,
  },
});

function serializedBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function sanitize(type, fields) {
  const validators = EVENT_FIELDS[type];
  if (!validators || fields === null || typeof fields !== "object" || Array.isArray(fields)) return null;

  const sanitized = {};
  for (const [field, validate] of Object.entries(validators)) {
    if (Object.hasOwn(fields, field) && validate(fields[field])) sanitized[field] = fields[field];
  }
  return sanitized;
}

export function createDiagnosticLog({
  capacity = DEFAULT_CAPACITY,
  maxBytes = DEFAULT_MAX_BYTES,
  now = () => Math.round(performance.now()),
} = {}) {
  if (!Number.isSafeInteger(capacity) || capacity < 1) throw new TypeError("capacity must be a positive integer");
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 2) throw new TypeError("maxBytes must be at least 2");
  if (typeof now !== "function") throw new TypeError("now must be a function");

  const entries = [];

  return Object.freeze({
    record(type, fields = {}) {
      const sanitized = sanitize(type, fields);
      if (sanitized === null) return false;

      const at = now();
      if (!Number.isFinite(at)) return false;
      const entry = { at: Math.max(0, Math.round(at)), type, ...sanitized };
      if (serializedBytes([entry]) > maxBytes) return false;

      entries.push(entry);
      while (entries.length > capacity || serializedBytes(entries) > maxBytes) entries.shift();
      return true;
    },

    snapshot() {
      return entries.map((entry) => ({ ...entry }));
    },

    clear() {
      entries.length = 0;
    },
  });
}
