import { createHash } from "node:crypto";

// Pure helpers for the immutable audited Creation release manifest. No filesystem
// or network access here, so the logic is unit-testable in isolation.

const CSP_META = /http-equiv=["']Content-Security-Policy["']\s+content="([^"]+)"/i;

/** Deterministic release digest: sha256 over the sorted "name:sha256" lines. */
export function computeReleaseDigest(files) {
  const lines = [...files]
    .map((file) => `${file.name}:${file.sha256}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(lines).digest("hex");
}

/** Extract CSP directives from an index.html meta tag as a normalized list. */
export function extractCspDirectives(html) {
  const match = String(html).match(CSP_META);
  if (!match) return [];
  return match[1]
    .split(";")
    .map((directive) => directive.trim())
    .filter((directive) => directive.length > 0);
}

/** Build the immutable release manifest from verified build output metadata. */
export function buildReleaseManifest({ version, entry, files, html }) {
  if (!/^\d+\.\d+\.\d+$/.test(String(version ?? ""))) {
    throw new Error(`version must be semver x.y.z, got ${version}`);
  }
  if (!Array.isArray(files) || files.length === 0) throw new Error("files must be a non-empty array");
  for (const file of files) {
    if (typeof file.name !== "string" || !/^[a-f0-9]{64}$/.test(String(file.sha256))) {
      throw new Error(`invalid file entry: ${JSON.stringify(file)}`);
    }
  }
  const sorted = [...files]
    .map((file) => ({ name: file.name, bytes: file.bytes, sha256: file.sha256 }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    schema: 1,
    version: String(version),
    path: `/r1/v${version}/`,
    entry,
    releaseDigest: computeReleaseDigest(sorted),
    csp: extractCspDirectives(html),
    files: sorted,
  };
}
