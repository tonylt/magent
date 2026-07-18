import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const productionRoot = join(root, "src", "production");
const rabbitBoundary = "src/production/platform/rabbit.ts";
const privateNames = [
  "CreationVoiceHandler",
  "creationStorage",
  "creationSensors",
  "onPluginMessage",
  "sttEnded",
  "scrollUp",
  "scrollDown",
  "sideClick",
  "longPressStart",
  "longPressEnd",
];

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(path);
  }
  return files;
}

const failures = [];
for (const path of await sourceFiles(productionRoot)) {
  const name = relative(root, path).split("\\").join("/");
  if (name === rabbitBoundary) continue;
  const source = await readFile(path, "utf8");
  for (const privateName of privateNames) {
    if (source.includes(privateName)) failures.push(`${name}: private Rabbit identifier ${privateName}`);
  }
}

const metafile = JSON.parse(await readFile(join(root, "artifacts", "production-metafile.json"), "utf8"));
for (const input of Object.keys(metafile.inputs)) {
  if (!input.startsWith("src/production/") || input.includes("../")) {
    failures.push(`bundle input outside src/production: ${input}`);
  }
}
for (const [output, details] of Object.entries(metafile.outputs)) {
  for (const imported of details.imports ?? []) {
    if (imported.external) failures.push(`${output}: external import ${imported.path}`);
    if (imported.kind === "dynamic-import") failures.push(`${output}: dynamic import ${imported.path}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Production source boundary verified (${Object.keys(metafile.inputs).length} bundle inputs).`);
}
