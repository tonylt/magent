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

// The manifest file list must match the release directory (excluding release-level
// extras: the manifest itself and the vendored install page).
const RELEASE_EXTRAS = new Set(["release.json", "install.html"]);
const present = (await readdir(releaseDir)).filter((name) => !RELEASE_EXTRAS.has(name)).sort();
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

// No remote or dynamic-import references in shipped bundle assets (blunt scan is safe:
// the bundle must contain no URLs at all).
for (const name of present.filter((file) => /\.(?:html|css|js)$/.test(file))) {
  const source = await readFile(join(releaseDir, name), "utf8");
  if (/https?:\/\/|\/\/cdn(?:\.|\/)/i.test(source)) failures.push(`${name}: remote dependency`);
  if (/\bimport\s*\(/.test(source)) failures.push(`${name}: dynamic import`);
}

// The vendored install page must be script-free, reference no external resources, and
// carry its own strict CSP. Its inline SVG namespace and the release URL are content,
// not fetched resources, so scan for actual resource references only.
try {
  const install = await readFile(join(releaseDir, "install.html"), "utf8");
  if (/<script\b/i.test(install)) failures.push("install.html: contains a script");
  if (/(?:src|href)\s*=\s*["']https?:/i.test(install)) failures.push("install.html: external resource reference");
  if (/@import|url\(\s*["']?https?:/i.test(install)) failures.push("install.html: external style reference");
  if (!/Content-Security-Policy/i.test(install) || !/default-src 'none'/.test(install)) {
    failures.push("install.html: missing strict CSP");
  }
  if (!/<svg\b/i.test(install)) failures.push("install.html: missing inline QR SVG");
} catch {
  failures.push("install.html: missing from release");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Immutable release ${manifest.path} verified (${manifest.files.length} files, digest ${manifest.releaseDigest.slice(0, 12)}…).`);
}
