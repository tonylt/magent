// Relay transport boundary. This isolates the unstable socket SDK from the pinned
// compatibility tracer. Production S05 supplies a real WSS/E2EE transport; tests
// and fixtures supply a deterministic scripted transport. No real network here.

export interface RelayTransport {
  send(message: unknown): void;
  receive(listener: (message: unknown) => void): () => void;
  onClose(listener: () => void): () => void;
  close(): void;
}

export interface ScriptedTransport extends RelayTransport {
  /** Messages the tracer has sent, for asserting fail-closed behavior. */
  readonly sent: readonly unknown[];
}

export interface ScriptedTransportScript {
  /** Inbound messages delivered, in order, after the tracer subscribes. */
  readonly inbound: readonly unknown[];
  /** When true, the transport closes after delivering all inbound messages. */
  readonly closeAfterInbound?: boolean;
}

/**
 * A deterministic transport that replays a fixed inbound script. All inbound
 * messages are delivered on a microtask once the tracer subscribes, so the async
 * tracer runs without fake timers or real sockets.
 */
export function createScriptedTransport(script: ScriptedTransportScript): ScriptedTransport {
  const sent: unknown[] = [];
  let messageListener: ((message: unknown) => void) | null = null;
  let closeListener: (() => void) | null = null;
  let delivered = false;
  let closed = false;

  function deliver(): void {
    if (delivered || closed) return;
    delivered = true;
    for (const message of script.inbound) {
      if (closed) return;
      messageListener?.(message);
    }
    if (script.closeAfterInbound) {
      closed = true;
      closeListener?.();
    }
  }

  return {
    sent,
    send(message: unknown): void {
      if (closed) return;
      sent.push(message);
    },
    receive(listener: (message: unknown) => void): () => void {
      messageListener = listener;
      queueMicrotask(deliver);
      return () => {
        if (messageListener === listener) messageListener = null;
      };
    },
    onClose(listener: () => void): () => void {
      closeListener = listener;
      return () => {
        if (closeListener === listener) closeListener = null;
      };
    },
    close(): void {
      if (closed) return;
      closed = true;
      closeListener?.();
    },
  };
}

export interface Inbox {
  next(): Promise<Readonly<{ closed: false; message: unknown }> | Readonly<{ closed: true }>>;
  dispose(): void;
}

/** Buffers inbound messages and close signals so the tracer can await them in order. */
export function createInbox(transport: RelayTransport): Inbox {
  const buffer: unknown[] = [];
  const waiters: ((value: { closed: false; message: unknown } | { closed: true }) => void)[] = [];
  let closed = false;

  const unsubscribeMessages = transport.receive((message) => {
    const waiter = waiters.shift();
    if (waiter) waiter({ closed: false, message });
    else buffer.push(message);
  });
  const unsubscribeClose = transport.onClose(() => {
    closed = true;
    while (waiters.length > 0) waiters.shift()?.({ closed: true });
  });

  return {
    next() {
      if (buffer.length > 0) return Promise.resolve({ closed: false as const, message: buffer.shift() });
      if (closed) return Promise.resolve({ closed: true as const });
      return new Promise((resolve) => waiters.push(resolve));
    },
    dispose() {
      unsubscribeMessages();
      unsubscribeClose();
    },
  };
}
