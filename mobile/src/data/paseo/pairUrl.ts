// Tolerant pair-URL parser. PROVISIONAL: the exact field names come from the real
// Paseo pairing format — confirm and tighten once provided. Dependency-free (works in
// React Native and Node) so it is unit-testable without a URL polyfill.

export interface PairInfo {
  readonly raw: string;
  /** wss:// relay endpoint the client connects to. */
  readonly relayEndpoint?: string;
  /** Host identity to bind to. */
  readonly hostId?: string;
  /** Pairing secret/token/code (never logged). */
  readonly secret?: string;
}

function parseQuery(query: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const key = eq >= 0 ? pair.slice(0, eq) : pair;
    const value = eq >= 0 ? pair.slice(eq + 1) : "";
    try {
      out[decodeURIComponent(key)] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

function firstOf(source: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    if (source[key]) return source[key];
  }
  return undefined;
}

export function parsePairUrl(raw: string): PairInfo {
  const trimmed = String(raw ?? "").trim();
  const queryIndex = trimmed.indexOf("?");
  const base = queryIndex >= 0 ? trimmed.slice(0, queryIndex) : trimmed;
  const params = queryIndex >= 0 ? parseQuery(trimmed.slice(queryIndex + 1)) : {};

  const relayEndpoint = firstOf(params, ["relay", "endpoint", "ws", "url"])
    ?? (/^wss?:\/\//i.test(base) ? base : undefined);
  const hostId = firstOf(params, ["host", "hostId", "h"]);
  const secret = firstOf(params, ["token", "code", "key", "secret", "t"]);

  return { raw: trimmed, relayEndpoint, hostId, secret };
}
