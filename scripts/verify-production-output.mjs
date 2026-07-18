import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "dist", "production");
const expectedNames = ["app.js", "budgets.json", "build-meta.json", "index.html", "styles.css"];
const actualNames = (await readdir(output)).sort();
const failures = [];

if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
  failures.push(`output whitelist mismatch: ${actualNames.join(", ")}`);
}

const budgets = JSON.parse(await readFile(join(output, "budgets.json"), "utf8"));
const meta = JSON.parse(await readFile(join(output, "build-meta.json"), "utf8"));
if (meta.schema !== 1 || typeof meta.version !== "string" || meta.entry !== "app.js") {
  failures.push("build-meta header is invalid");
}
if (JSON.stringify(Object.keys(meta).sort()) !== JSON.stringify(["entry", "files", "schema", "version"])) {
  failures.push("build-meta contains non-deterministic or unknown fields");
}

let totalBytes = 0;
for (const name of actualNames) {
  const bytes = (await stat(join(output, name))).size;
  totalBytes += bytes;
  if (bytes > budgets.maxSingleFileBytes) failures.push(`${name}: exceeds single-file budget`);
  if (name.endsWith(".js") && bytes > budgets.maxJavaScriptBytes) failures.push(`${name}: exceeds JavaScript budget`);
  if (name.endsWith(".css") && bytes > budgets.maxCssBytes) failures.push(`${name}: exceeds CSS budget`);
}
if (totalBytes > budgets.maxStaticBytes) failures.push(`static output ${totalBytes} exceeds ${budgets.maxStaticBytes}`);

for (const file of meta.files ?? []) {
  const content = await readFile(join(output, file.name));
  const digest = createHash("sha256").update(content).digest("hex");
  if (content.byteLength !== file.bytes || digest !== file.sha256) {
    failures.push(`${file.name}: build-meta digest mismatch`);
  }
}
const declaredNames = (meta.files ?? []).map((file) => file.name).sort();
const hashedNames = actualNames.filter((name) => name !== "build-meta.json");
if (JSON.stringify(declaredNames) !== JSON.stringify(hashedNames)) {
  failures.push("build-meta file list does not match output");
}

for (const name of actualNames.filter((file) => /\.(?:html|css|js)$/.test(file))) {
  const source = await readFile(join(output, name), "utf8");
  if (/https?:\/\/|\/\/cdn(?:\.|\/)/i.test(source)) failures.push(`${name}: remote dependency found`);
  if (/\bimport\s*\(/.test(source)) failures.push(`${name}: dynamic import found`);
}

const html = await readFile(join(output, "index.html"), "utf8");
const csp = html.match(/Content-Security-Policy" content="([^"]+)"/i)?.[1] ?? "";
for (const directive of ["default-src 'none'", "script-src 'self'", "style-src 'self'"]) {
  if (!csp.includes(directive)) failures.push(`index.html: CSP missing ${directive}`);
}
if (/unsafe-inline|unsafe-eval/i.test(csp)) failures.push("index.html: unsafe CSP directive");
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const reference = match[1];
  if (!reference.startsWith("./")) failures.push(`index.html: non-local reference ${reference}`);
  else if (!actualNames.includes(reference.slice(2))) failures.push(`index.html: missing reference ${reference}`);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Production output verified (${totalBytes} / ${budgets.maxStaticBytes} bytes, 0 remote dependencies).`);
}
