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
