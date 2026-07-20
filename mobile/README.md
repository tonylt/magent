# Paseo Mobile Companion (M002)

An Expo/React Native MVP that reimagines Paseo's mobile UX for away-from-desk triage
and intervention: attention-first Home, a three-step glance → open Agent → Follow-up
loop, mobile ergonomics (large targets, dictation), and always-visible freshness and
safety state. See `../.gsd/milestones/M002/M002-PRD.md`.

Currently ships deterministic mock Paseo data behind a `PaseoRepository` interface;
M2-S05 wires the same interface to the daemon over the Relay contract.

## Run

```bash
cd mobile
npm install            # first time only
npm start              # Expo dev server; scan the QR with Expo Go (iOS/Android)
# or
npm run ios            # iOS simulator (macOS + Xcode)
npm run android        # Android emulator
npm run web            # react-native-web preview in a browser
```

## Verify

```bash
npm run typecheck      # tsc --noEmit
npm test               # pure domain/selector unit tests (Node)
```

## Structure

- `src/theme.ts` — dark, high-contrast mobile design tokens.
- `src/domain/` — pure types + selectors (attention ranking, freshness, target-bound
  Draft), unit-tested with Node. No React Native imports.
- `src/data/` — `PaseoRepository` interface, mock data, and the shared instance.
- `src/components/` — `AttentionCard`, `FreshnessBadge`, `ReasonPill`.
- `src/screens/` — Attention Home (flagship), Workspaces, Agent timeline, Follow-up
  Composer (dictation + review, never auto-sends), Permission read-only handoff.
- `App.tsx` — native-stack navigation with a dark theme.

## Conventions

- App/UI/domain source use extension-less imports (Metro/tsc friendly). Test files use
  explicit `.ts` (Node ESM) and are excluded from `tsconfig`.
- Controlled actions are gated on `live` freshness; Drafts are bound to their Agent.
- Permission is a read-only handoff — the app never approves or denies.
