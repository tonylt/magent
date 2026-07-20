// Mobile design tokens, adapted from DESIGN.md for a dark, high-contrast, one-hand
// away-from-desk surface. Large touch targets and clear state colors.

export const colors = {
  bg: "#090a0a",
  surface: "#141615",
  surfaceRaised: "#1c1f1d",
  border: "#2a2d2b",
  text: "#f4f2ec",
  textDim: "#b2b5ae",
  textFaint: "#7c807a",
  accent: "#ff4f18",
  // State colors
  live: "#3ecf8e",
  syncing: "#e0a93b",
  stale: "#7c807a",
  permission: "#ff4f18",
  error: "#ff5a5a",
  finished: "#4a9dff",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const font = {
  mono: "ui-monospace",
  size: { xs: 11, sm: 13, md: 15, lg: 18, xl: 22, xxl: 28 },
  weight: { regular: "400", medium: "600", bold: "700" },
} as const;

/** Minimum comfortable one-hand touch target. */
export const touchTarget = 56;
