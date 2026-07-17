# Paseo for Rabbit R1 Design System

Version: 0.1  
Status: Proposed  
Target: RabbitOS Creation at a fixed 240x282 CSS pixel viewport

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
  text-muted: "#777C75"
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
- Body text must meet WCAG AA contrast against its surface.

## 3. Typography Rules

Use fonts already available in Android WebView. Do not load a remote font during startup.

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

## 4. Spatial System

The viewport is fixed at 240x282.

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
- Footer/action rail: 34px fixed height when present.
- Main content: remaining height; never resize it because a row gains focus.
- Touch targets: at least 32px high; primary actions are 36px high.
- List row: 46px default, 50px when an attention label is present.
- Focus indicator: 2px left rail plus inverted row fill. It must not change row dimensions.

## 5. Component Styling

### App Header

- Full-width unframed region, 36px tall.
- Left: page title or compact back button plus title.
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

### Lifecycle And Attention Indicators

- 6px fixed circle, never animated continuously.
- Running may pulse twice when state changes, then becomes static.
- Error uses a diamond shape so it remains distinguishable without color.
- Attention appears as a compact `INPUT`, `REVIEW`, `FAILED`, `FINISHED`, or unread mark; it never replaces lifecycle.
- Connection is shown in the header as `LIVE`, `RECONNECTING`, or `STALE`.

### Activity Block

- Not a card. It is a full-width content band with a metadata line and bounded text.
- Tool activity uses a monospace leading symbol and a single-line summary.
- Assistant summary uses proportional body text, maximum six visible lines.
- Truncation ends with a visible `MORE ON PHONE` metadata label.

### Actions Entry And Action List

- Agent uses one fixed bottom command: `ACTIONS`. Wheel input continues to own timeline focus.
- Side click opens a full-height Action List; it never executes the currently visible timeline row.
- The Action List begins with a focusable Back item and contains at most Follow up, Review permission, and Stop.
- Destructive color appears only on the separate confirmation screen after intent is selected.
- Composer and Decision screens may use a fixed action rail because their entire content is already one focused task.

### Voice Overlay

- Replaces the full viewport; it is not a modal card.
- Black canvas, orange top rule, centered live level bars, `LISTENING` state, and release instruction.
- Release enters an explicit `TRANSCRIBING` state before Composer review.
- Recording animation uses at most five bars and `transform`; respect reduced motion.

### Approval View

- Full-screen decision surface, not a modal.
- Request type and affected target appear before the action rail.
- `DENY` is selected by default.
- Approve requires side click after moving selection; no long-press shortcut.
- Truncated or unsupported details disable approval and show `OPEN PASEO`.
- Simple confirm and small fixed select are the only actionable MVP schemas. Input, editor, multi-step, optional-comment, skip/cancel-sensitive, and unknown schemas are read-only.

### Stop Confirmation

- Full-screen decision surface with `CANCEL` selected by default.
- Confirm enters `STOPPING`; do not show stopped before provider acknowledgement.
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

### Side Button

- Short click activates selected Home/Workspace/Action/Decision items.
- In Agent, short click opens Actions regardless of timeline focus.
- Hold begins dictation only from an explicitly open interactive Agent.
- Release ends PTT.
- Side click during Composer sends only when `SEND` is selected.
- Side click during Approval applies only the selected decision.
- Every non-root screen has a wheel-focusable Back item or Back command; touch is not the only return path.

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

## 8. Responsive And Runtime Behavior

- Production layout supports only the 240x282 Creation viewport.
- Browser prototype centers the fixed viewport inside a device-stage preview; the app itself never scales.
- Portrait is canonical. Landscape is unsupported in the MVP and shows a rotate-back state.
- Text size remains fixed if Android font scaling would make labels overflow; critical content must still be available through concise wording.
- Use CSS containment where useful and keep DOM node count bounded.
- No remote font, icon font, WebGL, video, or large raster asset.

## 9. Accessibility

- Every state color has a shape and text equivalent.
- Focus is visible with a high-contrast fill and rail, not color alone.
- All controls have semantic names and correct button/list roles.
- Reduced motion removes translations and recording bar animation.
- Voice transcript is always reviewable and editable before sending.
- Destructive and approval actions require explicit focus plus confirmation.
- The client never auto-scrolls away from the selected item after an asynchronous update.

## 10. Do And Do Not

### Do

- Prefer dense rows and full-width bands.
- Keep a single selected target visible at all times.
- Show attention items first, then project/workspace context, then agents.
- Keep lifecycle, attention, and connection freshness visually independent.
- Use short verbs and concrete state labels.
- Preserve state during reconnect and mark it stale.
- Test every screen at exactly 240x282.

### Do Not

- Do not use dashboard cards, nested cards, drawers, floating panels, or bottom sheets.
- Do not use gradients, glows, glass blur, bokeh, illustrations, or marketing decoration.
- Do not shrink the existing Paseo mobile UI.
- Do not expose raw terminal streams or full diffs.
- Do not rely on swipe as the only navigation path.
- Do not let wheel input trigger stop, approve, deny, or send.
- Do not flatten agents across host/project/workspace boundaries.
- Do not label `idle` as `waiting`, or use `done` as an agent lifecycle state.
- Do not show more than three simultaneous actions.
- Do not use orange for every state; reserve it for Paseo and physical action.

## 11. Agent Prompt Guide

When building Paseo for Rabbit R1:

> Build a fixed 240x282 dark pocket task instrument. Start with attention items and project/workspace ownership, then show root agents and subagents. Keep connection, lifecycle, and attention as separate states. The wheel moves one semantic item; in Agent it browses timeline only, side click opens Actions, and side hold starts dictation for that agent. Every deeper screen has a focusable Back command. Use near-black full-width surfaces, warm off-white text, Rabbit orange only for identity and physical action, dense unframed rows, no nested cards, no gradients, and no raw terminal output. Stop and permission decisions use separate confirmation screens with safe defaults.
