import type {
  DiagnosticCode,
  DiagnosticEntry,
  DiagnosticType,
  ProductionDiagnostics,
} from "./contracts.ts";

export function createBoundedDiagnostics({
  maxEntries = 64,
  maxBytes = 16 * 1024,
}: {
  maxEntries?: number;
  maxBytes?: number;
} = {}): ProductionDiagnostics {
  const entries: DiagnosticEntry[] = [];
  let sequence = 0;

  function trim(): void {
    while (entries.length > maxEntries || JSON.stringify(entries).length > maxBytes) entries.shift();
  }

  return {
    record(type: DiagnosticType, code: DiagnosticCode): void {
      entries.push({ sequence: ++sequence, type, code });
      trim();
    },
    snapshot(): readonly DiagnosticEntry[] {
      return entries.map((entry) => ({ ...entry }));
    },
  };
}
