// S02 owned-R1 evidence collector.
//
// Produces a sanitized, bounded, payload-free evidence bundle for the H01-H24
// hardware UAT matrix. Like the diagnostic log, every field is allowlisted and
// validated, so the export can only ever contain structured capability/result
// metadata - never a token, transcript, raw audio, URL query, host credential,
// Device ID, network address, or Relay offer. Human notes stay in the markdown
// matrix; this module holds only machine-checkable evidence.

const SCHEMA = 2;
const DEFAULT_MAX_BYTES = 16 * 1024;
const MAX_RESOURCE_SAMPLES = 16;

const MATRIX_IDS = new Set(
  Array.from({ length: 24 }, (_, index) => `H${String(index + 1).padStart(2, "0")}`),
);

const oneOf = (...values) => {
  const allowed = new Set(values);
  return (value) => allowed.has(value);
};
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const percent = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 100;
const boolean = (value) => typeof value === "boolean";

const RESULT = oneOf("PASS", "FALLBACK", "BLOCKER", "PENDING");
const FIRMWARE_STATUS = oneOf("tested", "unknown", "unsupported");
const ORIGIN_CLASS = oneOf("loopback", "lan", "trusted-https", "insecure", "file", "unknown");
const ORIENTATION = oneOf("portrait", "landscape", "unknown");
const PRODUCT_MODE = oneOf(
  "PENDING",
  "PRIVATE_READ_ONLY",
  "DISTRIBUTABLE_SESSION_READ",
  "DISTRIBUTABLE_SECURE_READ",
  "CONTROLLED_ACTION_ELIGIBLE",
  "UNSUPPORTED",
);

const CAPABILITY_FIELDS = Object.freeze({
  https: boolean,
  wss: boolean,
  voice: boolean,
  secureStorage: boolean,
  deviceLock: boolean,
  sensors: boolean,
});

const MEASUREMENT_FIELDS = Object.freeze({
  wheelDirection: oneOf("up-forward", "up-back", "unknown"),
  lateClickSuppressionMs: integer,
  tooShortThresholdMs: integer,
  recordingCapMs: integer,
  feedbackLatencyMs: integer,
  wheelTickRateHz: integer,
});

const RESOURCE_FIELDS = Object.freeze({
  elapsedMinutes: integer,
  domNodes: integer,
  timers: integer,
  diagnosticEntries: integer,
  bundleBytes: integer,
  memoryMb: integer,
  battery: percent,
});

const VERSION_PATTERN = /^[A-Za-z0-9._-]{1,32}$/;
const DIGEST_PATTERN = /^[a-f0-9]{0,128}$/;
const EVIDENCE_ID_PATTERN = /^S02-E\d{3,4}$/;

function serializedBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

/** Derive an origin class from a location without ever storing the URL itself. */
export function deriveOriginClass(location) {
  const protocol = String(location?.protocol ?? "");
  const hostname = String(location?.hostname ?? "");
  if (protocol === "file:") return "file";
  if (hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1") return "loopback";
  const isPrivate = /^10\./.test(hostname)
    || /^192\.168\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    || hostname.endsWith(".local");
  if (protocol === "https:") return isPrivate ? "lan" : "trusted-https";
  if (protocol === "http:") return "insecure";
  return "unknown";
}

function sanitizeFields(schema, fields) {
  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) return null;
  const sanitized = {};
  for (const [field, validate] of Object.entries(schema)) {
    if (Object.hasOwn(fields, field) && validate(fields[field])) sanitized[field] = fields[field];
  }
  return sanitized;
}

export function createEvidenceCollector({
  version,
  digest = "",
  originClass = "unknown",
  maxBytes = DEFAULT_MAX_BYTES,
} = {}) {
  if (!VERSION_PATTERN.test(String(version ?? ""))) throw new TypeError("version must match [A-Za-z0-9._-]{1,32}");
  if (!DIGEST_PATTERN.test(String(digest))) throw new TypeError("digest must be lowercase hex up to 128 chars");
  if (!ORIGIN_CLASS(originClass)) throw new TypeError("originClass is not an allowed class");
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 256) throw new TypeError("maxBytes must be at least 256");

  const probe = Object.freeze({ version: String(version), digest: String(digest), originClass });
  let firmwareStatus = "unknown";
  let viewport = { width: 0, height: 0, orientation: "unknown" };
  let capabilities = {};
  const results = new Map();
  const measurements = {};
  const resourceSamples = [];
  let productMode = "PENDING";

  function snapshot() {
    return {
      schema: SCHEMA,
      probe: { ...probe },
      environment: {
        firmwareStatus,
        viewport: { ...viewport },
        capabilities: { ...capabilities },
      },
      results: [...results.values()]
        .map((entry) => ({ ...entry }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      measurements: { ...measurements },
      resource: { samples: resourceSamples.map((sample) => ({ ...sample })), sampleCount: resourceSamples.length },
      productMode,
    };
  }

  return Object.freeze({
    setFirmware(status) {
      if (!FIRMWARE_STATUS(status)) return false;
      firmwareStatus = status;
      return true;
    },
    setViewport(next) {
      const clean = sanitizeFields({ width: integer, height: integer, orientation: ORIENTATION }, next);
      if (!clean || !("width" in clean) || !("height" in clean)) return false;
      viewport = { width: clean.width, height: clean.height, orientation: clean.orientation ?? "unknown" };
      return true;
    },
    setCapabilities(next) {
      const clean = sanitizeFields(CAPABILITY_FIELDS, next);
      if (!clean) return false;
      capabilities = { ...capabilities, ...clean };
      return true;
    },
    recordResult({ id, result, evidenceId } = {}) {
      if (!MATRIX_IDS.has(id) || !RESULT(result) || !EVIDENCE_ID_PATTERN.test(String(evidenceId ?? ""))) return false;
      const entry = { id, result, evidenceId: String(evidenceId) };
      if (serializedBytes([...results.values()].filter((e) => e.id !== id).concat(entry)) > maxBytes) return false;
      results.set(id, entry);
      return true;
    },
    recordMeasurement(key, value) {
      const validate = MEASUREMENT_FIELDS[key];
      if (!validate || !validate(value)) return false;
      measurements[key] = value;
      return true;
    },
    recordResourceSample(sample) {
      const clean = sanitizeFields(RESOURCE_FIELDS, sample);
      if (!clean || Object.keys(clean).length === 0) return false;
      resourceSamples.push(clean);
      while (resourceSamples.length > MAX_RESOURCE_SAMPLES) resourceSamples.shift();
      return true;
    },
    setProductMode(mode) {
      if (!PRODUCT_MODE(mode)) return false;
      productMode = mode;
      return true;
    },
    export() {
      const bundle = snapshot();
      while (resourceSamples.length > 0 && serializedBytes(bundle) > maxBytes) {
        resourceSamples.shift();
        bundle.resource = { samples: resourceSamples.map((s) => ({ ...s })), sampleCount: resourceSamples.length };
      }
      return Object.freeze(bundle);
    },
    reset() {
      firmwareStatus = "unknown";
      viewport = { width: 0, height: 0, orientation: "unknown" };
      capabilities = {};
      results.clear();
      for (const key of Object.keys(measurements)) delete measurements[key];
      resourceSamples.length = 0;
      productMode = "PENDING";
    },
  });
}
