// Pinned Paseo Relay protocol subset for the R1 companion compatibility tracer.
//
// This module is pure: no DOM, no network, no crypto secrets. It fixes the exact
// message shapes the R1 depends on so that any drift fails visibly instead of
// silently reaching sensitive data. It never decrypts frames and never records
// ciphertext, nonces, tags, or key material.

export const PROTOCOL_VERSION = 3;
export const MIN_RELAY_PROTOCOL = 3;
export const CLIENT_VERSION = 3;
export const CLIENT_NAME = "rabbit-r1-paseo-companion";

/** Requested subscription topics are stable identifiers, not product payload. */
export const REQUESTED_TOPICS = ["directory", "attention"] as const;

/** Bound on a single frame envelope field so a hostile frame cannot exhaust memory. */
export const MAX_FRAME_FIELD_LENGTH = 8 * 1024;

export type Compatibility = "supported" | "limited" | "upgrade-required" | "unsupported";

export type FailureLabel =
  | "RELAY PROTOCOL TOO OLD"
  | "CLIENT UPGRADE REQUIRED"
  | "MALFORMED HELLO ACK"
  | "MALFORMED OFFER"
  | "INSECURE RELAY ENDPOINT"
  | "MISSING RELAY KEY"
  | "SUBSCRIPTION REJECTED"
  | "MALFORMED FRAME"
  | "FRAME SEQUENCE GAP"
  | "TRANSPORT CLOSED";

export interface ClientHello {
  readonly t: "hello";
  readonly protocol: number;
  readonly minRelay: number;
  readonly client: Readonly<{ name: string; version: number }>;
  readonly capabilities: readonly string[];
}

export interface RelayHelloAck {
  readonly t: "hello-ack";
  readonly protocol: number;
  readonly minClient: number;
  readonly relay: Readonly<{ id: string }>;
}

export interface RelayOffer {
  readonly v: number;
  readonly host: Readonly<{ id: string }>;
  readonly relay: Readonly<{ endpoint: string }>;
  readonly publicKey: string;
}

export interface SubscribeRequest {
  readonly t: "subscribe";
  readonly topics: readonly string[];
}

export interface SubscribeAck {
  readonly t: "subscribe-ack";
  readonly topics: readonly string[];
}

export interface RelayFrame {
  readonly t: "frame";
  readonly seq: number;
  readonly nonce: string;
  readonly ciphertext: string;
  readonly tag: string;
}

export type ValidationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; compatibility: Compatibility; failure: FailureLabel }>;

function fail(compatibility: Compatibility, failure: FailureLabel): ValidationResult<never> {
  return { ok: false, compatibility, failure };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isBoundedString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_FRAME_FIELD_LENGTH;
}

export function buildClientHello(): ClientHello {
  return {
    t: "hello",
    protocol: CLIENT_VERSION,
    minRelay: MIN_RELAY_PROTOCOL,
    client: { name: CLIENT_NAME, version: CLIENT_VERSION },
    capabilities: ["read", "subscribe", "frame-v1"],
  };
}

export function buildSubscribeRequest(): SubscribeRequest {
  return { t: "subscribe", topics: [...REQUESTED_TOPICS] };
}

export function validateHelloAck(raw: unknown): ValidationResult<RelayHelloAck> {
  if (
    !isRecord(raw)
    || raw.t !== "hello-ack"
    || !isInteger(raw.protocol)
    || !isInteger(raw.minClient)
    || !isRecord(raw.relay)
    || typeof raw.relay.id !== "string"
    || raw.relay.id.length === 0
  ) {
    return fail("unsupported", "MALFORMED HELLO ACK");
  }
  if (raw.protocol < MIN_RELAY_PROTOCOL) {
    return fail("upgrade-required", "RELAY PROTOCOL TOO OLD");
  }
  if (CLIENT_VERSION < raw.minClient) {
    return fail("upgrade-required", "CLIENT UPGRADE REQUIRED");
  }
  return { ok: true, value: { t: "hello-ack", protocol: raw.protocol, minClient: raw.minClient, relay: { id: raw.relay.id } } };
}

export function validateOffer(raw: unknown): ValidationResult<RelayOffer> {
  if (
    !isRecord(raw)
    || !isInteger(raw.v)
    || !isRecord(raw.host)
    || typeof raw.host.id !== "string"
    || raw.host.id.length === 0
    || !isRecord(raw.relay)
    || typeof raw.relay.endpoint !== "string"
  ) {
    return fail("unsupported", "MALFORMED OFFER");
  }
  if (!raw.relay.endpoint.startsWith("wss://")) {
    return fail("unsupported", "INSECURE RELAY ENDPOINT");
  }
  if (typeof raw.publicKey !== "string" || raw.publicKey.length === 0) {
    return fail("unsupported", "MISSING RELAY KEY");
  }
  return {
    ok: true,
    value: { v: raw.v, host: { id: raw.host.id }, relay: { endpoint: raw.relay.endpoint }, publicKey: raw.publicKey },
  };
}

export function validateSubscribeAck(
  raw: unknown,
  requested: readonly string[],
): ValidationResult<SubscribeAck> {
  if (
    !isRecord(raw)
    || raw.t !== "subscribe-ack"
    || !Array.isArray(raw.topics)
    || !raw.topics.every((topic): topic is string => typeof topic === "string")
  ) {
    return fail("unsupported", "SUBSCRIPTION REJECTED");
  }
  const acked = new Set(raw.topics);
  if (!requested.every((topic) => acked.has(topic))) {
    return fail("unsupported", "SUBSCRIPTION REJECTED");
  }
  return { ok: true, value: { t: "subscribe-ack", topics: [...raw.topics] } };
}

export function validateFrame(raw: unknown, previousSeq: number): ValidationResult<RelayFrame> {
  if (
    !isRecord(raw)
    || raw.t !== "frame"
    || !isInteger(raw.seq)
    || !isBoundedString(raw.nonce)
    || !isBoundedString(raw.ciphertext)
    || !isBoundedString(raw.tag)
  ) {
    return fail("unsupported", "MALFORMED FRAME");
  }
  if (raw.seq !== previousSeq + 1) {
    return fail("unsupported", "FRAME SEQUENCE GAP");
  }
  return { ok: true, value: { t: "frame", seq: raw.seq, nonce: raw.nonce, ciphertext: raw.ciphertext, tag: raw.tag } };
}
