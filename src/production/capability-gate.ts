import type { CapabilitySnapshot, GateDecision, GateReason, Support } from "./contracts.ts";

function unavailable(value: Support): boolean {
  return value !== "available";
}

export function evaluateCapabilities(snapshot: CapabilitySnapshot): GateDecision {
  const unsupported: GateReason[] = [];

  if (snapshot.firmware.status === "unsupported") unsupported.push("UNSUPPORTED FIRMWARE");
  if (unavailable(snapshot.features.semanticInput)) unsupported.push("NO SEMANTIC INPUT");
  if (unavailable(snapshot.features.https)) unsupported.push("INSECURE ORIGIN");
  if (unavailable(snapshot.features.wss)) unsupported.push("NO SECURE WEBSOCKET");
  if (unavailable(snapshot.features.crypto)) unsupported.push("NO CRYPTO");
  if (unavailable(snapshot.features.identity)) unsupported.push("NO IDENTITY");
  if (unavailable(snapshot.features.dataIntegrity)) unsupported.push("NO DATA INTEGRITY");

  if (unsupported.length > 0) return { compatibility: "unsupported", reasons: unsupported };

  const limited: GateReason[] = [];
  if (snapshot.firmware.status === "unknown") limited.push("UNKNOWN FIRMWARE");
  if (unavailable(snapshot.features.voice)) limited.push("VOICE UNAVAILABLE");
  if (unavailable(snapshot.features.secureStorage)) limited.push("NO SECURE STORAGE");
  if (unavailable(snapshot.features.deviceLock)) limited.push("DEVICE LOCK UNVERIFIED");

  return limited.length > 0
    ? { compatibility: "limited", reasons: limited }
    : { compatibility: "supported", reasons: [] };
}
