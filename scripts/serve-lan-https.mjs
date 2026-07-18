// LAN HTTPS static server for S02 owned-R1 probe testing.
//
// Serves the repository's static probe assets (demo/ and dist/) over HTTPS on the
// local network so a RabbitOS Creation can install from a trusted-origin URL. This
// is a development/LAN tool only:
//   - static files only, no daemon, no secrets, no write endpoints;
//   - no authentication — bind to the LAN, never expose it to the public internet;
//   - production transport to the Paseo daemon remains Relay E2EE, not this server.
//
// Requires a certificate from scripts/make-dev-cert.sh. Usage: npm run serve:lan
// (optional PORT env, default 4173).

import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { dirname, extname, join, normalize, sep } from "node:path";
import { createServer } from "node:https";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const certDir = join(root, "certs");
const port = Number(process.env.PORT ?? 4173);

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

let key;
let cert;
try {
  [key, cert] = await Promise.all([
    readFile(join(certDir, "dev-key.pem")),
    readFile(join(certDir, "dev-cert.pem")),
  ]);
} catch {
  console.error("Missing certs/dev-key.pem or certs/dev-cert.pem.");
  console.error("Run: scripts/make-dev-cert.sh <lan-ip> first.");
  process.exit(1);
}

function resolveFile(pathname) {
  let requested = decodeURIComponent(pathname);
  if (requested.endsWith("/")) requested += "index.html";
  const filePath = normalize(join(root, requested));
  // Prevent path traversal outside the repository root.
  if (filePath !== root && !filePath.startsWith(root + sep)) return null;
  return filePath;
}

const server = createServer({ key, cert }, (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "content-type": "text/plain" });
    res.end("Method Not Allowed");
    return;
  }
  const url = new URL(req.url ?? "/", "https://localhost");
  const filePath = resolveFile(url.pathname);
  if (!filePath) {
    res.writeHead(403, { "content-type": "text/plain" });
    res.end("Forbidden");
    return;
  }
  stat(filePath)
    .then((info) => {
      if (!info.isFile()) {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("Not Found");
        return;
      }
      res.writeHead(200, {
        "content-type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      createReadStream(filePath).pipe(res);
    })
    .catch(() => {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not Found");
    });
});

server.listen(port, "0.0.0.0", () => {
  const addresses = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family === "IPv4" && !ni.internal) addresses.push(ni.address);
    }
  }
  console.log(`LAN HTTPS probe server on port ${port} (static, no auth — LAN only, never expose to the internet).`);
  if (addresses.length === 0) {
    console.log(`  https://127.0.0.1:${port}/demo/install.html`);
  }
  for (const address of addresses) {
    console.log(`  app:     https://${address}:${port}/demo/`);
    console.log(`  install: https://${address}:${port}/demo/install.html`);
  }
});
