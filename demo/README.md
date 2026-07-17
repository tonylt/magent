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

For a real R1, expose the same server over HTTPS or deploy `demo/` to static hosting. Open `install.html` from that HTTPS origin and scan its QR. Increment `?v=1` in `install.html` after deployments to bypass the RabbitOS Creation URL cache.
