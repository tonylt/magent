// Fail-closed capability and minimum-client negotiation.
//
// Merges the S03 device capability gate (GateDecision) with the S04 pinned Relay
// compatibility report (CompatibilityReport) into one overall outcome. Pure: no DOM,
// no network. Device hardware failures are terminal; relay protocol/min-client
// failures are recoverable because an upgrade or a fixed daemon can be retried.

import type { GateDecision } from "./contracts.ts";
import type { CompatibilityReport } from "./relay/relay-client.ts";

export type NegotiatedCompatibility = "supported" | "limited" | "upgrade-required" | "unsupported";

export interface NegotiationOutcome {
  readonly compatibility: NegotiatedCompatibility;
  /** Human-readable reasons: device gate reasons or the relay failure label. */
  readonly reasons: readonly string[];
  /** Whether a retry could plausibly change the outcome (relay-origin failures only). */
  readonly recoverable: boolean;
  /** Which layer determined the outcome. */
  readonly source: "device" | "relay";
  /** Whether a relay report participated in this outcome. */
  readonly relayNegotiated: boolean;
}

export function negotiate(
  device: GateDecision,
  relay?: CompatibilityReport,
): NegotiationOutcome {
  // 1. Device hardware gate is terminal and is checked before contacting the relay.
  if (device.compatibility === "unsupported") {
    return { compatibility: "unsupported", reasons: [...device.reasons], recoverable: false, source: "device", relayNegotiated: false };
  }

  // 2. Device-only mode: no relay report yet, mirror the device decision.
  if (!relay) {
    return {
      compatibility: device.compatibility,
      reasons: [...device.reasons],
      recoverable: false,
      source: "device",
      relayNegotiated: false,
    };
  }

  // 3-4. Relay-origin incompatibility is recoverable.
  if (relay.compatibility === "upgrade-required") {
    return { compatibility: "upgrade-required", reasons: relayReasons(relay), recoverable: true, source: "relay", relayNegotiated: true };
  }
  if (relay.compatibility === "unsupported") {
    return { compatibility: "unsupported", reasons: relayReasons(relay), recoverable: true, source: "relay", relayNegotiated: true };
  }

  // 5. Relay compatible but device is read-only limited: stay limited.
  if (device.compatibility === "limited" || relay.compatibility === "limited") {
    return { compatibility: "limited", reasons: [...device.reasons], recoverable: false, source: "device", relayNegotiated: true };
  }

  // 6. Fully compatible.
  return { compatibility: "supported", reasons: [], recoverable: false, source: "relay", relayNegotiated: true };
}

function relayReasons(relay: CompatibilityReport): readonly string[] {
  return relay.failure ? [relay.failure] : [];
}
