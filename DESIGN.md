# Paseo for Rabbit R1 Design System

Version: 0.1  
Status: Proposed  
Target: RabbitOS Creation at a fixed 240x292 CSS pixel viewport

## 1. Visual Theme And Atmosphere

Paseo on Rabbit R1 is a **pocket task instrument**: quiet, immediate, and physical. It should feel like a purpose-built control surface rather than a phone application squeezed onto a small screen.

The interface takes three useful ideas from the reference design systems:

- OpenCode: terminal-like clarity, monospaced metadata, almost no decoration.
- Raycast: strong focus state, command-oriented rows, restrained dark surfaces.
- Nintendo 2001: hardware-aware interaction and clearly tactile selection, without copying its chrome or nostalgia.

Rabbit R1 contributes the memorable identity: a near-black screen inside a bright orange object. Orange is therefore a **physical action signal**, not a background theme. The display remains dark so the enclosure, wheel, and side button complete the composition.

### Design Principles

1. **One glance, one decision, with ownership.** The first screenful answers what needs attention and which host/project/workspace owns it.
2. **The wheel owns focus.** Exactly one actionable item is selected whenever a list is active.
3. **The side button changes mode.** In an Agent, hold creates a full-screen dictation state and click opens Actions. Outside an Agent, hold never guesses a target.
4. **Touch accelerates, never unlocks.** Every core flow works without precise touch.
5. **Status is structural.** Color, icon, label, and position reinforce each other.
6. **Detail is progressive.** The device shows summaries and decisions, not raw terminal exhaust.

## 2. Color Palette And Roles

```yaml
colors:
  canvas: "#090A0A"
  surface: "#101212"
  surface-raised: "#181B1A"
  surface-selected: "#20231F"
  hairline: "#2A2D2B"
  hairline-strong: "#454943"
  text: "#F4F2EC"
  text-secondary: "#B2B5AE"
  text-muted: "#7D827B"
  rabbit-orange: "#FF4F18"
  rabbit-orange-pressed: "#D83B0B"
  focus-fill: "#F4F2EC"
  focus-text: "#090A0A"
  lifecycle-running: "#F0B429"
  lifecycle-idle: "#8B918A"
  lifecycle-initializing: "#65B8FF"
  attention-needs-input: "#60D394"
  attention-permission: "#FF4F18"
  attention-finished: "#B2B5AE"
  error: "#FF6257"
  info: "#65B8FF"
```

### Rules

- `canvas` fills the whole viewport. No gradient, image, texture, orb, or decorative glow.
- `rabbit-orange` marks PTT, the active recording state, primary confirmation, and Paseo identity. It does not represent generic warnings.
- Lifecycle colors appear in small indicators and progress marks. Attention uses a separate text/shape marker; connection freshness uses header chrome. These dimensions are never collapsed into one color.
- The selected row uses an inverted light fill. This remains obvious in poor lighting and without color perception.
- Destructive confirmation uses `error` only after the action is explicitly selected.
- All text, including metadata, disabled reasons, and microcopy, must meet WCAG AA contrast against its actual surface. Disabled state may not be communicated by opacity alone.

## 3. Typography Rules

Use fonts already available in Android WebView. Do not load a remote font during startup.

First-release chrome uses short English labels. User-owned Project, Workspace, Agent, timeline, and transcript content remains UTF-8 and must render CJK with the WebView's installed fallback fonts. Chrome is explicitly marked as English; user-owned content inherits the device locale unless the source supplies a valid language tag. Never guess a content language from a short title.

```yaml
typography:
  ui:
    family: "system-ui, sans-serif"
  mono:
    family: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  title:
    size: 17px
    weight: 700
    line-height: 21px
    letter-spacing: 0
  row-title:
    size: 13px
    weight: 650
    line-height: 16px
    letter-spacing: 0
  body:
    size: 12px
    weight: 450
    line-height: 16px
    letter-spacing: 0
  metadata:
    size: 10px
    weight: 600
    line-height: 12px
    letter-spacing: 0
    family: mono
  micro:
    size: 9px
    weight: 650
    line-height: 11px
    letter-spacing: 0
```

### Rules

- Never scale type with viewport width.
- Use no negative letter spacing.
- Titles occupy at most two lines; rows occupy one title line and one metadata line.
- Truncate by semantic priority on the server before using visual ellipsis.
- Monospace is reserved for provider names, elapsed time, state, step counts, and identifiers.
- Do not render Markdown headings at heading scale inside activity content.
- Test CJK glyph coverage, line breaking, and ellipsis on the target firmware; never replace user content with transliteration to make it fit.

## 4. Spatial System

The application content viewport is exactly 240x292 CSS pixels.

```yaml
spacing:
  hairline: 1px
  xxs: 2px
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
radius:
  none: 0px
  sm: 3px
  md: 6px
```

### Frame

- Safe content inset: 8px left and right.
- Header: 36px fixed height.
- Footer/action rail: at least 44px fixed height when present.
- Main content: remaining height; never resize it because a row gains focus.
- Every touch target is at least 44px high and 44px wide. Visual rows remain 46px high.
- List row: 46px in every state, including when an attention label is present.
- Focus indicator: 2px left rail plus inverted row fill. It must not change row dimensions.
- The browser prototype's bezel, border, and shadow sit outside `#app`. With global `border-box`, `#app` still has a 240x292 content box; no decorative border may reduce it to 238x280.

## 5. Component Styling

### App Header

- Full-width unframed region, 36px tall.
- Left: page title or compact back button plus title.
- Header titles use the `row-title` token; the 17px `title` token is reserved for full-screen decisions and empty/recovery states.
- Right: connection indicator or position count.
- Bottom: 1px `hairline` divider.
- No logo lockup; a 3px orange rule at the top is sufficient Paseo identity.

### Workspace And Agent Rows

- Unframed list item separated by a hairline.
- Workspace first line: workspace title and optional attention mark. Second line: project, aggregate activity, elapsed time.
- Agent first line: lifecycle dot, title, optional attention mark. Second line: provider, lifecycle label, relationship (`ROOT`, `SUBAGENT`, or `READ ONLY`).
- Attention rows always show both workspace and agent title.
- Selected: `focus-fill` background, `focus-text`, 2px orange left rail.
- Lifecycle and attention are always expressed separately by shape plus word.
- If the attention-first directory response is truncated, Home inserts a focusable `MORE ATTENTION IN PASEO · n` sentinel after the materialized Attention rows and before ordinary Workspaces. Activating it loads the next bounded continuation page; loading or failure never removes the sentinel or permits an empty-Attention conclusion.

### Lifecycle And Attention Indicators

- 6px fixed circle, never animated continuously.
- Running may pulse twice when state changes, then becomes static.
- Error uses a diamond shape so it remains distinguishable without color.
- Attention appears as compact `REVIEW`, `FAILED`, or `FINISHED`; it never replaces lifecycle. Local Read state changes emphasis only and never appears as another Attention reason.
- Connection freshness is shown in the header using the canonical product states `LIVE`, `RECONNECTING`, `STALE`, or `AUTH REQUIRED`. Internal transport phases such as connecting, resubscribing, catch-up, and verifying never become a second public connection taxonomy; they appear as secondary progress copy under `RECONNECTING`.

### Activity Block

- Not a card. It is a full-width content band with a metadata line and bounded text.
- Tool activity uses a monospace leading symbol and a single-line summary.
- Assistant summary uses proportional body text, maximum six visible lines.
- Truncation ends with a visible `MORE ON PHONE` metadata label.

### Actions Entry And Action List

- Agent uses one fixed bottom command: `ACTIONS`. Wheel input continues to own timeline focus.
- Side click opens a full-height Action List; it never executes the currently visible timeline row.
- The Action List begins with a focusable Back item. `SUBAGENTS` is relationship navigation, not a controlled action. The controlled-action set contains at most Follow up, Review permission, and Stop; the list may therefore contain Back, Subagents, and the contextual controlled actions, and uses the same canonical-focus windowing contract as every other list.
- Destructive color appears only on the separate confirmation screen after intent is selected.
- Composer and Decision screens may use a fixed action rail because their entire content is already one focused task.

### Voice Overlay

- Replaces the full viewport; it is not a modal card.
- Black canvas, orange top rule, centered live level bars, `RECORDING` state, and release instruction.
- Release enters an explicit `TRANSCRIBING` state before complete Composer review.
- A transcription error returns to Composer as `voice-failed` without changing the existing draft. A successful retry appends its transcript.
- Composer paginates the complete transcript into stable, semantically broken pages. Wheel focus moves only among the visible rail commands. An unread non-final page exposes `BACK` when applicable, `CANCEL`, and `NEXT`; the first or last command is omitted when it has no destination. `SEND` appears only on the final page, after every preceding page has been visited, and `CANCEL` is selected by default on entry and after repagination. No page exposes more than three commands.
- The touch-free Composer path can review every transcript page, then Send or Cancel. Touch editing remains optional until the real-device keyboard is validated. Editing or appending text invalidates the prior read-through and returns review to the affected page with Send hidden until all pages are revisited.
- Recording animation uses at most five bars and `transform`; respect reduced motion.

### Permission Handoff

- Full-screen read-only handoff surface, not a modal.
- Request kind, shape completeness, operation name, affected target, reason, and detail completeness appear before workspace and Agent context and before the action rail.
- `CONTINUE IN PASEO` is status copy; the action rail contains only `BACK`.
- No Permission shape exposes Approve, Deny, or provider action options in the first Controlled Actions release.
- Unknown, malformed, truncated, or changed details retain the same `CONTINUE IN PASEO` status.

### Stop Confirmation

- Full-screen decision surface with `CANCEL` selected by default.
- Confirm snapshots an immutable `pendingTargetTurnId` and enters `STOPPING`; do not show stopped on RPC acceptance.
- Only an authoritative terminal event or snapshot matching `pendingTargetTurnId` may show stopped. A successor turn or mismatched acknowledgement yields `TURN CHANGED` and never changes that successor's lifecycle.
- Rejection or timeout returns to the Agent with lifecycle still `RUNNING` and a persistent failure message.

### Offline State

- Preserve the last snapshot but place a clear `STALE` banner above it.
- Disable destructive actions.
- Show retry timing in metadata, not a blocking spinner.

## 6. Motion And Feedback

- Wheel selection changes in under 100ms. High-frequency wheel navigation is instant; do not animate it.
- Do not animate list position when one wheel detent moves one row.
- Page transitions use a 120ms horizontal translation of at most 12px plus opacity.
- PTT entry uses an immediate orange flash, followed by a calm recording state.
- Success feedback lasts 600ms and does not block navigation.
- Error feedback remains until acknowledged or state changes.
- No looping decorative animation, bounce, spring, parallax, or background motion.
- Use device haptics only if the Creation bridge exposes a documented API. Never assume it exists.

## 7. Input And Focus Rules

### Wheel

- One detent moves exactly one semantic item.
- At list boundaries, focus remains on the first or last item.
- A rapid wheel sequence may coalesce rendering, but must not skip semantic items.
- Wheel input never executes an action.
- Every list, including Home, Workspace, Subagents, Actions, and Agent timeline, keeps one stable canonical focus identity and renders a bounded window around it. Moving beyond a visible edge shifts the window by one semantic item without skipping; position counts refer to the full list. An asynchronous insert preserves the focused identity and its reading anchor. If that identity is deleted, focus moves deterministically to its successor, otherwise its predecessor.

### Side Button

- Short click activates selected Home/Workspace/Action/Decision items.
- In Agent, short click opens Actions regardless of timeline focus.
- Hold begins dictation only from an explicitly open interactive Agent.
- Release ends PTT.
- Side click during Composer activates only the selected visible rail command. It can page with `BACK`/`NEXT`, cancel with `CANCEL`, and sends only when final-page `SEND` is selected.
- Side click during Permission handoff only goes Back; R1 does not claim to open another device.
- Workspace, Subagents, Actions, Handoff, and Decision/list screens expose a wheel-focusable Back item or command. Composer exposes the page-dependent rail described above with Cancel selected by default. Agent reserves wheel focus for timeline items; its hardware return path is side click, then Actions, then Back. Touch is not the only return path.

### Touch

- First tap selects; second tap activates when accidental activation is costly.
- Primary non-destructive rows may activate on one tap.
- Long-press on touch is not a required gesture.
- Touch and wheel always update the same canonical focus.

### Desktop Prototype Fallback

- Arrow Up/Down: wheel.
- Enter: side click.
- Space down/up: side hold/release.
- Escape or Backspace: back.
- The prototype must consume a simulated hold as one gesture: after Space down starts recording, its Space up and any synthesized or late Enter/click cannot open Actions.

## 8. Responsive And Runtime Behavior

- Production layout supports only the 240x292 Creation viewport.
- Browser prototype centers the fixed viewport inside a device-stage preview; the app itself never scales.
- Portrait is canonical. Landscape is unsupported in the MVP and shows a rotate-back state.
- The rotate-back state contains no product data or controlled action. It preserves in-memory state and returns to the exact prior view and canonical focus when portrait resumes.
- Text size remains fixed if Android font scaling would make labels overflow; critical content must still be available through concise wording.
- Use CSS containment where useful and keep DOM node count bounded.
- No remote font, icon font, WebGL, video, or large raster asset.

## 9. Accessibility

- Every state color has a shape and text equivalent.
- Focus is visible with a high-contrast fill and rail, not color alone.
- All controls have semantic names and correct button/list roles.
- A composite list exposes its selected option through `aria-activedescendant`, or uses a true roving `tabindex` implementation. DOM focus, touch selection, wheel selection, and visual focus must never diverge. Native buttons keep button semantics; do not overwrite them with `role=option` merely for styling.
- View changes, connection changes, recording/transcribing changes, destructive-action results, and focus position are announced through appropriately polite or assertive live regions without repeating the entire screen. Re-rendering must not reset DOM focus to an unnamed application shell.
- Reduced motion removes translations and recording bar animation.
- Voice transcript is always fully reviewable before sending; touch editing is optional acceleration.
- Destructive actions require explicit focus plus confirmation; Permission decisions remain outside R1.
- The client never auto-scrolls away from the selected item after an asynchronous update.

### Entry, Recovery, And Empty Cache

- First launch without a trusted Device grant shows Pairing, not cached product data. Pairing provides a hardware-focusable recovery action and explicit `PAIRING`, `PAIRED`, `PAIR FAILED`, and `PAIR AGAIN` outcomes; it must not end on a disabled-only dead screen.
- `AUTH REQUIRED`, revoked grant, security-blocked, upgrade-required, limited firmware, and unsupported firmware each provide an explicit safe recovery instruction or a hardware return path. If recovery occurs in full Paseo, the R1 waits in a bounded polling state and allows Back.
- A first connection with no verified cache shows a bounded loading/empty surface under canonical `RECONNECTING`; it does not render sample or stale Agent data. `STALE` is reserved for a previously verified snapshot and always includes last-sync age and retry timing.
- Home Attention identity is `(host, workspaceId, agentId, attentionVersion)`. The same identity is deduplicated across Home, parent relationship lists, and execution Workspace. Each row includes age. Local Read only changes emphasis after meaningful content renders while online; it never changes Attention reason, ordering, or `attentionVersion`, and is never written from stale data.

## 10. Do And Do Not

### Do

- Prefer dense rows and full-width bands.
- Keep a single selected target visible at all times.
- Show attention items first, then project/workspace context, then agents.
- Keep lifecycle, attention, and connection freshness visually independent.
- Use short verbs and concrete state labels.
- Preserve state during reconnect and mark it stale.
- Test every screen at exactly 240x292.

### Do Not

- Do not use dashboard cards, nested cards, drawers, floating panels, or bottom sheets.
- Do not use gradients, glows, glass blur, bokeh, illustrations, or marketing decoration.
- Do not shrink the existing Paseo mobile UI.
- Do not expose raw terminal streams or full diffs.
- Do not rely on swipe as the only navigation path.
- Do not let wheel input trigger stop or send; R1 does not expose approve or deny.
- Do not flatten agents across host/project/workspace boundaries.
- Do not label `idle` as `waiting`, or use `done` as an agent lifecycle state.
- Do not show more than three simultaneous action-rail commands or more than three controlled actions. Back and Subagents relationship navigation are not controlled actions.
- Do not use orange for every state; reserve it for Paseo and physical action.

## 11. Agent Prompt Guide

When building Paseo for Rabbit R1:

> Build an exact 240x292 content canvas as a dark pocket task instrument; prototype bezel and border live outside that canvas. Start with deduplicated, aged attention items and project/workspace ownership. Workspace lists root Agent sessions; each parent Agent leads to its own Subagents relationship list, where Native subagents are read-only. Keep connection freshness, lifecycle, and attention as separate canonical states. Every list windows around one stable canonical focus; in Agent the wheel browses the windowed timeline only, side click opens Actions, and a fully consumed side hold starts `RECORDING` for that agent. Workspace, Subagents, Actions, Handoff, and Decision/list screens have a focusable Back command. Composer paginates the full transcript with at most Back, Cancel, and Next until the fully reviewed final page exposes Send; Cancel is always selected by default. Agent returns through Actions. Use near-black full-width surfaces, warm off-white text, Rabbit orange only for identity and physical action, dense unframed rows, no nested cards, no gradients, and no raw terminal output. Stop freezes `pendingTargetTurnId` and uses separate confirmation with Cancel selected; Permission is a complete-kind/completeness read-only handoff to full Paseo.
