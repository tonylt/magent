# Creation Probe Demo

Serve the worktree root:

```bash
npx serve . -l 4173
```

Then open:

- App: `http://localhost:4173/demo/`
- Install page: `http://localhost:4173/demo/install.html`

Desktop controls:

- Arrow Up/Down: simulate wheel
- Enter: simulate side click
- Hold/release Space: simulate side-button PTT and return a mock transcript
- Escape/Backspace: back

## Automated verification

Install the locked development tools and run the complete S01 verification suite:

```bash
npm ci
npm run verify
```

The suite covers deterministic semantic input and gesture races, the Rabbit bridge adapter, the pure probe store, sanitized bounded diagnostics, declared static/DOM/log budgets, fixed 240x282 screenshots, lifecycle interruption/resume, and browser console/request errors.

Use `?debug=1` only during local probe development to expose a read-only snapshot of the sanitized diagnostic ring. It does not expose the probe store, transcript, errors, URLs, credentials, or bridge payloads.

S01 uses a 500ms late-click suppression fixture. It is not a RabbitOS guarantee; S02 must measure and record the value for the tested firmware before release behavior is fixed.

For a real R1, expose the same server over HTTPS or deploy `demo/` to static hosting. Open `install.html` from that HTTPS origin and scan its QR. Increment `?v=1` in `install.html` after deployments to bypass the RabbitOS Creation URL cache.

## GitHub Pages (recommended for owned-R1 install)

GitHub Pages gives the probe a publicly trusted HTTPS certificate, so the R1 WebView
loads it without a self-signed CA. A LAN self-signed cert is rejected by the WebView
and shows a black screen — confirmed as H19. The probe holds no secrets and reaches no
daemon, so public static hosting is safe; production Relay transport stays separate.

One-time setup:

1. Create a GitHub repo and push this project:
   ```bash
   git remote add origin git@github.com:<you>/<repo>.git
   git push -u origin main
   ```
2. In the repo, open **Settings → Pages** and set **Source: GitHub Actions**.
3. The `Deploy to GitHub Pages` workflow publishes the probe (`demo/`) at the site root
   and the immutable production release under `/r1/v<version>/` on each push to
   `main` (or run it manually from the Actions tab).

Then, per device:

1. Open `https://<you>.github.io/<repo>/install.html` on any browser and scan the QR
   with the R1. Bump `?v=` in `install.html` after each deploy to bust the Creation
   URL cache (H02).
2. Add `?evidence=1` to the app URL to expose the `window.__probeEvidence` capture
   hook, then run the `S02-HARDWARE-UAT.md` matrix (H01–H24) and store redacted
   evidence under `artifacts/hardware/s02/`.

## Real R1 over LAN HTTPS (alternative)

RabbitOS Creations install only from an HTTPS origin, so LAN testing needs a
certificate. The host and the R1 must be on the same network.

```bash
# 1. Find the host LAN IP (e.g. 192.168.1.23), then mint a self-signed cert for it.
scripts/make-dev-cert.sh 192.168.1.23

# 2. Serve the repo over HTTPS on 0.0.0.0:4173 (prints the LAN URLs).
npm run serve:lan
```

Then:

1. Install `certs/dev-cert.pem` as a trusted CA on the R1. Whether RabbitOS honors a
   user-installed CA is exactly what UAT item **H19** measures — record the result.
   If the WebView refuses the self-signed CA, fall back to a certificate the device
   already trusts (a private CA provisioned on the device, or a real cert for a LAN
   hostname). Never disable certificate validation.
2. On the host browser, open `https://<lan-ip>:4173/demo/install.html` and scan the QR
   from the R1. Bump `?v=` in `install.html` after each deploy to bust the Creation
   URL cache (**H02**).
3. Run the `S02-HARDWARE-UAT.md` matrix (H01–H24) and store redacted evidence under
   `artifacts/hardware/s02/`. Install with `?evidence=1` to expose the sanitized
   capture hook `window.__probeEvidence` (see the matrix doc for usage); its export is
   allowlist-validated and payload-free.

Notes and boundaries:

- `install.html` runs on the host browser only; the R1 just scans the resulting QR.
  Its QR library is still loaded from a CDN — a release-hygiene item for S12, not a
  blocker for LAN testing.
- `serve:lan` is a static, unauthenticated, LAN-only dev tool. Never expose it to the
  public internet, and do not tunnel it publicly without explicit approval.
- `certs/` is git-ignored; do not commit private keys.
- Complete the firmware and security-capability gate before importing a Relay offer,
  reading a Device grant, or requesting Paseo data.
