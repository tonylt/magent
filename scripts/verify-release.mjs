import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { computeReleaseDigest } from "./lib/release.mjs";

// Re-verify an immutable versioned release independently of how it was built.

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const version = String(packageJson.version);
const releaseDir = join(root, "dist", "r1", `v${version}`);
const failures = [];

let manifest;
try {
  manifest = JSON.parse(await readFile(join(releaseDir, "release.json"), "utf8"));
} catch {
  console.error(`Missing ${join("dist", "r1", `v${version}`, "release.json")}. Run \`npm run release\` first.`);
  process.exit(1);
}

if (manifest.path !== `/r1/v${version}/`) failures.push(`manifest path is not the immutable versioned path: ${manifest.path}`);

// Per-file digests must match the bytes on disk.
for (const file of manifest.files) {
  try {
    const content = await readFile(join(releaseDir, file.name));
    const digest = createHash("sha256").update(content).digest("hex");
    if (content.byteLength !== file.bytes || digest !== file.sha256) {
      failures.push(`${file.name}: digest/bytes mismatch`);
    }
  } catch {
    failures.push(`${file.name}: missing from release`);
  }
}

// The manifest file list must match the release directory (excluding release.json).
const present = (await readdir(releaseDir)).filter((name) => name !== "release.json").sort();
const declared = manifest.files.map((file) => file.name).sort();
if (JSON.stringify(present) !== JSON.stringify(declared)) {
  failures.push(`release contents ${present.join(", ")} do not match manifest ${declared.join(", ")}`);
}

// The overall release digest must recompute.
if (computeReleaseDigest(manifest.files) !== manifest.releaseDigest) failures.push("release digest does not recompute");

// Strict CSP must be present.
for (const directive of ["default-src 'none'", "script-src 'self'", "style-src 'self'"]) {
  if (!manifest.csp.includes(directive)) failures.push(`CSP missing ${directive}`);
}
if (manifest.csp.some((directive) => /unsafe-inline|unsafe-eval/i.test(directive))) failures.push("CSP has an unsafe directive");

// No remote or dynamic-import references in shipped assets.
for (const name of present.filter((file) => /\.(?:html|css|js)$/.test(file))) {
  const source = await readFile(join(releaseDir, name), "utf8");
  if (/https?:\/\/|\/\/cdn(?:\.|\/)/i.test(source)) failures.push(`${name}: remote dependency`);
  if (/\bimport\s*\(/.test(source)) failures.push(`${name}: dynamic import`);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Immutable release ${manifest.path} verified (${manifest.files.length} files, digest ${manifest.releaseDigest.slice(0, 12)}…).`);
}
