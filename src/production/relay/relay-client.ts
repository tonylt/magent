// Pinned Relay compatibility tracer.
//
// Drives the pinned handshake subset (offer -> hello -> subscribe -> frame) over an
// injected transport and returns a visible Compatibility verdict. It stops at the
// first drift and never proceeds to sensitive data on a mismatch. The report holds
// identity and result metadata only; it never records ciphertext, nonces, tags,
// keys, or offer material.

import {
  REQUESTED_TOPICS,
  buildClientHello,
  buildSubscribeRequest,
  validateFrame,
  validateHelloAck,
  validateOffer,
  validateSubscribeAck,
  type Compatibility,
  type FailureLabel,
} from "./protocol.ts";
import { createInbox, type RelayTransport } from "./transport.ts";

export type HandshakeStage = "offer" | "hello" | "subscribe" | "frame" | "complete";

export interface CompatibilityReport {
  readonly compatibility: Compatibility;
  readonly stage: HandshakeStage;
  readonly failure?: FailureLabel;
  readonly hostId?: string;
  readonly relayId?: string;
  readonly topics?: readonly string[];
  readonly framesValidated: number;
}

/** Number of pinned frames the tracer validates before declaring the frame subset compatible. */
const FRAMES_TO_TRACE = 2;

export async function traceRelayCompatibility({
  transport,
  offer,
}: {
  transport: RelayTransport;
  offer: unknown;
}): Promise<CompatibilityReport> {
  // Stage 1: validate the imported offer before connecting or sending anything.
  const offerResult = validateOffer(offer);
  if (!offerResult.ok) {
    return { compatibility: offerResult.compatibility, stage: "offer", failure: offerResult.failure, framesValidated: 0 };
  }
  const hostId = offerResult.value.host.id;

  const inbox = createInbox(transport);
  try {
    // Stage 2: hello handshake.
    transport.send(buildClientHello());
    const helloInbound = await inbox.next();
    if (helloInbound.closed) {
      return { compatibility: "unsupported", stage: "hello", failure: "TRANSPORT CLOSED", hostId, framesValidated: 0 };
    }
    const helloResult = validateHelloAck(helloInbound.message);
    if (!helloResult.ok) {
      return { compatibility: helloResult.compatibility, stage: "hello", failure: helloResult.failure, hostId, framesValidated: 0 };
    }
    const relayId = helloResult.value.relay.id;

    // Stage 3: subscription.
    transport.send(buildSubscribeRequest());
    const subscribeInbound = await inbox.next();
    if (subscribeInbound.closed) {
      return { compatibility: "unsupported", stage: "subscribe", failure: "TRANSPORT CLOSED", hostId, relayId, framesValidated: 0 };
    }
    const subscribeResult = validateSubscribeAck(subscribeInbound.message, REQUESTED_TOPICS);
    if (!subscribeResult.ok) {
      return { compatibility: subscribeResult.compatibility, stage: "subscribe", failure: subscribeResult.failure, hostId, relayId, framesValidated: 0 };
    }

    // Stage 4: E2EE frame envelope subset (framing only, never decrypted).
    let previousSeq = 0;
    let framesValidated = 0;
    while (framesValidated < FRAMES_TO_TRACE) {
      const frameInbound = await inbox.next();
      if (frameInbound.closed) {
        return { compatibility: "unsupported", stage: "frame", failure: "TRANSPORT CLOSED", hostId, relayId, topics: [...REQUESTED_TOPICS], framesValidated };
      }
      const frameResult = validateFrame(frameInbound.message, previousSeq);
      if (!frameResult.ok) {
        return { compatibility: frameResult.compatibility, stage: "frame", failure: frameResult.failure, hostId, relayId, topics: [...REQUESTED_TOPICS], framesValidated };
      }
      previousSeq = frameResult.value.seq;
      framesValidated += 1;
    }

    return { compatibility: "supported", stage: "complete", hostId, relayId, topics: [...REQUESTED_TOPICS], framesValidated };
  } finally {
    inbox.dispose();
    transport.close();
  }
}
