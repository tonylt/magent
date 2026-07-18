import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "src", "production");
const distRoot = join(root, "dist");
const output = join(distRoot, "production");
const backup = join(distRoot, ".production-previous");
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

await mkdir(distRoot, { recursive: true });
const temporary = await mkdtemp(join(distRoot, ".production-tmp-"));

try {
  const result = await build({
    entryPoints: [join(source, "main.ts")],
    outfile: join(temporary, "app.js"),
    bundle: true,
    platform: "browser",
    format: "esm",
    target: "es2020",
    minify: true,
    treeShaking: true,
    sourcemap: false,
    legalComments: "none",
    charset: "utf8",
    metafile: true,
  });

  for (const name of ["index.html", "styles.css", "budgets.json"]) {
    await copyFile(join(source, name), join(temporary, name));
  }

  const files = [];
  for (const name of (await readdir(temporary)).sort()) {
    const content = await readFile(join(temporary, name));
    files.push({
      name,
      bytes: (await stat(join(temporary, name))).size,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  }
  await writeFile(join(temporary, "build-meta.json"), `${JSON.stringify({
    schema: 1,
    version: String(packageJson.version),
    entry: "app.js",
    files,
  }, null, 2)}\n`);

  const metafilePath = join(root, "artifacts", "production-metafile.json");
  await mkdir(dirname(metafilePath), { recursive: true });
  const normalizedMetafile = JSON.parse(JSON.stringify(result.metafile));
  const normalizedInputs = {};
  for (const [input, value] of Object.entries(normalizedMetafile.inputs)) {
    normalizedInputs[relative(root, input).split("\\").join("/")] = value;
  }
  normalizedMetafile.inputs = normalizedInputs;
  await writeFile(metafilePath, `${JSON.stringify(normalizedMetafile, null, 2)}\n`);

  await rm(backup, { recursive: true, force: true });
  let movedExistingOutput = false;
  try {
    await rename(output, backup);
    movedExistingOutput = true;
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  }
  try {
    await rename(temporary, output);
  } catch (publishError) {
    if (movedExistingOutput) {
      try {
        await rename(backup, output);
      } catch (restoreError) {
        throw new AggregateError([publishError, restoreError], "Production publish and rollback failed");
      }
    }
    throw publishError;
  }
  await rm(backup, { recursive: true, force: true });
} catch (error) {
  await rm(temporary, { recursive: true, force: true });
  throw error;
}
