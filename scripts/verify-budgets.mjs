import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const budgetsPath = path.join(root, "demo", "budgets.json");
const budgets = JSON.parse(await readFile(budgetsPath, "utf8"));
const entry = path.resolve(root, budgets.assets.entry);
const remoteReferences = [];
const assets = new Map();

function isRemote(reference) {
  return /^(?:https?:)?\/\//i.test(reference);
}

function normalizeReference(reference, owner) {
  const clean = reference.trim().replace(/[?#].*$/, "");
  if (!clean || clean.startsWith("#") || clean.startsWith("data:") || clean.startsWith("blob:")) return null;
  if (isRemote(clean)) {
    remoteReferences.push({ owner: path.relative(root, owner), reference: clean });
    return null;
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(clean)) return null;

  const resolved = path.resolve(path.dirname(owner), clean);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${path.relative(root, owner)} references an asset outside the repository: ${reference}`);
  }
  return resolved;
}

function referencesFor(file, source) {
  const extension = path.extname(file).toLowerCase();
  const references = [];
  let match;

  if (extension === ".html") {
    const attribute = /<(?:script|link|img|source)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
    while ((match = attribute.exec(source))) references.push(match[1]);
  } else if (extension === ".js" || extension === ".mjs") {
    const moduleImport = /(?:\bimport\s*(?:[^"']*?\sfrom\s*)?|\bexport\s+[^"']*?\sfrom\s*|\bimport\s*\()\s*["']([^"']+)["']/g;
    while ((match = moduleImport.exec(source))) references.push(match[1]);
  } else if (extension === ".css") {
    const cssReference = /(?:@import\s+(?:url\()?|url\()\s*["']?([^"')\s]+)["']?\)?/gi;
    while ((match = cssReference.exec(source))) references.push(match[1]);
  }
  return references;
}

async function visit(file) {
  if (assets.has(file)) return;
  const metadata = await stat(file);
  if (!metadata.isFile()) throw new Error(`${path.relative(root, file)} is not a file`);
  assets.set(file, metadata.size);

  const extension = path.extname(file).toLowerCase();
  if (![".html", ".js", ".mjs", ".css"].includes(extension)) return;
  const source = await readFile(file, "utf8");
  for (const reference of referencesFor(file, source)) {
    const dependency = normalizeReference(reference, file);
    if (dependency) await visit(dependency);
  }
}

function sumBy(extensions) {
  return [...assets].reduce((total, [file, bytes]) => (
    extensions.has(path.extname(file).toLowerCase()) ? total + bytes : total
  ), 0);
}

function assertBudget(label, actual, limit) {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error(`invalid ${label} budget: ${limit}`);
  if (actual > limit) throw new Error(`${label} budget exceeded: ${actual} > ${limit} bytes`);
}

try {
  await visit(entry);
  const totalBytes = [...assets.values()].reduce((total, bytes) => total + bytes, 0);
  const javascriptBytes = sumBy(new Set([".js", ".mjs"]));
  const cssBytes = sumBy(new Set([".css"]));
  const largestAssetBytes = Math.max(0, ...assets.values());

  assertBudget("static total", totalBytes, budgets.assets.totalBytes);
  assertBudget("JavaScript", javascriptBytes, budgets.assets.javascriptBytes);
  assertBudget("CSS", cssBytes, budgets.assets.cssBytes);
  assertBudget("single asset", largestAssetBytes, budgets.assets.singleAssetBytes);
  assertBudget("remote runtime dependency", remoteReferences.length, budgets.assets.remoteRuntimeDependencies);

  console.log(`S01 asset budgets passed (${assets.size} assets, ${totalBytes} bytes total, ${javascriptBytes} JS, ${cssBytes} CSS).`);
} catch (error) {
  console.error(`S01 asset budget verification failed: ${error.message}`);
  process.exitCode = 1;
}

