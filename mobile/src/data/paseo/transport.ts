// WebSocket transport for the daemon/relay connection. Uses the global WebSocket
// available in both React Native and web. Protocol-agnostic: it moves opaque JSON
// frames; the PaseoClient codec (client.ts) owns the actual message format.

export type TransportStatus = "connecting" | "open" | "closed";

export interface RelayTransport {
  send(message: unknown): void;
  onMessage(listener: (message: unknown) => void): () => void;
  onStatus(listener: (status: TransportStatus) => void): () => void;
  close(): void;
  readonly status: TransportStatus;
}

export function createWebSocketTransport(endpoint: string): RelayTransport {
  const socket = new WebSocket(endpoint);
  const messageListeners = new Set<(message: unknown) => void>();
  const statusListeners = new Set<(status: TransportStatus) => void>();
  let status: TransportStatus = "connecting";

  function setStatus(next: TransportStatus) {
    status = next;
    for (const listener of statusListeners) listener(next);
  }

  socket.onopen = () => setStatus("open");
  socket.onclose = () => setStatus("closed");
  socket.onerror = () => setStatus("closed");
  socket.onmessage = (event: MessageEvent) => {
    let parsed: unknown = event.data;
    if (typeof event.data === "string") {
      try {
        parsed = JSON.parse(event.data);
      } catch {
        parsed = event.data;
      }
    }
    for (const listener of messageListeners) listener(parsed);
  };

  return {
    get status() {
      return status;
    },
    send(message: unknown) {
      socket.send(typeof message === "string" ? message : JSON.stringify(message));
    },
    onMessage(listener) {
      messageListeners.add(listener);
      return () => messageListeners.delete(listener);
    },
    onStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    close() {
      try {
        socket.close();
      } catch {
        // best-effort
      }
    },
  };
}
