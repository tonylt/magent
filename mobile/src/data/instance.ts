import * as SecureStore from "expo-secure-store";

import { createMockRepository, type PaseoRepository } from "./repository";
import { connectDaemonRepository, redactSecrets } from "./paseo/daemon";

// The pairing offer is sensitive: store it only in the OS-encrypted keystore
// (Keychain/Keystore), never plain storage or logs.
const OFFER_KEY = "paseo.offer";

// Lightweight module store: holds the active repository (mock or daemon) plus the
// connection state, and notifies subscribers. Screens read getRepository() at load
// time; the Attention Home reloads on focus after a connection change.

export type Connection =
  | { readonly mode: "mock" }
  | { readonly mode: "connecting" }
  | { readonly mode: "online"; readonly hostName: string }
  | { readonly mode: "error"; readonly message: string };

let repository: PaseoRepository = createMockRepository();
let connection: Connection = { mode: "mock" };
let daemonClose: (() => void) | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

let cachedClientId: string | null = null;
function clientId(): string {
  if (cachedClientId) return cachedClientId;
  const uuid = globalThis.crypto?.randomUUID?.();
  cachedClientId = uuid ?? `paseo-mobile-${Math.random().toString(36).slice(2)}`;
  return cachedClientId;
}

export function getRepository(): PaseoRepository {
  return repository;
}

export function getConnection(): Connection {
  return connection;
}

export function subscribeConnection(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function connectWithOffer(pairUrl: string): Promise<void> {
  connection = { mode: "connecting" };
  notify();
  try {
    daemonClose?.();
    daemonClose = null;
    const conn = await connectDaemonRepository(pairUrl, { clientId: clientId(), appVersion: "m002-mvp" });
    repository = conn.repository;
    daemonClose = conn.close;
    connection = { mode: "online", hostName: conn.hostName };
    notify();
    // Persist the offer (encrypted) so we can auto-reconnect on next launch.
    void SecureStore.setItemAsync(OFFER_KEY, pairUrl).catch(() => {});
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : String(error));
    connection = { mode: "error", message };
    notify();
    throw new Error(message);
  }
}

let restored = false;
/** On launch, reconnect from the stored offer (if any). Safe to call repeatedly. */
export async function restoreConnection(): Promise<void> {
  if (restored) return;
  restored = true;
  try {
    const saved = await SecureStore.getItemAsync(OFFER_KEY);
    if (saved) await connectWithOffer(saved);
  } catch {
    // connectWithOffer already recorded an error state; stay recoverable.
  }
}

export function useMockData(): void {
  daemonClose?.();
  daemonClose = null;
  repository = createMockRepository();
  connection = { mode: "mock" };
  notify();
  void SecureStore.deleteItemAsync(OFFER_KEY).catch(() => {});
}
