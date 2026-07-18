// Pure builders for the vendored production install page. The QR SVG is generated at
// build time (see package-release.mjs) from a bundled, pinned encoder, so the page
// needs no runtime CDN and no scripts at all - it is inline SVG only, which keeps a
// strict Content-Security-Policy.

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]
  ));
}

/** The RabbitOS Creation install payload encoded into the QR. */
export function buildInstallPayload({ version, appUrl }) {
  if (!/^\d+\.\d+\.\d+$/.test(String(version ?? ""))) throw new Error(`version must be semver, got ${version}`);
  if (!/^https:\/\//.test(String(appUrl ?? ""))) throw new Error(`appUrl must be https, got ${appUrl}`);
  return {
    title: `Paseo R1 v${version}`,
    url: String(appUrl),
    description: "Rabbit R1 Paseo companion",
    iconUrl: "",
    themeColor: "#FF4F18",
  };
}

/**
 * Render a self-contained, script-free install page with a strict CSP and an inline
 * SVG QR. `qrSvg` is trusted markup produced by the pinned build-time encoder.
 */
export function renderInstallHtml({ version, appUrl, qrSvg }) {
  if (!/^\d+\.\d+\.\d+$/.test(String(version ?? ""))) throw new Error(`version must be semver, got ${version}`);
  if (!/^https:\/\//.test(String(appUrl ?? ""))) throw new Error(`appUrl must be https, got ${appUrl}`);
  if (typeof qrSvg !== "string" || !qrSvg.includes("<svg")) throw new Error("qrSvg must be inline SVG markup");
  if (/<script/i.test(qrSvg)) throw new Error("qrSvg must not contain a script");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; base-uri 'none'; form-action 'none'">
  <title>Install Paseo R1 v${escapeHtml(version)}</title>
</head>
<body>
  <main>
    <h1>Paseo R1 v${escapeHtml(version)}</h1>
    <p>Scan with Rabbit R1 Creations to install this immutable release.</p>
    <figure aria-label="Install QR code">${qrSvg}</figure>
    <p>Release URL:</p>
    <code>${escapeHtml(appUrl)}</code>
  </main>
</body>
</html>
`;
}
