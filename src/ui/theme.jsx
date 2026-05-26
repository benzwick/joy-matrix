// Shared theme + style primitives. This is the single source of truth for
// the app's colors, fonts, ThemeProvider, and the small presentational
// pieces (Pill / Slider / SectionHead) plus the reusable inline-style
// objects. Both the main app (src/App.jsx) and the documentation page
// (src/docs/*) import from here so they render with identical theming.
//
// Keeping it free of app logic (no scheduling, no chat SDK, no state model)
// means the docs entry can pull in the look-and-feel without bundling the
// whole application.

import React, { useState, useEffect, useContext, createContext } from "react";

export const THEME_STORAGE_KEY = "joy-matrix-theme-v1";

export function loadTheme() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v) return JSON.parse(v);
  } catch (e) {}
  return null;
}
export function saveTheme(theme) {
  try { localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme)); } catch (e) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// UI primitives
// ─────────────────────────────────────────────────────────────────────────────

// Logical color names map to CSS variables set by ThemeProvider. Component
// code keeps using `colors.ink` etc.; the actual hex resolves at paint time
// from whatever theme is active, so a swap is instant and re-render-free.
export const colors = {
  paper:     "var(--joy-paper)",
  paperDeep: "var(--joy-paper-deep)",
  ink:       "var(--joy-ink)",
  inkSoft:   "var(--joy-ink-soft)",
  rule:      "var(--joy-rule)",
  rust:      "var(--joy-rust)",
  rustDeep:  "var(--joy-rust-deep)",
  teal:      "var(--joy-teal)",
  ochre:     "var(--joy-ochre)",
  bone:      "var(--joy-bone)",
};

// Each theme carries its own light + dark palette. The header sun/moon
// toggle flips `mode` within the active themeId. Themes can be added by
// dropping another entry into this map with both variants defined.
export const PRESETS = {
  talk2view: {
    label: "Talk2View",
    defaultFonts: { head: "Geist", body: "Geist", mono: "Geist Mono" },
    light: {
      "--joy-paper":      "#f5f4f0",
      "--joy-paper-deep": "#eceae3",
      "--joy-ink":        "#1a1a18",
      "--joy-ink-soft":   "#5a5854",
      "--joy-rule":       "rgba(26,26,24,0.12)",
      "--joy-rust":       "#c25543",
      "--joy-rust-deep":  "#9b3f30",
      "--joy-teal":       "#3aa89a",
      "--joy-ochre":      "#c98a2c",
      "--joy-bone":       "#fbfaf6",
    },
    dark: {
      "--joy-paper":      "#0f1413",
      "--joy-paper-deep": "#171d1c",
      "--joy-ink":        "#e8ebe9",
      "--joy-ink-soft":   "#9aa6a3",
      "--joy-rule":       "rgba(232,235,233,0.14)",
      "--joy-rust":       "#e07050",
      "--joy-rust-deep":  "#f08870",
      "--joy-teal":       "#5ccab8",
      "--joy-ochre":      "#e8a647",
      "--joy-bone":       "#1a2120",
    },
  },
  workbook: {
    label: "Workbook",
    defaultFonts: { head: "Fraunces", body: "Geist", mono: "Geist Mono" },
    light: {
      "--joy-paper":      "#f4ebdb",
      "--joy-paper-deep": "#ece1cb",
      "--joy-ink":        "#1c1916",
      "--joy-ink-soft":   "#3a342c",
      "--joy-rule":       "rgba(28,25,22,0.14)",
      "--joy-rust":       "#b8492a",
      "--joy-rust-deep":  "#8e2f17",
      "--joy-teal":       "#2a5d5d",
      "--joy-ochre":      "#c98a2c",
      "--joy-bone":       "#fbf6ec",
    },
    dark: {
      "--joy-paper":      "#16110d",
      "--joy-paper-deep": "#1f1812",
      "--joy-ink":        "#ebe2d0",
      "--joy-ink-soft":   "#a8997f",
      "--joy-rule":       "rgba(235,226,208,0.14)",
      "--joy-rust":       "#e07050",
      "--joy-rust-deep":  "#f59072",
      "--joy-teal":       "#6fb3b3",
      "--joy-ochre":      "#e8a647",
      "--joy-bone":       "#221b15",
    },
  },
};

// Map from the previous flat-preset names to the new {themeId, mode} shape.
// Used to migrate localStorage entries written before this refactor.
const LEGACY_PRESET_MAP = {
  workbook: { themeId: "workbook", mode: "light" },
  midnight: { themeId: "workbook", mode: "dark" },
};

export const DEFAULT_FONTS = { head: "Fraunces", body: "Geist", mono: "Geist Mono" };
export const DEFAULT_THEME = { themeId: "talk2view", mode: "light", overrides: {}, fonts: {} };

// Resolve the active font for each slot: explicit user pick wins, otherwise
// the active theme's defaultFonts, otherwise the global DEFAULT_FONTS.
export function effectiveFonts(theme) {
  const preset = PRESETS[theme.themeId] ?? PRESETS[DEFAULT_THEME.themeId];
  const themeDefaults = preset?.defaultFonts || DEFAULT_FONTS;
  const picks = theme.fonts || {};
  return {
    head: picks.head || themeDefaults.head || DEFAULT_FONTS.head,
    body: picks.body || themeDefaults.body || DEFAULT_FONTS.body,
    mono: picks.mono || themeDefaults.mono || DEFAULT_FONTS.mono,
  };
}

// Curated set per slot. Heading + body share one list so the user can pair
// any serif or sans with any role (Geist heading + Lora body, or vice
// versa). Mono stays separate since it must be monospaced.
const PROSE_FONTS = [
  // Sans-serif
  "Geist", "Inter", "DM Sans", "Manrope", "Nunito Sans", "Outfit",
  // Serif
  "Fraunces", "Playfair Display", "Lora", "DM Serif Display", "Cormorant Garamond", "Roboto Slab",
];
const MONO_FONTS = ["Geist Mono", "JetBrains Mono", "IBM Plex Mono", "Space Mono", "Roboto Mono"];

export const FONT_OPTIONS = {
  head: PROSE_FONTS,
  body: PROSE_FONTS,
  mono: MONO_FONTS,
};

const FONT_FALLBACK = {
  head: 'serif',
  body: 'ui-sans-serif, system-ui, sans-serif',
  mono: 'ui-monospace, monospace',
};

export function fontStack(family, slot) {
  return `"${family}", ${FONT_FALLBACK[slot]}`;
}

export function buildGoogleFontsUrl({ head, body, mono }) {
  const enc = (f) => f.replace(/ /g, "+");
  // Per-slot weight + italic axes. Head needs the widest range
  // (italic + heavy display weights); body needs regular + medium-bold;
  // mono needs only regular + medium. When the same family is picked for
  // multiple slots, take the most expensive spec so all uses get satisfied.
  const HEAD_SPEC = "ital,wght@0,400;0,500;0,600;0,700;0,900;1,400;1,700;1,900";
  const BODY_SPEC = "wght@400;500;600;700";
  const MONO_SPEC = "wght@400;500";
  const SPEC_RANK = { [HEAD_SPEC]: 3, [BODY_SPEC]: 2, [MONO_SPEC]: 1 };
  const specs = new Map();
  const add = (family, spec) => {
    const prev = specs.get(family);
    if (!prev || SPEC_RANK[spec] > SPEC_RANK[prev]) specs.set(family, spec);
  };
  add(head, HEAD_SPEC);
  add(body, BODY_SPEC);
  add(mono, MONO_SPEC);
  const params = [...specs.entries()].map(([f, s]) => `family=${enc(f)}:${s}`).join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

// Live viewport width for responsive inline styles. Returns 1024 on the
// server and during the first paint so layouts default to the desktop
// branch — mobile-specific tweaks kick in once mounted.
export function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window === "undefined" ? 1024 : window.innerWidth));
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return w;
}

// Pick an initial mode that respects the user's OS preference on first visit.
export function detectInitialMode() {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Forward-only migration: pull a saved theme into the current shape.
export function migrateTheme(saved) {
  if (!saved || typeof saved !== "object") return null;
  // Old shape used a flat `preset` name. Map it onto {themeId, mode}.
  if (saved.preset && !saved.themeId) {
    const mapped = LEGACY_PRESET_MAP[saved.preset] || { themeId: "talk2view", mode: "light" };
    return { ...DEFAULT_THEME, ...saved, ...mapped, preset: undefined };
  }
  // Defensive: unknown themeId falls back to the default.
  if (saved.themeId && !PRESETS[saved.themeId]) {
    return { ...saved, themeId: DEFAULT_THEME.themeId };
  }
  return saved;
}

// The main slots exposed in the color picker. Other CSS variables (rule,
// paper-deep, rust-deep) intentionally stay tied to the preset so users
// don't have to balance ten swatches to get a coherent look.
export const CUSTOMIZE_SLOTS = [
  { key: "--joy-paper", label: "Paper",  sub: "background" },
  { key: "--joy-ink",   label: "Ink",    sub: "text" },
  { key: "--joy-rust",  label: "Rust",   sub: "DO accent" },
  { key: "--joy-teal",  label: "Teal",   sub: "SCHEDULE accent" },
  { key: "--joy-ochre", label: "Ochre",  sub: "DELEGATE accent" },
];

const ThemeContext = createContext({ theme: DEFAULT_THEME, setTheme: () => {} });
export function useTheme() { return useContext(ThemeContext); }

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const saved = migrateTheme(loadTheme());
    if (saved) return { ...DEFAULT_THEME, ...saved };
    return { ...DEFAULT_THEME, mode: detectInitialMode() };
  });
  useEffect(() => { saveTheme(theme); }, [theme]);
  const setTheme = (next) => setThemeState((t) => (typeof next === "function" ? next(t) : next));
  const preset = PRESETS[theme.themeId] ?? PRESETS[DEFAULT_THEME.themeId];
  const presetVars = preset[theme.mode] ?? preset.light;
  const fonts = effectiveFonts(theme);
  const fontVars = {
    "--joy-font-head": fontStack(fonts.head, "head"),
    "--joy-font-body": fontStack(fonts.body, "body"),
    "--joy-font-mono": fontStack(fonts.mono, "mono"),
  };
  const vars = { ...presetVars, ...fontVars, ...(theme.overrides || {}) };

  // (Re)inject the Google Fonts link whenever the font selection changes.
  useEffect(() => {
    const id = "joy-matrix-fonts";
    const url = buildGoogleFontsUrl(fonts);
    let link = document.getElementById(id);
    if (link && link.href === url) return;
    if (link) link.remove();
    link = document.createElement("link");
    link.id = id; link.rel = "stylesheet"; link.href = url;
    document.head.appendChild(link);
  }, [fonts.head, fonts.body, fonts.mono]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div style={{ ...vars, minHeight: "100vh" }}>{children}</div>
    </ThemeContext.Provider>
  );
}

export function Pill({ children, tone = "ink" }) {
  const tones = {
    ink:  { bg: "rgba(28,25,22,0.06)", color: colors.ink, bd: "rgba(28,25,22,0.14)" },
    rust: { bg: "rgba(184,73,42,0.10)", color: colors.rustDeep, bd: "rgba(184,73,42,0.30)" },
    teal: { bg: "rgba(42,93,93,0.10)",  color: colors.teal, bd: "rgba(42,93,93,0.30)" },
    warn: { bg: "rgba(184,73,42,0.18)", color: colors.rustDeep, bd: "rgba(184,73,42,0.50)" },
  };
  const t = tones[tone];
  return (
    <span style={{
      fontFamily: "var(--joy-font-mono)",
      fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
      padding: "3px 8px", borderRadius: 999,
      background: t.bg, color: t.color, border: `1px solid ${t.bd}`,
      whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

export function Slider({ value, onChange, min, max, step = 1, color = colors.ink, label, testId }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--joy-font-mono)", fontSize: 10, color: colors.inkSoft, letterSpacing: "0.06em", marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color: color, fontWeight: 600 }}>{value > 0 ? `+${value}` : value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        data-testid={testId}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%", height: 4, borderRadius: 999, appearance: "none",
          background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, rgba(28,25,22,0.12) ${pct}%, rgba(28,25,22,0.12) 100%)`,
          cursor: "pointer",
        }}
      />
    </div>
  );
}

export function SectionHead({ eyebrow, title, sub, action }) {
  return (
    <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", paddingBottom: 12, borderBottom: `1px solid ${colors.rule}` }}>
      <div>
        <div style={{ fontFamily: "var(--joy-font-mono)", fontSize: 11, letterSpacing: "0.18em", color: colors.rust }}>{eyebrow} ──</div>
        <h2 style={{ fontFamily: "var(--joy-font-head)", fontWeight: 700, fontStyle: "italic", fontSize: "clamp(28px, 5vw, 40px)", letterSpacing: "-0.02em", margin: "4px 0 4px" }}>{title}</h2>
        <div style={{ fontSize: 13, color: colors.inkSoft, fontFamily: "var(--joy-font-head)" }}>{sub}</div>
      </div>
      {action}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

export const card = {
  padding: 16, borderRadius: 12,
  background: colors.bone, border: `1px solid ${colors.rule}`,
};

export const mutedLabel = {
  fontFamily: "var(--joy-font-mono)", fontSize: 10,
  letterSpacing: "0.12em", textTransform: "uppercase", color: colors.inkSoft,
};

export const inputBare = {
  width: "100%", border: "none", background: "transparent", outline: "none",
  color: colors.ink, fontFamily: "var(--joy-font-body)", fontSize: 15, padding: "4px 0",
};

export const tabBtn = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "7px 12px", borderRadius: 999,
  background: "transparent", border: `1px solid transparent`,
  fontFamily: "var(--joy-font-mono)", fontSize: 11, letterSpacing: "0.06em",
  color: colors.inkSoft, cursor: "pointer", textTransform: "uppercase",
  whiteSpace: "nowrap",
};
export const tabBtnActive = {
  background: colors.teal, color: "#ffffff", border: `1px solid ${colors.teal}`,
};

export const btnGhost = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "5px 10px", borderRadius: 999,
  background: "transparent", border: `1px solid ${colors.rule}`,
  fontFamily: "var(--joy-font-mono)", fontSize: 10, letterSpacing: "0.06em",
  color: colors.inkSoft, cursor: "pointer", textTransform: "uppercase",
};

export const btnPrimary = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "8px 14px", borderRadius: 999,
  background: colors.teal, color: "#ffffff", border: "none",
  fontFamily: "var(--joy-font-mono)", fontSize: 11, letterSpacing: "0.06em",
  cursor: "pointer", textTransform: "uppercase",
};

export const btnIcon = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 26, height: 26, borderRadius: 999,
  background: "transparent", border: `1px solid ${colors.rule}`,
  color: colors.inkSoft, cursor: "pointer",
};

export const warnBox = {
  marginTop: 10, padding: "8px 10px", borderRadius: 8,
  background: "rgba(184,73,42,0.10)", border: `1px solid rgba(184,73,42,0.3)`,
  color: colors.rustDeep, fontSize: 12, fontFamily: "var(--joy-font-head)",
  display: "flex", alignItems: "center", gap: 6,
};
