import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildReleaseManifest } from "./lib/release.mjs";

// Package the verified S03 production bundle into an immutable, versioned release at
// dist/r1/v<version>/ with a release.json audit manifest. Additive: the existing
// dist/production output and its S03 verifications are untouched. Run after the build
// (npm run release runs the build first).

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "dist", "production");
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const version = String(packageJson.version);
const target = join(root, "dist", "r1", `v${version}`);

let meta;
try {
  meta = JSON.parse(await readFile(join(source, "build-meta.json"), "utf8"));
} catch {
  console.error("Missing dist/production/build-meta.json. Run `npm run build` first.");
  process.exit(1);
}

const html = await readFile(join(source, "index.html"), "utf8");
const manifest = buildReleaseManifest({
  version,
  entry: meta.entry,
  files: meta.files,
  html,
});

// Immutable: never replace an existing published version in place.
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const file of manifest.files) {
  await copyFile(join(source, file.name), join(target, file.name));
}
await writeFile(join(target, "release.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Packaged immutable release ${manifest.path} (digest ${manifest.releaseDigest.slice(0, 12)}…, ${manifest.files.length} files).`);
