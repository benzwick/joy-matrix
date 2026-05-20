import React, { useState, useEffect, useMemo, useContext, createContext } from "react";
import {
  Plus, X, Sparkles, AlertTriangle, Trash2, RefreshCw,
  Zap, Heart, Brain, Battery, ArrowRight, Target, Users, ListTodo, Grid3x3, Activity,
  Sun, Moon, Palette, RotateCcw, Download, Upload, Github, Linkedin, Instagram,
  Calendar
} from "lucide-react";
import JoyMatrixChat from "./talk2view/JoyMatrixChat";
import { FUZZY_VALUES, FUZZY_LABELS, formatDueDate, isOverdue } from "./scheduling/dueDate";
import { DAYS, DAY_LABELS, WEEKDAYS, weekdayNineToFive, normaliseRanges, weeklyAvailableHours } from "./scheduling/availability";
import { DAYTIMES, DAYTIME_LABELS, SCORE_LABELS, defaultWindows } from "./scheduling/windows";
import { computeSchedule, hoursPerMember } from "./scheduling/schedule";

// ─────────────────────────────────────────────────────────────────────────────
// Types of intent
//   urgency    1–5
//   importance 1–5
//   effort     1–5  (relative load units consumed from a person's budget)
//   pleasure   -3..+3   per (task, member)
//   talent     -3..+3   per (task, member)
//   capacity   -3..+3   per member  (current bandwidth, not a fixed trait)
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "joy-matrix-state-v1";
const THEME_STORAGE_KEY = "joy-matrix-theme-v1";
const SCHEMA_VERSION = 5;

const DEMO_STATE = {
  schemaVersion: SCHEMA_VERSION,
  goal: {
    from: "scattered MVP, no users",
    to: "category-defining product, profitable, Porsche 911 in the driveway",
  },
  categories: [
    { id: "c-eng",  name: "Engineering" },
    { id: "c-des",  name: "Design" },
    { id: "c-mkt",  name: "Marketing" },
    { id: "c-ops",  name: "Ops & admin" },
  ],
  stakeholders: [
    { id: "s-founder", name: "Founder" },
    { id: "s-users",   name: "Early users" },
    { id: "s-team",    name: "The team" },
  ],
  members: [
    {
      id: "m1", name: "Maya", capacity: 2,
      availability: {
        mon: [{ from: "09:00", to: "17:00" }],
        tue: [{ from: "09:00", to: "17:00" }],
        wed: [{ from: "09:00", to: "17:00" }],
        thu: [{ from: "09:00", to: "17:00" }],
        fri: [{ from: "09:00", to: "15:00" }],
        sat: [],
        sun: [],
      },
      windows: {
        morning:   { energy: 3, concentration: 3 },
        midday:    { energy: 2, concentration: 2 },
        afternoon: { energy: 1, concentration: 1 },
        evening:   { energy: 1, concentration: 2 },
      },
      categoryScores: {
        "c-eng": { pleasure: 1,  talent: 2  },
        "c-des": { pleasure: 3,  talent: 3  },
        "c-mkt": { pleasure: -1, talent: 0  },
        "c-ops": { pleasure: -2, talent: -1 },
      },
    },
    {
      id: "m2", name: "Jordan", capacity: 0,
      availability: {
        mon: [{ from: "10:00", to: "13:00" }, { from: "14:00", to: "19:00" }],
        tue: [{ from: "10:00", to: "13:00" }, { from: "14:00", to: "19:00" }],
        wed: [{ from: "10:00", to: "13:00" }, { from: "14:00", to: "19:00" }],
        thu: [],
        fri: [{ from: "10:00", to: "13:00" }, { from: "14:00", to: "19:00" }],
        sat: [],
        sun: [],
      },
      windows: {
        morning:   { energy: 1, concentration: 2 },
        midday:    { energy: 2, concentration: 3 },
        afternoon: { energy: 3, concentration: 3 },
        evening:   { energy: 2, concentration: 2 },
      },
      categoryScores: {
        "c-eng": { pleasure: 3,  talent: 3  },
        "c-des": { pleasure: 1,  talent: 0  },
        "c-mkt": { pleasure: -1, talent: 1  },
        "c-ops": { pleasure: 1,  talent: 2  },
      },
    },
    {
      id: "m3", name: "Sam", capacity: -1,
      availability: {
        mon: [{ from: "08:00", to: "12:00" }],
        tue: [{ from: "08:00", to: "12:00" }],
        wed: [{ from: "08:00", to: "12:00" }],
        thu: [{ from: "08:00", to: "12:00" }],
        fri: [{ from: "08:00", to: "12:00" }],
        sat: [{ from: "10:00", to: "13:00" }],
        sun: [],
      },
      windows: {
        morning:   { energy: 3, concentration: 2 },
        midday:    { energy: 2, concentration: 2 },
        afternoon: { energy: 1, concentration: 1 },
        evening:   { energy: 1, concentration: 1 },
      },
      categoryScores: {
        "c-eng": { pleasure: -1, talent: -2 },
        "c-des": { pleasure: 1,  talent: 1  },
        "c-mkt": { pleasure: 3,  talent: 3  },
        "c-ops": { pleasure: -2, talent: -2 },
      },
    },
  ],
  tasks: [
    {
      id: "t1", title: "Ship landing page redesign", categoryId: "c-des", stakeholderId: "s-users",
      urgency: 4, importance: 4, effort: 2,
      dueDate: { kind: "fuzzy", value: "this-week" },
      scores: {
        m1: { pleasure: 3, talent: 3 },
        m2: { pleasure: 0, talent: 1 },
        m3: { pleasure: -1, talent: 0 },
      },
    },
    {
      id: "t2", title: "Set up Stripe + billing flows", categoryId: "c-eng", stakeholderId: "s-founder",
      urgency: 3, importance: 5, effort: 4,
      dueDate: { kind: "fuzzy", value: "soon" },
      scores: {
        m1: { pleasure: -2, talent: 0 },
        m2: { pleasure: 1, talent: 3 },
        m3: { pleasure: -1, talent: 1 },
      },
    },
    {
      id: "t3", title: "Write & schedule launch tweet thread", categoryId: "c-mkt", stakeholderId: "s-users",
      urgency: 5, importance: 2, effort: 1,
      dueDate: { kind: "fuzzy", value: "this-afternoon" },
      scores: {
        m1: { pleasure: 1, talent: 2 },
        m2: { pleasure: -1, talent: 0 },
        m3: { pleasure: 3, talent: 3 },
      },
    },
    {
      id: "t4", title: "Refactor auth (tech debt)", categoryId: "c-eng", stakeholderId: "s-team",
      urgency: 1, importance: 4, effort: 4,
      dueDate: { kind: "fuzzy", value: "later" },
      scores: {
        m1: { pleasure: -2, talent: -1 },
        m2: { pleasure: 2, talent: 3 },
        m3: { pleasure: -3, talent: -2 },
      },
    },
    {
      id: "t5", title: "Update outdated help docs", categoryId: "c-ops",
      urgency: 1, importance: 1, effort: 2,
      dueDate: { kind: "fuzzy", value: "whenever" },
      scores: {
        m1: { pleasure: -1, talent: 1 },
        m2: { pleasure: -2, talent: 0 },
        m3: { pleasure: 0, talent: 2 },
      },
    },
    {
      id: "t6", title: "Run 5 user research interviews", categoryId: "c-des", stakeholderId: "s-users",
      urgency: 2, importance: 5, effort: 3,
      dueDate: { kind: "fuzzy", value: "this-week" },
      scores: {
        m1: { pleasure: 2, talent: 2 },
        m2: { pleasure: -2, talent: 0 },
        m3: { pleasure: 3, talent: 3 },
      },
    },
  ],
};

const EMPTY_STATE = {
  schemaVersion: SCHEMA_VERSION,
  goal: { from: "", to: "" },
  categories: [],
  stakeholders: [],
  members: [],
  tasks: [],
};

// Forward-only migration: bring legacy state objects up to current schema.
function migrateState(s) {
  if (!s || typeof s !== "object") return null;
  if (!s.schemaVersion) s = { schemaVersion: 1, ...s };
  if (s.schemaVersion < 2) {
    s = { ...s, schemaVersion: 2, categories: s.categories || [] };
  }
  if (s.schemaVersion < 3) {
    s = {
      ...s, schemaVersion: 3,
      members: (s.members || []).map(m => ({ ...m, categoryScores: m.categoryScores || {} })),
    };
  }
  if (s.schemaVersion < 4) {
    s = { ...s, schemaVersion: 4, stakeholders: s.stakeholders || [] };
  }
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Algorithm
// ─────────────────────────────────────────────────────────────────────────────

export const quadrantOf = (t) => {
  const u = t.urgency >= 3, i = t.importance >= 3;
  if (u && i) return "DO";
  if (!u && i) return "SCHEDULE";
  if (u && !i) return "DELEGATE";
  return "ELIMINATE";
};

const QUADRANT_META = {
  DO:        { label: "DO",        sub: "urgent · important",       weight: { talent: 0.50, pleasure: 0.20, capacity: 0.30 } },
  SCHEDULE:  { label: "SCHEDULE",  sub: "important · not urgent",   weight: { talent: 0.30, pleasure: 0.50, capacity: 0.20 } },
  DELEGATE:  { label: "DELEGATE",  sub: "urgent · not important",   weight: { talent: 0.20, pleasure: 0.30, capacity: 0.50 } },
  ELIMINATE: { label: "ELIMINATE", sub: "neither — drop or defer",  weight: null },
};

// Workflow order: process delegations first (others run in parallel),
// then your own urgent work, then the strategic investments, then drop
// what's left. Numbers are surfaced in the UI and in the explainer.
const QUADRANT_ORDER = { DELEGATE: 1, DO: 2, SCHEDULE: 3, ELIMINATE: 4 };

// budget in effort units: capacity -3→1, 0→4, +3→7
const budgetOf = (m) => Math.max(0.5, 4 + m.capacity);

// priority order for greedy assignment
const QUAD_ORDER = ["DO", "SCHEDULE", "DELEGATE"];
const taskPriority = (t) => {
  const q = quadrantOf(t);
  const base = { DO: 0, SCHEDULE: 100, DELEGATE: 200, ELIMINATE: 999 }[q];
  // within quadrant: urgency*importance descending
  return base - (t.urgency * t.importance);
};

function computeAssignments(state) {
  const remaining = Object.fromEntries(state.members.map(m => [m.id, budgetOf(m)]));
  const initialBudget = Object.fromEntries(state.members.map(m => [m.id, budgetOf(m)]));
  const sorted = [...state.tasks].sort((a, b) => taskPriority(a) - taskPriority(b));
  const assignments = {};      // taskId -> { memberId, score, reasoning, burnoutRisk }
  const memberLoad = Object.fromEntries(state.members.map(m => [m.id, []]));

  for (const task of sorted) {
    const q = quadrantOf(task);
    if (q === "ELIMINATE" || state.members.length === 0) {
      assignments[task.id] = null;
      continue;
    }
    const w = QUADRANT_META[q].weight;
    let best = null;
    for (const m of state.members) {
      const s = task.scores?.[m.id] ?? { pleasure: 0, talent: 0 };
      const remainNorm = remaining[m.id] / Math.max(1, initialBudget[m.id]); // 0..1ish
      const overshoot = Math.max(0, task.effort - remaining[m.id]);
      const burnoutPenalty = overshoot * 1.2;
      const score =
        w.talent * s.talent +
        w.pleasure * s.pleasure +
        w.capacity * (remainNorm * 3) -   // scale capacity into ~-3..3 range
        burnoutPenalty;
      if (!best || score > best.score) {
        best = { memberId: m.id, score, talent: s.talent, pleasure: s.pleasure, overshoot };
      }
    }
    if (!best) { assignments[task.id] = null; continue; }
    remaining[best.memberId] -= task.effort;
    memberLoad[best.memberId].push(task.id);
    const reasoning = buildReasoning(q, best, state.members.find(m => m.id === best.memberId));
    assignments[task.id] = {
      memberId: best.memberId,
      score: best.score,
      reasoning,
      burnoutRisk: remaining[best.memberId] < -1.5,
    };
  }

  // per-member rollups
  const summary = state.members.map(m => {
    const taskIds = memberLoad[m.id];
    const tasks = taskIds.map(id => state.tasks.find(t => t.id === id));
    const totalEffort = tasks.reduce((s, t) => s + t.effort, 0);
    const joyIndex = tasks.reduce((s, t) => s + (t.scores?.[m.id]?.pleasure ?? 0) * t.effort, 0);
    const talentIndex = tasks.reduce((s, t) => s + (t.scores?.[m.id]?.talent ?? 0) * t.effort, 0);
    const used = initialBudget[m.id] - remaining[m.id];
    const utilization = initialBudget[m.id] > 0 ? used / initialBudget[m.id] : 0;
    return {
      memberId: m.id, name: m.name,
      taskCount: tasks.length, totalEffort,
      joyIndex, talentIndex,
      remaining: remaining[m.id],
      budget: initialBudget[m.id],
      utilization,
      burnout: remaining[m.id] < -1.5,
      strain: remaining[m.id] < 0 && remaining[m.id] >= -1.5,
    };
  });

  return { assignments, summary };
}

function buildReasoning(q, best, member) {
  const bits = [];
  if (best.talent >= 2) bits.push("strong talent fit");
  else if (best.talent <= -2) bits.push("stretch (low talent)");
  if (best.pleasure >= 2) bits.push("brings them joy");
  else if (best.pleasure <= -2) bits.push("painful — minimize");
  if (best.overshoot > 0) bits.push("over capacity, watch for burnout");
  if (bits.length === 0) bits.push("best available match");
  return `${member?.name ?? "?"}: ${bits.join(" · ")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage
// ─────────────────────────────────────────────────────────────────────────────

function loadState() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) return migrateState(JSON.parse(v));
  } catch (e) { /* not found or invalid */ }
  return null;
}
function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

export function buildExportEnvelope(state) {
  return {
    app: "joy-matrix",
    schemaVersion: state.schemaVersion ?? SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    project: state,
  };
}

function parseImport(raw) {
  let data;
  try { data = JSON.parse(raw); }
  catch (e) { return { error: "File isn't valid JSON." }; }
  if (!data || typeof data !== "object") return { error: "File doesn't contain a project." };
  if (data.app !== "joy-matrix") return { error: "Not an export from The Joy Matrix." };
  const incomingVersion = Number(data.schemaVersion ?? 1);
  if (incomingVersion > SCHEMA_VERSION) {
    return { error: `Export was created by a newer version of The Joy Matrix (schema v${incomingVersion}). Update your app and try again.` };
  }
  if (!data.project || typeof data.project !== "object") return { error: "Export is missing the project payload." };
  const project = migrateState(data.project);
  if (!project) return { error: "Project payload is malformed." };
  return { project };
}

function triggerJsonDownload(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a);
  a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function loadTheme() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v) return JSON.parse(v);
  } catch (e) {}
  return null;
}
function saveTheme(theme) {
  try { localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme)); } catch (e) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// UI primitives
// ─────────────────────────────────────────────────────────────────────────────

// Logical color names map to CSS variables set by ThemeProvider. Component
// code keeps using `colors.ink` etc.; the actual hex resolves at paint time
// from whatever theme is active, so a swap is instant and re-render-free.
const colors = {
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

const DEFAULT_FONTS = { head: "Fraunces", body: "Geist", mono: "Geist Mono" };
const DEFAULT_THEME = { themeId: "talk2view", mode: "light", overrides: {}, fonts: {} };

// Resolve the active font for each slot: explicit user pick wins, otherwise
// the active theme's defaultFonts, otherwise the global DEFAULT_FONTS.
function effectiveFonts(theme) {
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

const FONT_OPTIONS = {
  head: PROSE_FONTS,
  body: PROSE_FONTS,
  mono: MONO_FONTS,
};

const FONT_FALLBACK = {
  head: 'serif',
  body: 'ui-sans-serif, system-ui, sans-serif',
  mono: 'ui-monospace, monospace',
};

function fontStack(family, slot) {
  return `"${family}", ${FONT_FALLBACK[slot]}`;
}

function buildGoogleFontsUrl({ head, body, mono }) {
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
function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window === "undefined" ? 1024 : window.innerWidth));
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return w;
}

// Pick an initial mode that respects the user's OS preference on first visit.
function detectInitialMode() {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Forward-only migration: pull a saved theme into the current shape.
function migrateTheme(saved) {
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
const CUSTOMIZE_SLOTS = [
  { key: "--joy-paper", label: "Paper",  sub: "background" },
  { key: "--joy-ink",   label: "Ink",    sub: "text" },
  { key: "--joy-rust",  label: "Rust",   sub: "DO accent" },
  { key: "--joy-teal",  label: "Teal",   sub: "SCHEDULE accent" },
  { key: "--joy-ochre", label: "Ochre",  sub: "DELEGATE accent" },
];

const ThemeContext = createContext({ theme: DEFAULT_THEME, setTheme: () => {} });
function useTheme() { return useContext(ThemeContext); }

function CustomizePanel({ onClose }) {
  const { theme, setTheme } = useTheme();
  const isPhone = useViewportWidth() < 480;
  const preset = PRESETS[theme.themeId] ?? PRESETS[DEFAULT_THEME.themeId];
  const presetVars = preset[theme.mode] ?? preset.light;
  const setSlot = (key, value) =>
    setTheme(t => ({ ...t, overrides: { ...(t.overrides || {}), [key]: value } }));
  const resetSlot = (key) =>
    setTheme(t => {
      const { [key]: _, ...rest } = (t.overrides || {});
      return { ...t, overrides: rest };
    });
  const resetAll = () => setTheme(t => ({ ...t, overrides: {} }));
  const switchTheme = (id) => setTheme(t => ({ ...t, themeId: id }));
  const switchMode = (m) => setTheme(t => ({ ...t, mode: m }));
  const fonts = effectiveFonts(theme);
  const setFont = (slot, family) =>
    setTheme(t => ({ ...t, fonts: { ...(t.fonts || {}), [slot]: family } }));
  const resetFonts = () => setTheme(t => ({ ...t, fonts: {} }));
  const fontPreview = { head: "Aa Heading", body: "Body sentence.", mono: "mono 0123" };
  const fontSlotLabel = { head: "Heading", body: "Body", mono: "Mono" };
  return (
    <div style={{
      position: "fixed", top: 16, right: 16, zIndex: 50,
      width: isPhone ? "auto" : 280,
      left: isPhone ? 16 : "auto",
      maxHeight: "calc(100vh - 32px)",
      overflowY: "auto",
      background: colors.bone, border: `1px solid ${colors.rule}`, borderRadius: 14,
      boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
      padding: 14,
      fontFamily: "var(--joy-font-body)", color: colors.ink,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
        <div style={{ fontFamily: "var(--joy-font-head)", fontWeight: 700, fontSize: 18, fontStyle: "italic", letterSpacing: "-0.01em" }}>
          Customize
        </div>
        <button onClick={onClose} style={btnIcon} aria-label="Close customize panel"><X size={14}/></button>
      </div>

      <div style={{ ...mutedLabel, marginBottom: 6 }}>THEME</div>
      <select
        value={theme.themeId}
        onChange={(e) => switchTheme(e.target.value)}
        style={{
          width: "100%", padding: "6px 10px", borderRadius: 8, marginBottom: 10,
          background: colors.paper, color: colors.ink,
          border: `1px solid ${colors.rule}`,
          fontFamily: "var(--joy-font-body)", fontSize: 13, cursor: "pointer",
        }}
      >
        {Object.entries(PRESETS).map(([key, p]) => (
          <option key={key} value={key}>{p.label}</option>
        ))}
      </select>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {["light", "dark"].map(m => (
          <button key={m} onClick={() => switchMode(m)} style={{
            ...btnGhost, flex: 1, textTransform: "uppercase",
            background: theme.mode === m ? colors.teal : "transparent",
            color: theme.mode === m ? "#ffffff" : colors.inkSoft,
            border: `1px solid ${theme.mode === m ? colors.teal : colors.rule}`,
          }}>{m === "dark" ? <><Moon size={11}/> dark</> : <><Sun size={11}/> light</>}</button>
        ))}
      </div>

      <div style={{ ...mutedLabel, marginBottom: 6 }}>COLORS</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {CUSTOMIZE_SLOTS.map(slot => {
          const current = (theme.overrides && theme.overrides[slot.key]) || presetVars[slot.key];
          const isOverridden = !!(theme.overrides && theme.overrides[slot.key]);
          return (
            <div key={slot.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{
                position: "relative", width: 36, height: 36, borderRadius: 10,
                background: current, border: `1px solid ${colors.rule}`, cursor: "pointer",
                flexShrink: 0, overflow: "hidden",
              }} title="Pick a color">
                <input
                  type="color"
                  value={current}
                  onChange={(e) => setSlot(slot.key, e.target.value)}
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", border: "none" }}
                />
              </label>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--joy-font-head)", fontWeight: 600, fontSize: 14, lineHeight: 1.1 }}>{slot.label}</div>
                <div style={{ fontFamily: "var(--joy-font-mono)", fontSize: 10, color: colors.inkSoft, letterSpacing: "0.06em" }}>{slot.sub} · {current}</div>
              </div>
              {isOverridden && (
                <button onClick={() => resetSlot(slot.key)} style={btnIcon} title="Reset to preset">
                  <RotateCcw size={12}/>
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={resetAll} style={{ ...btnGhost, marginTop: 14, width: "100%", justifyContent: "center" }}>
        <RotateCcw size={11}/> Reset colors to preset
      </button>

      <div style={{ ...mutedLabel, marginTop: 16, marginBottom: 6 }}>FONTS</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {["head", "body", "mono"].map(slot => (
          <div key={slot} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontFamily: "var(--joy-font-mono)", fontSize: 10, letterSpacing: "0.08em", color: colors.inkSoft, textTransform: "uppercase" }}>
                {fontSlotLabel[slot]}
              </span>
              <select
                value={fonts[slot]}
                onChange={(e) => setFont(slot, e.target.value)}
                style={{
                  flex: 1, padding: "4px 8px", borderRadius: 8,
                  background: colors.paper, color: colors.ink,
                  border: `1px solid ${colors.rule}`, fontFamily: "var(--joy-font-body)",
                  fontSize: 12, cursor: "pointer",
                }}
              >
                {FONT_OPTIONS[slot].map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div style={{
              fontFamily: fontStack(fonts[slot], slot),
              fontSize: slot === "head" ? 22 : slot === "mono" ? 13 : 15,
              fontWeight: slot === "head" ? 700 : 400,
              fontStyle: slot === "head" ? "italic" : "normal",
              color: colors.ink, lineHeight: 1.2,
              padding: "4px 0 2px",
            }}>
              {fontPreview[slot]}
            </div>
          </div>
        ))}
      </div>
      <button onClick={resetFonts} style={{ ...btnGhost, marginTop: 12, width: "100%", justifyContent: "center" }}>
        <RotateCcw size={11}/> Reset fonts to default
      </button>
    </div>
  );
}

function ThemeProvider({ children }) {
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

function Pill({ children, tone = "ink" }) {
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

function Slider({ value, onChange, min, max, step = 1, color = colors.ink, label }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--joy-font-mono)", fontSize: 10, color: colors.inkSoft, letterSpacing: "0.06em", marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color: color, fontWeight: 600 }}>{value > 0 ? `+${value}` : value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
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

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

function AppInner() {
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("matrix");
  const [editingTask, setEditingTask] = useState(null);
  const { theme, setTheme } = useTheme();
  const isDark = theme.mode === "dark";
  const toggleMode = () => setTheme(t => ({ ...t, mode: t.mode === "dark" ? "light" : "dark" }));
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const fileInputRef = React.useRef(null);
  const vw = useViewportWidth();
  const isPhone = vw < 480;

  // load
  useEffect(() => {
    const saved = loadState();
    setState(saved ?? DEMO_STATE);
  }, []);

  // save
  useEffect(() => {
    if (state) saveState(state);
  }, [state]);

  const { assignments, summary } = useMemo(
    () => state ? computeAssignments(state) : { assignments: {}, summary: [] },
    [state]
  );

  if (!state) {
    return (
      <div style={{ minHeight: "100vh", background: colors.paper, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--joy-font-head)", color: colors.ink }}>
        loading…
      </div>
    );
  }

  const update = (fn) => setState((s) => fn(structuredClone(s)));

  const addMember = () => {
    const name = prompt("Team member name?");
    if (!name) return;
    update(s => {
      const id = "m" + Date.now();
      s.members.push({ id, name, capacity: 0, categoryScores: {}, availability: weekdayNineToFive(), windows: defaultWindows() });
      // initialize empty scores in each task
      s.tasks.forEach(t => { t.scores[id] = { pleasure: 0, talent: 0, difficulty: 3 }; });
      return s;
    });
  };

  const removeMember = (id) => {
    update(s => {
      s.members = s.members.filter(m => m.id !== id);
      s.tasks.forEach(t => { delete t.scores[id]; });
      return s;
    });
  };

  const addTask = () => {
    const title = prompt("Task title?");
    if (!title) return;
    update(s => {
      const id = "t" + Date.now();
      const scores = {};
      // New tasks start with autoFilled=true so the first category pick
      // can seed scores from each member's baseline.
      s.members.forEach(m => { scores[m.id] = { pleasure: 0, talent: 0, difficulty: 3, autoFilled: true }; });
      s.tasks.push({ id, title, categoryId: null, stakeholderId: null, urgency: 3, importance: 3, effort: 2, dueDate: null, scores });
      return s;
    });
  };

  // When a task's category changes, copy each member's baseline pleasure +
  // talent for that category into the task's per-member score — but only
  // for entries the user hasn't hand-edited (autoFilled flag still true).
  const setTaskCategory = (taskId, categoryId) => {
    update(s => {
      const t = s.tasks.find(x => x.id === taskId);
      if (!t) return s;
      t.categoryId = categoryId || null;
      if (!categoryId) return s;
      s.members.forEach(m => {
        const sc = t.scores[m.id];
        if (!sc || !sc.autoFilled) return;
        const baseline = (m.categoryScores || {})[categoryId];
        if (!baseline) return;
        t.scores[m.id] = {
          pleasure: baseline.pleasure ?? 0,
          talent: baseline.talent ?? 0,
          autoFilled: true,
        };
      });
      return s;
    });
  };

  const removeTask = (id) => {
    update(s => { s.tasks = s.tasks.filter(t => t.id !== id); return s; });
  };

  const reset = () => {
    if (!confirm("Reset to demo data? Current state will be lost.")) return;
    setState(structuredClone(DEMO_STATE));
  };
  const clearAll = () => {
    if (!confirm("Clear everything?")) return;
    setState(structuredClone(EMPTY_STATE));
  };

  const exportProject = () => {
    const envelope = buildExportEnvelope(state);
    const date = new Date().toISOString().slice(0, 10);
    triggerJsonDownload(`joy-matrix-${date}.json`, envelope);
  };

  const triggerImport = () => fileInputRef.current?.click();
  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same filename later
    if (!file) return;
    const raw = await file.text();
    const result = parseImport(raw);
    if (result.error) { alert(result.error); return; }
    if (!confirm("Replace current project with imported data? This cannot be undone.")) return;
    setState(result.project);
  };

  return (
    <div style={{
      minHeight: "100vh", background: colors.paper, color: colors.ink,
      fontFamily: "var(--joy-font-body)",
      backgroundImage: "radial-gradient(circle at 20% 0%, rgba(184,73,42,0.06), transparent 50%), radial-gradient(circle at 80% 100%, rgba(42,93,93,0.05), transparent 50%)",
    }}>
      {/* header */}
      <header style={{ padding: "32px 20px 16px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontFamily: "var(--joy-font-mono)", fontSize: 11, letterSpacing: "0.18em", color: colors.inkSoft }}>
            THE JOY MATRIX · v1
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 6 }}>
            <button onClick={toggleMode} title={isDark ? "Switch to light" : "Switch to dark"} style={btnGhost} aria-label="Toggle light/dark">
              {isDark ? <Sun size={12} /> : <Moon size={12} />} {isDark ? "light" : "dark"}
            </button>
            <button onClick={() => setCustomizeOpen(o => !o)} title="Customize colors" style={btnGhost} aria-label="Customize colors">
              <Palette size={12} /> customize
            </button>
            <button onClick={triggerImport} title="Import project from file" style={btnGhost} aria-label="Import project">
              <Upload size={12} /> import
            </button>
            <button onClick={exportProject} title="Export project as JSON" style={btnGhost} aria-label="Export project">
              <Download size={12} /> export
            </button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={onImportFile} style={{ display: "none" }} />
            <button onClick={reset} title="Load demo data" style={btnGhost}>
              <RefreshCw size={12} /> demo
            </button>
            <button onClick={clearAll} title="Clear all" style={btnGhost}>
              <Trash2 size={12} /> clear
            </button>
          </div>
        </div>

        <h1 style={{
          fontFamily: "var(--joy-font-head)", fontWeight: 900, fontStyle: "italic",
          fontSize: "clamp(36px, 7vw, 64px)", lineHeight: 0.95, letterSpacing: "-0.02em",
          margin: "12px 0 4px",
          fontVariationSettings: '"opsz" 144',
        }}>
          From <span style={{ fontStyle: "normal", fontWeight: 400, color: colors.rustDeep }}>A</span>{" "}
          to <span style={{ fontStyle: "normal", fontWeight: 400, color: colors.teal }}>B</span>,
          <br/>
          <span style={{ fontWeight: 400, fontStyle: "normal", color: colors.inkSoft, fontSize: "0.6em" }}>
            without burning anyone out.
          </span>
        </h1>

        {/* goal box */}
        <div style={{
          marginTop: 20, padding: 16, borderRadius: 12,
          background: colors.bone, border: `1px solid ${colors.rule}`,
          display: "grid",
          gridTemplateColumns: isPhone ? "1fr" : "1fr auto 1fr",
          gap: isPhone ? 10 : 12,
          alignItems: "center",
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={mutedLabel}>FROM (A)</div>
            <AutoGrowTextarea
              value={state.goal.from}
              onChange={(v) => update(s => { s.goal.from = v; return s; })}
              placeholder="where you are now"
            />
          </div>
          <ArrowRight
            size={20}
            color={colors.inkSoft}
            style={{
              transform: isPhone ? "rotate(90deg)" : "none",
              justifySelf: isPhone ? "center" : "auto",
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ ...mutedLabel, color: colors.teal }}>TO (B)</div>
            <AutoGrowTextarea
              value={state.goal.to}
              onChange={(v) => update(s => { s.goal.to = v; return s; })}
              placeholder="where you want to be"
            />
          </div>
        </div>
      </header>

      {/* tabs */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 10,
        background: `color-mix(in srgb, ${colors.paper} 93%, transparent)`, backdropFilter: "blur(8px)",
        borderTop: `1px solid ${colors.rule}`, borderBottom: `1px solid ${colors.rule}`,
        padding: isPhone ? "8px 10px" : "10px 16px", marginBottom: 4,
      }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          display: "flex",
          gap: isPhone ? 2 : 4,
          justifyContent: isPhone ? "space-between" : "flex-start",
        }}>
          {[
            ["matrix",  "Matrix",  Grid3x3],
            ["team",    "Team",    Users],
            ["tasks",   "Tasks",   ListTodo],
            ["schedule","Schedule",Calendar],
            ["insights","Insights",Activity],
          ].map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              ...tabBtn,
              ...(tab === key ? tabBtnActive : {}),
              ...(isPhone ? { padding: "6px 8px", fontSize: 10, gap: 4, flex: "0 1 auto" } : {}),
            }}>
              <Icon size={isPhone ? 12 : 13} /> {label}
            </button>
          ))}
        </div>
      </nav>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 16px 80px" }}>
        {tab === "matrix"   && <MatrixView state={state} assignments={assignments} onEditTask={(t) => { setTab("tasks"); setEditingTask(t.id); }} />}
        {tab === "team"     && <TeamView state={state} update={update} addMember={addMember} removeMember={removeMember} summary={summary} />}
        {tab === "tasks"    && <TasksView state={state} update={update} addTask={addTask} removeTask={removeTask} editing={editingTask} setEditing={setEditingTask} assignments={assignments} setTaskCategory={setTaskCategory} />}
        {tab === "schedule" && <ScheduleView state={state} assignments={assignments} />}
        {tab === "insights" && <InsightsView state={state} summary={summary} assignments={assignments} />}
      </main>

      <footer style={{
        padding: "24px 16px 40px", fontFamily: "var(--joy-font-mono)", fontSize: 10,
        color: colors.inkSoft, letterSpacing: "0.08em",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      }}>
        <div>─── designed for sustainable speed ───</div>
        <a
          href="https://github.com/benzwick/joy-matrix"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: colors.inkSoft, textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
        >
          <Github size={11} />
          open source · benzwick/joy-matrix
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
          <a
            href="https://www.linkedin.com/in/benzwick"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ben Zwick on LinkedIn"
            title="Ben Zwick on LinkedIn"
            style={{
              color: colors.inkSoft, textDecoration: "none",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 26, height: 26, borderRadius: 999,
              border: `1px solid ${colors.rule}`,
            }}
          >
            <Linkedin size={13} />
          </a>
          <a
            href="https://github.com/benzwick"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ben Zwick on GitHub"
            title="Ben Zwick on GitHub"
            style={{
              color: colors.inkSoft, textDecoration: "none",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 26, height: 26, borderRadius: 999,
              border: `1px solid ${colors.rule}`,
            }}
          >
            <Github size={13} />
          </a>
          <a
            href="https://www.instagram.com/bennyzwick"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ben Zwick on Instagram"
            title="Ben Zwick on Instagram"
            style={{
              color: colors.inkSoft, textDecoration: "none",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 26, height: 26, borderRadius: 999,
              border: `1px solid ${colors.rule}`,
            }}
          >
            <Instagram size={13} />
          </a>
        </div>
        <a
          href="https://talk2view.com/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: colors.inkSoft, textDecoration: "none",
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 4, marginTop: 14,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span>Powered by</span>
            <img src="talk2view-logo.png" alt="Talk2View" style={{ height: 22, width: "auto", display: "block" }} />
          </span>
          <span>"software you can talk to…"</span>
        </a>
      </footer>

      {customizeOpen && <CustomizePanel onClose={() => setCustomizeOpen(false)} />}
      <JoyMatrixChat
        state={state}
        summary={summary}
        assignments={assignments}
        update={update}
        setTab={setTab}
        setTheme={setTheme}
        loadDemo={() => setState(structuredClone(DEMO_STATE))}
        clearProject={() => setState(structuredClone(EMPTY_STATE))}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Matrix View
// ─────────────────────────────────────────────────────────────────────────────

function MatrixView({ state, assignments, onEditTask }) {
  const isPhone = useViewportWidth() < 480;
  const groups = { DO: [], SCHEDULE: [], DELEGATE: [], ELIMINATE: [] };
  state.tasks.forEach(t => groups[quadrantOf(t)].push(t));

  const cellMeta = {
    DO:        { color: colors.rustDeep, bg: "rgba(184,73,42,0.06)" },
    SCHEDULE:  { color: colors.teal,     bg: "rgba(42,93,93,0.06)" },
    DELEGATE:  { color: colors.ochre,    bg: "rgba(201,138,44,0.07)" },
    ELIMINATE: { color: colors.inkSoft,  bg: "rgba(28,25,22,0.04)" },
  };

  return (
    <div>
      <SectionHead
        eyebrow="01"
        title="The Matrix"
        sub="Tasks placed by urgency × importance, then auto-assigned."
      />

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr",
        gap: isPhone ? 6 : 10,
        marginTop: 16, minHeight: isPhone ? 360 : 480,
      }}>
        {["DO", "SCHEDULE", "DELEGATE", "ELIMINATE"].map(q => {
          const meta = QUADRANT_META[q];
          const cm = cellMeta[q];
          return (
            <div key={q} style={{
              borderRadius: 14,
              padding: isPhone ? "10px 10px 8px" : "14px 14px 10px",
              background: cm.bg, border: `1px solid ${colors.rule}`,
              display: "flex", flexDirection: "column", gap: 8,
              minHeight: isPhone ? 160 : 220,
            }}>
              <div>
                <div style={{ fontFamily: "var(--joy-font-head)", fontWeight: 700, fontSize: isPhone ? 18 : 22, color: cm.color, letterSpacing: "-0.02em" }}>
                  <span style={{ opacity: 0.5, marginRight: 6 }}>{QUADRANT_ORDER[q]}.</span>{meta.label}
                </div>
                <div style={{ fontFamily: "var(--joy-font-mono)", fontSize: 9, letterSpacing: "0.1em", color: colors.inkSoft, textTransform: "uppercase" }}>
                  {meta.sub}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                {groups[q].length === 0 && (
                  <div style={{ fontFamily: "var(--joy-font-head)", fontStyle: "italic", color: colors.inkSoft, fontSize: 13 }}>
                    nothing here yet
                  </div>
                )}
                {groups[q].map(t => {
                  const a = assignments[t.id];
                  const assignee = a ? state.members.find(m => m.id === a.memberId) : null;
                  const stakeholder = t.stakeholderId ? (state.stakeholders || []).find(s => s.id === t.stakeholderId) : null;
                  return (
                    <button key={t.id} onClick={() => onEditTask(t)} style={{
                      textAlign: "left", padding: "8px 10px", borderRadius: 8,
                      background: colors.bone, border: `1px solid ${colors.rule}`,
                      cursor: "pointer", color: colors.ink,
                      display: "flex", flexDirection: "column", gap: 4,
                    }}>
                      <div style={{ fontWeight: 500, fontSize: 13.5, lineHeight: 1.25 }}>{t.title}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {assignee ? (
                          <span style={{ fontFamily: "var(--joy-font-mono)", fontSize: 10, color: cm.color, fontWeight: 600 }}>
                            → {assignee.name}
                          </span>
                        ) : q !== "ELIMINATE" ? (
                          <span style={{ fontFamily: "var(--joy-font-mono)", fontSize: 10, color: colors.inkSoft }}>unassigned</span>
                        ) : (
                          <span style={{ fontFamily: "var(--joy-font-mono)", fontSize: 10, color: colors.inkSoft }}>drop or defer</span>
                        )}
                        {stakeholder && (
                          <span style={{ fontFamily: "var(--joy-font-mono)", fontSize: 9, color: colors.teal, letterSpacing: "0.04em" }}>
                            for {stakeholder.name}
                          </span>
                        )}
                        {a?.burnoutRisk && (
                          <span title="burnout risk" style={{ display: "inline-flex", alignItems: "center", gap: 2, fontFamily: "var(--joy-font-mono)", fontSize: 9, color: colors.rustDeep }}>
                            <AlertTriangle size={10} /> risk
                          </span>
                        )}
                        {t.dueDate && (
                          <DueDateChip dueDate={t.dueDate} />
                        )}
                        <span style={{ fontFamily: "var(--joy-font-mono)", fontSize: 9, color: colors.inkSoft, marginLeft: "auto" }}>
                          U{t.urgency} I{t.importance} E{t.effort}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Legend />
    </div>
  );
}

function Legend() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      marginTop: 18, padding: 14, borderRadius: 10,
      background: colors.bone, border: `1px solid ${colors.rule}`,
    }}>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12,
        fontSize: 12, color: colors.inkSoft, lineHeight: 1.5,
      }}>
        <div>
          <div style={{ ...mutedLabel, color: colors.ochre, marginBottom: 4 }}>1. DELEGATE — capacity first</div>
          Urgent but not important. Capacity sets a ceiling, not a target — planning well doesn't load you with leftover work.
        </div>
        <div>
          <div style={{ ...mutedLabel, color: colors.rustDeep, marginBottom: 4 }}>2. DO — talent first</div>
          High-urgency, high-importance. Algorithm weighs talent heaviest so it gets done well, fast.
        </div>
        <div>
          <div style={{ ...mutedLabel, color: colors.teal, marginBottom: 4 }}>3. SCHEDULE — pleasure first</div>
          Important, not urgent. Pleasure dominates — this is where joy compounds into mastery.
        </div>
        <div>
          <div style={{ ...mutedLabel, color: colors.inkSoft, marginBottom: 4 }}>4. ELIMINATE — kill it</div>
          Neither urgent nor important. Don't assign. Don't do.
        </div>
      </div>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
        <button onClick={() => setExpanded(v => !v)} style={{
          background: "transparent", border: "none", cursor: "pointer",
          color: colors.teal, fontFamily: "var(--joy-font-mono)", fontSize: 11,
          letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 4px",
        }}>
          {expanded ? "less" : "more"}
        </button>
      </div>
      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 12, borderTop: `1px solid ${colors.rule}`, fontSize: 13, lineHeight: 1.65, color: colors.inkSoft }}>
          <p style={{ margin: "0 0 12px" }}>
            The Joy Matrix sorts tasks by <strong>urgency</strong> (how soon) × <strong>importance</strong> (how much it matters). The numbers above are workflow order, not grid positions.
          </p>
          <p style={{ margin: "0 0 12px" }}>
            <strong>1. Delegate</strong> so other people can begin in parallel. The Joy Matrix routes each task by fit — <em>pleasure × talent × capacity</em> — with capacity acting as a ceiling, not a target, so reliable planners aren't loaded with leftover work.
          </p>
          <p style={{ margin: "0 0 12px" }}>
            <strong>2. Do</strong> the urgent, important work that remains with you after delegation.
          </p>
          <p style={{ margin: "0 0 12px" }}>
            <strong>3. Schedule</strong> the important-but-not-urgent work, where expertise compounds and next quarter's fires are prevented. It's the quadrant most people under-invest in.
          </p>
          <p style={{ margin: 0 }}>
            <strong>4. Eliminate</strong> the residue: anything still in the bottom-right after the first three passes.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Team View
// ─────────────────────────────────────────────────────────────────────────────

function TeamView({ state, update, addMember, removeMember, summary }) {
  return (
    <div>
      <SectionHead
        eyebrow="02"
        title="The Team"
        sub="Capacity is current bandwidth, not a fixed trait. It changes week to week."
        action={<button onClick={addMember} style={btnPrimary}><Plus size={14}/> add member</button>}
      />

      {state.members.length === 0 && (
        <Empty>No team members yet. Add someone to begin.</Empty>
      )}

      <div style={{ display: "grid", gap: 12, marginTop: 16, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {state.members.map(m => {
          const s = summary.find(x => x.memberId === m.id);
          return (
            <div key={m.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                <input
                  value={m.name}
                  onChange={(e) => update(st => { st.members.find(x => x.id === m.id).name = e.target.value; return st; })}
                  style={{ ...inputBare, fontFamily: "var(--joy-font-head)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", padding: 0 }}
                />
                <button onClick={() => removeMember(m.id)} style={btnIcon} title="remove"><X size={14}/></button>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <Battery size={12} color={colors.teal} />
                  <span style={mutedLabel}>CAPACITY</span>
                </div>
                <Slider
                  value={m.capacity}
                  onChange={(v) => update(st => { st.members.find(x => x.id === m.id).capacity = v; return st; })}
                  min={-3} max={3} color={colors.teal} label={capacityWord(m.capacity)}
                />
              </div>

              <MemberBaselines member={m} categories={state.categories || []} update={update} />

              <MemberAvailability member={m} update={update} />

              <MemberWindows member={m} update={update} />

              {s && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${colors.rule}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <Stat label="tasks" value={s.taskCount} />
                    <Stat label="load" value={`${s.totalEffort}/${s.budget.toFixed(1)}`} />
                    <Stat label="joy" value={s.joyIndex > 0 ? `+${s.joyIndex}` : s.joyIndex} tone={s.joyIndex >= 0 ? "teal" : "rust"} />
                    <Stat label="talent fit" value={s.talentIndex > 0 ? `+${s.talentIndex}` : s.talentIndex} />
                  </div>
                  {s.burnout && (
                    <div style={warnBox}>
                      <AlertTriangle size={13}/> Burnout risk — over capacity by {Math.abs(s.remaining).toFixed(1)}
                    </div>
                  )}
                  {s.strain && (
                    <div style={{ ...warnBox, background: "rgba(201,138,44,0.10)", color: colors.ochre, border: "1px solid rgba(201,138,44,0.3)" }}>
                      <AlertTriangle size={13}/> Stretched — at limit
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MemberBaselines({ member, categories, update }) {
  const [open, setOpen] = useState(false);
  if (categories.length === 0) return null;
  const scores = member.categoryScores || {};
  const setScore = (catId, field, value) => update(st => {
    const m = st.members.find(x => x.id === member.id);
    m.categoryScores = m.categoryScores || {};
    m.categoryScores[catId] = { pleasure: 0, talent: 0, ...m.categoryScores[catId], [field]: value };
    return st;
  });
  // Summary: which categories have non-zero scores
  const nonZero = categories.filter(c => {
    const s = scores[c.id] || {};
    return (s.pleasure || 0) !== 0 || (s.talent || 0) !== 0;
  });
  return (
    <div style={{ marginTop: 14 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: "transparent", border: "none", padding: 0, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6, width: "100%",
          fontFamily: "var(--joy-font-mono)", fontSize: 10, letterSpacing: "0.12em",
          textTransform: "uppercase", color: colors.inkSoft,
        }}
        aria-expanded={open}
      >
        <span>CATEGORY BASELINES {nonZero.length > 0 && `· ${nonZero.length}`}</span>
        <span style={{ marginLeft: "auto", fontSize: 14 }}>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {categories.map(c => {
            const sc = scores[c.id] || { pleasure: 0, talent: 0 };
            return (
              <div key={c.id} style={{
                padding: "8px 10px", background: "rgba(28,25,22,0.025)", borderRadius: 8,
                display: "grid", gridTemplateColumns: "1fr", gap: 8,
              }}>
                <div style={{ fontFamily: "var(--joy-font-head)", fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Slider value={sc.pleasure} onChange={(v) => setScore(c.id, "pleasure", v)} min={-3} max={3} color={colors.rust} label={<span><Heart size={9} style={{display:"inline"}}/> pleasure</span>} />
                  <Slider value={sc.talent} onChange={(v) => setScore(c.id, "talent", v)} min={-3} max={3} color={colors.teal} label={<span><Brain size={9} style={{display:"inline"}}/> talent</span>} />
                </div>
              </div>
            );
          })}
          <div style={{ fontFamily: "var(--joy-font-head)", fontStyle: "italic", fontSize: 11.5, color: colors.inkSoft, lineHeight: 1.4 }}>
            Baselines auto-fill task scores when a task is assigned a category. You can still override per task.
          </div>
        </div>
      )}
    </div>
  );
}

// Per-day availability windows editor. Collapsed by default; renders
// 7 rows when open with inline HH:MM range editing.
function MemberAvailability({ member, update }) {
  const [open, setOpen] = useState(false);
  const availability = member.availability || {};
  const totalRanges = DAYS.reduce((n, d) => n + (availability[d]?.length || 0), 0);

  const setDay = (day, ranges) => update(st => {
    const m = st.members.find(x => x.id === member.id);
    m.availability = m.availability || {};
    m.availability[day] = normaliseRanges(ranges);
    return st;
  });

  const fillWeekdays = () => update(st => {
    const m = st.members.find(x => x.id === member.id);
    m.availability = m.availability || {};
    for (const d of DAYS) {
      m.availability[d] = WEEKDAYS.includes(d) ? [{ from: "09:00", to: "17:00" }] : [];
    }
    return st;
  });

  return (
    <div style={{ marginTop: 14 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: "transparent", border: "none", padding: 0, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6, width: "100%",
          fontFamily: "var(--joy-font-mono)", fontSize: 10, letterSpacing: "0.12em",
          textTransform: "uppercase", color: colors.inkSoft,
        }}
        aria-expanded={open}
      >
        <span>AVAILABILITY {totalRanges > 0 && `· ${totalRanges} window${totalRanges === 1 ? "" : "s"}`}</span>
        <span style={{ marginLeft: "auto", fontSize: 14 }}>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={fillWeekdays} style={{ ...btnGhost, alignSelf: "start", fontSize: 10, padding: "4px 10px" }}>
            ⤺ weekdays 9–5
          </button>
          {DAYS.map(d => {
            const ranges = availability[d] || [];
            return (
              <div key={d} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ fontFamily: "var(--joy-font-mono)", fontSize: 10, color: colors.inkSoft, minWidth: 28 }}>
                  {DAY_LABELS[d]}
                </span>
                {ranges.length === 0 && (
                  <span style={{ color: colors.inkSoft, fontStyle: "italic" }}>off</span>
                )}
                {ranges.map((r, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="time"
                      value={r.from}
                      onChange={(e) => {
                        const next = ranges.map((x, j) => j === i ? { ...x, from: e.target.value } : x);
                        setDay(d, next);
                      }}
                      style={{
                        fontFamily: "var(--joy-font-mono)", fontSize: 11,
                        padding: "2px 4px", borderRadius: 4,
                        background: colors.paper, color: colors.ink,
                        border: `1px solid ${colors.rule}`,
                      }}
                    />
                    <span style={{ color: colors.inkSoft }}>–</span>
                    <input
                      type="time"
                      value={r.to}
                      onChange={(e) => {
                        const next = ranges.map((x, j) => j === i ? { ...x, to: e.target.value } : x);
                        setDay(d, next);
                      }}
                      style={{
                        fontFamily: "var(--joy-font-mono)", fontSize: 11,
                        padding: "2px 4px", borderRadius: 4,
                        background: colors.paper, color: colors.ink,
                        border: `1px solid ${colors.rule}`,
                      }}
                    />
                    <button
                      onClick={() => setDay(d, ranges.filter((_, j) => j !== i))}
                      style={{ ...btnIcon, width: 18, height: 18 }}
                      title="remove range"
                    >
                      <X size={10}/>
                    </button>
                  </span>
                ))}
                <button
                  onClick={() => {
                    const last = ranges[ranges.length - 1];
                    const from = last ? last.to : "09:00";
                    const toHour = Math.min(23, parseInt(from, 10) + 4);
                    const to = `${String(toHour).padStart(2, "0")}:00`;
                    setDay(d, [...ranges, { from, to }]);
                  }}
                  style={{ ...btnGhost, fontSize: 10, padding: "2px 6px", marginLeft: "auto" }}
                  title="add range"
                >
                  + range
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Per-time-of-day energy + concentration sliders. Collapsed by default;
// when open shows 4 rows (morning / midday / afternoon / evening), each
// with two 1–3 sliders. The scheduler uses these to match task effort
// and difficulty against the right time of day.
function MemberWindows({ member, update }) {
  const [open, setOpen] = useState(false);
  const windows = member.windows || defaultWindows();

  const setBucket = (bucket, field, value) => update(st => {
    const m = st.members.find(x => x.id === member.id);
    m.windows = m.windows || defaultWindows();
    m.windows[bucket] = { ...m.windows[bucket], [field]: value };
    return st;
  });

  // Sum tells the user "how skewed is this curve" — non-neutral if any
  // bucket score differs from 2.
  const nonNeutral = DAYTIMES.some(t => {
    const w = windows[t] || { energy: 2, concentration: 2 };
    return w.energy !== 2 || w.concentration !== 2;
  });

  return (
    <div style={{ marginTop: 14 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: "transparent", border: "none", padding: 0, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6, width: "100%",
          fontFamily: "var(--joy-font-mono)", fontSize: 10, letterSpacing: "0.12em",
          textTransform: "uppercase", color: colors.inkSoft,
        }}
        aria-expanded={open}
      >
        <span>ENERGY · CONCENTRATION {nonNeutral && "· tuned"}</span>
        <span style={{ marginLeft: "auto", fontSize: 14 }}>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {DAYTIMES.map(bucket => {
            const w = windows[bucket] || { energy: 2, concentration: 2 };
            return (
              <div key={bucket} style={{
                display: "grid", gridTemplateColumns: "minmax(70px, 80px) 1fr 1fr", gap: 8, alignItems: "center",
                padding: "6px 8px", background: "rgba(28,25,22,0.025)", borderRadius: 6,
              }}>
                <div style={{ fontFamily: "var(--joy-font-mono)", fontSize: 10, color: colors.inkSoft, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {DAYTIME_LABELS[bucket]}
                </div>
                <Slider
                  value={w.energy}
                  onChange={(v) => setBucket(bucket, "energy", v)}
                  min={1} max={3} color={colors.rust}
                  label={<span><Zap size={9} style={{display:"inline"}}/> {SCORE_LABELS[w.energy]}</span>}
                />
                <Slider
                  value={w.concentration}
                  onChange={(v) => setBucket(bucket, "concentration", v)}
                  min={1} max={3} color={colors.teal}
                  label={<span><Brain size={9} style={{display:"inline"}}/> {SCORE_LABELS[w.concentration]}</span>}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function capacityWord(c) {
  if (c >= 2) return "lots of bandwidth";
  if (c === 1) return "available";
  if (c === 0) return "neutral";
  if (c === -1) return "stretched";
  if (c === -2) return "near limit";
  return "overloaded";
}

function Stat({ label, value, tone = "ink" }) {
  const colorMap = { ink: colors.ink, teal: colors.teal, rust: colors.rustDeep };
  return (
    <div>
      <div style={mutedLabel}>{label}</div>
      <div style={{ fontFamily: "var(--joy-font-head)", fontWeight: 700, fontSize: 20, color: colorMap[tone], lineHeight: 1.1, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tasks View
// ─────────────────────────────────────────────────────────────────────────────

function TasksView({ state, update, addTask, removeTask, editing, setEditing, assignments, setTaskCategory }) {
  const isPhone = useViewportWidth() < 480;
  return (
    <div>
      <SectionHead
        eyebrow="03"
        title="The Tasks"
        sub="Score each person's pleasure & talent for each task. Be honest."
        action={<button onClick={addTask} style={btnPrimary}><Plus size={14}/> add task</button>}
      />

      <CategoriesBar state={state} update={update} />
      <StakeholdersBar state={state} update={update} />

      {state.tasks.length === 0 && (
        <Empty>No tasks yet.</Empty>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {state.tasks.map(t => {
          const isOpen = editing === t.id;
          const a = assignments[t.id];
          const assignee = a ? state.members.find(m => m.id === a.memberId) : null;
          const q = quadrantOf(t);
          return (
            <div key={t.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: isPhone ? 4 : 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    value={t.title}
                    onChange={(e) => update(st => { st.tasks.find(x => x.id === t.id).title = e.target.value; return st; })}
                    style={{ ...inputBare, fontFamily: "var(--joy-font-head)", fontSize: isPhone ? 16 : 18, fontWeight: 600, letterSpacing: "-0.01em", padding: 0 }}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <Pill tone={q === "DO" ? "rust" : q === "SCHEDULE" ? "teal" : "ink"}>{q}</Pill>
                    {assignee && <Pill tone="ink">→ {assignee.name}</Pill>}
                    {a?.burnoutRisk && <Pill tone="warn"><AlertTriangle size={9} style={{ display: "inline", verticalAlign: "middle" }} /> risk</Pill>}
                    {t.dueDate && <DueDatePill dueDate={t.dueDate} />}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => setEditing(isOpen ? null : t.id)}
                    style={isPhone ? btnIcon : btnGhost}
                    title={isOpen ? "Close editor" : "Edit task"}
                    aria-label={isOpen ? "Close editor" : "Edit task"}
                  >
                    {isPhone ? (isOpen ? <X size={14}/> : "✎") : (isOpen ? "close" : "edit")}
                  </button>
                  {!isPhone && <button onClick={() => removeTask(t.id)} style={btnIcon}><X size={14}/></button>}
                  {isPhone && !isOpen && <button onClick={() => removeTask(t.id)} style={btnIcon} title="Delete task" aria-label="Delete task"><Trash2 size={13}/></button>}
                </div>
              </div>

              {a?.reasoning && !isOpen && (
                <div style={{ marginTop: 8, fontSize: 12, color: colors.inkSoft, fontStyle: "italic", fontFamily: "var(--joy-font-head)" }}>
                  "{a.reasoning}"
                </div>
              )}

              {isOpen && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${colors.rule}`, display: "flex", flexDirection: "column", gap: 14 }}>
                  {((state.categories || []).length > 0 || (state.stakeholders || []).length > 0) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      {(state.categories || []).length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={mutedLabel}>CATEGORY</span>
                          <select
                            value={t.categoryId || ""}
                            onChange={(e) => setTaskCategory(t.id, e.target.value || null)}
                            style={{
                              padding: "5px 10px", borderRadius: 8,
                              background: colors.paper, color: colors.ink,
                              border: `1px solid ${colors.rule}`,
                              fontFamily: "var(--joy-font-body)", fontSize: 13, cursor: "pointer",
                            }}
                          >
                            <option value="">— uncategorized —</option>
                            {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      {(state.stakeholders || []).length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={mutedLabel}>FOR</span>
                          <select
                            value={t.stakeholderId || ""}
                            onChange={(e) => update(st => { st.tasks.find(x => x.id === t.id).stakeholderId = e.target.value || null; return st; })}
                            style={{
                              padding: "5px 10px", borderRadius: 8,
                              background: colors.paper, color: colors.ink,
                              border: `1px solid ${colors.rule}`,
                              fontFamily: "var(--joy-font-body)", fontSize: 13, cursor: "pointer",
                            }}
                          >
                            <option value="">— nobody specific —</option>
                            {state.stakeholders.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                          </select>
                        </div>
                      )}
                      {t.categoryId && (
                        <span style={{ fontFamily: "var(--joy-font-head)", fontStyle: "italic", fontSize: 12, color: colors.inkSoft }}>
                          changing category re-seeds untouched scores
                        </span>
                      )}
                    </div>
                  )}
                  <DueDatePicker
                    value={t.dueDate}
                    onChange={(next) => update(st => { st.tasks.find(x => x.id === t.id).dueDate = next; return st; })}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                    <Slider value={t.urgency} onChange={(v) => update(st => { st.tasks.find(x => x.id === t.id).urgency = v; return st; })} min={1} max={5} color={colors.rustDeep} label="urgency" />
                    <Slider value={t.importance} onChange={(v) => update(st => { st.tasks.find(x => x.id === t.id).importance = v; return st; })} min={1} max={5} color={colors.teal} label="importance" />
                    <Slider value={t.effort} onChange={(v) => update(st => { st.tasks.find(x => x.id === t.id).effort = v; return st; })} min={1} max={5} color={colors.ochre} label="effort" />
                  </div>

                  {state.members.length > 0 && (
                    <div>
                      <div style={{ ...mutedLabel, marginBottom: 8 }}>PER-MEMBER FIT</div>
                      <div style={{ display: "grid", gap: 10 }}>
                        {state.members.map(m => {
                          const sc = t.scores[m.id] ?? { pleasure: 0, talent: 0, difficulty: 3 };
                          const setField = (field, value) => update(st => {
                            st.tasks.find(x => x.id === t.id).scores[m.id] = { ...sc, [field]: value, autoFilled: false };
                            return st;
                          });
                          return (
                            <div key={m.id} style={{
                              display: "grid", gridTemplateColumns: "minmax(80px, 100px) 1fr 1fr 1fr", gap: 12, alignItems: "center",
                              padding: "8px 10px", background: "rgba(28,25,22,0.025)", borderRadius: 8,
                            }}>
                              <div style={{ fontFamily: "var(--joy-font-head)", fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                              <Slider value={sc.pleasure} onChange={(v) => setField("pleasure", v)} min={-3} max={3} color={colors.rust} label={<span><Heart size={9} style={{display:"inline"}}/> pleasure</span>} />
                              <Slider value={sc.talent} onChange={(v) => setField("talent", v)} min={-3} max={3} color={colors.teal} label={<span><Brain size={9} style={{display:"inline"}}/> talent</span>} />
                              <Slider value={sc.difficulty ?? 3} onChange={(v) => setField("difficulty", v)} min={1} max={5} color={colors.ochre} label={<span><Zap size={9} style={{display:"inline"}}/> difficulty</span>} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Schedule View
// ─────────────────────────────────────────────────────────────────────────────

function ScheduleView({ state, assignments }) {
  const isPhone = useViewportWidth() < 480;
  const [viewMode, setViewMode] = useState("week");
  // Memoise on the state inputs so the algorithm doesn't re-run on
  // unrelated re-renders (theme changes, hover, etc.).
  const schedule = useMemo(
    () => computeSchedule(state, assignments, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.tasks, state.members, assignments]
  );
  const totals = hoursPerMember(schedule);

  // Flatten placements into { taskId, ...block } records for sub-views.
  const allBlocks = [];
  for (const [taskId, blocks] of Object.entries(schedule.placements)) {
    for (const b of blocks) allBlocks.push({ taskId, ...b });
  }

  return (
    <div>
      <SectionHead
        eyebrow="04"
        title="The Schedule"
        sub="Tasks placed into real time, matched to each person's availability and energy curve."
        action={<ScheduleViewSwitcher value={viewMode} onChange={setViewMode} />}
      />

      {schedule.conflicts.length > 0 && (
        <div style={{
          marginTop: 16, padding: 12, borderRadius: 10,
          background: "rgba(184,73,42,0.08)", border: "1px solid rgba(184,73,42,0.3)",
          color: colors.rustDeep,
        }}>
          <div style={{ ...mutedLabel, color: colors.rustDeep, marginBottom: 6 }}>
            CONFLICTS · {schedule.conflicts.length}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            {schedule.conflicts.map((c) => (
              <div key={c.taskId}>
                <strong>{c.title}</strong> — {c.reason}
              </div>
            ))}
          </div>
        </div>
      )}

      {allBlocks.length === 0 && schedule.conflicts.length === 0 && (
        <Empty>
          Nothing scheduled. Tasks need an assigned member, a due date, and
          availability windows within the next 7 days.
        </Empty>
      )}

      {viewMode === "week" && allBlocks.length > 0 && (
        <ScheduleWeekView state={state} schedule={schedule} totals={totals} isPhone={isPhone} />
      )}
      {viewMode === "day" && (
        <ScheduleDayView state={state} schedule={schedule} allBlocks={allBlocks} isPhone={isPhone} />
      )}
      {viewMode === "month" && (
        <ScheduleMonthView state={state} schedule={schedule} allBlocks={allBlocks} />
      )}
      {viewMode === "year" && (
        <ScheduleYearView allBlocks={allBlocks} />
      )}
    </div>
  );
}

function ScheduleViewSwitcher({ value, onChange }) {
  const opts = [["day", "Day"], ["week", "Week"], ["month", "Month"], ["year", "Year"]];
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {opts.map(([k, label]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          style={{
            ...btnGhost,
            padding: "5px 10px", fontSize: 10,
            ...(value === k ? { background: colors.teal, color: "#ffffff", borderColor: colors.teal } : {}),
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ScheduleWeekView({ state, schedule, totals, isPhone }) {
  const scheduledMemberIds = new Set();
  for (const blocks of Object.values(schedule.placements)) {
    for (const b of blocks) scheduledMemberIds.add(b.memberId);
  }
  const swimLanes = state.members.filter(m => scheduledMemberIds.has(m.id));

  const dayCols = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(schedule.weekStart.getTime() + i * 24 * 60 * 60 * 1000);
    dayCols.push(d);
  }

  const placementsByMemberDay = {};
  for (const [taskId, blocks] of Object.entries(schedule.placements)) {
    for (const b of blocks) {
      const from = new Date(b.from);
      const key = `${b.memberId}|${from.getFullYear()}-${from.getMonth()}-${from.getDate()}`;
      if (!placementsByMemberDay[key]) placementsByMemberDay[key] = [];
      placementsByMemberDay[key].push({ ...b, taskId });
    }
  }

  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      {swimLanes.map((m) => (
        <ScheduleLane
          key={m.id}
          member={m}
          dayCols={dayCols}
          placementsByMemberDay={placementsByMemberDay}
          tasks={state.tasks}
          totalHours={totals[m.id] || 0}
          isPhone={isPhone}
        />
      ))}
    </div>
  );
}

// Single-day stacked view: each member is a column, rows are 30-min
// slots from earliest to latest availability across the day's blocks.
function ScheduleDayView({ state, schedule, allBlocks, isPhone }) {
  const [offset, setOffset] = useState(0);
  const day = new Date(schedule.weekStart.getTime() + offset * 24 * 60 * 60 * 1000);
  const dayBlocks = allBlocks.filter((b) => {
    const from = new Date(b.from);
    return from.getFullYear() === day.getFullYear()
      && from.getMonth() === day.getMonth()
      && from.getDate() === day.getDate();
  });

  // Member columns: only those with blocks today.
  const memberIds = [...new Set(dayBlocks.map(b => b.memberId))];
  const members = state.members.filter(m => memberIds.includes(m.id));

  // Hour range: earliest start to latest end across today's blocks.
  let minHour = 9;
  let maxHour = 17;
  if (dayBlocks.length) {
    minHour = Math.min(...dayBlocks.map(b => new Date(b.from).getHours()));
    maxHour = Math.max(...dayBlocks.map(b => new Date(b.to).getHours() + (new Date(b.to).getMinutes() > 0 ? 1 : 0)));
  }
  const rows = [];
  for (let h = minHour; h < maxHour; h++) rows.push(h);

  const tonesByQuadrant = {
    DO: { fg: colors.rustDeep, bg: "rgba(184,73,42,0.10)" },
    SCHEDULE: { fg: colors.teal, bg: "rgba(42,93,93,0.10)" },
    DELEGATE: { fg: colors.ochre, bg: "rgba(201,138,44,0.12)" },
    ELIMINATE: { fg: colors.inkSoft, bg: "rgba(28,25,22,0.06)" },
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <button onClick={() => setOffset(o => Math.max(0, o - 1))} style={btnGhost}>‹ prev</button>
        <div style={{ fontFamily: "var(--joy-font-head)", fontWeight: 700, fontSize: 18 }}>
          {day.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        </div>
        <button onClick={() => setOffset(o => Math.min(6, o + 1))} style={btnGhost}>next ›</button>
      </div>
      {members.length === 0 && <Empty>Nothing scheduled this day.</Empty>}
      {members.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: `60px repeat(${members.length}, 1fr)`,
          gap: 4,
          ...card,
          padding: 10,
        }}>
          <div></div>
          {members.map(m => (
            <div key={m.id} style={{ fontFamily: "var(--joy-font-head)", fontWeight: 700, fontSize: 14, textAlign: "center" }}>
              {m.name}
            </div>
          ))}
          {rows.map(h => (
            <React.Fragment key={h}>
              <div style={{ fontFamily: "var(--joy-font-mono)", fontSize: 10, color: colors.inkSoft, paddingTop: 4 }}>
                {String(h).padStart(2, "0")}:00
              </div>
              {members.map(m => {
                const hourBlocks = dayBlocks.filter(b => {
                  const from = new Date(b.from);
                  return b.memberId === m.id && from.getHours() === h;
                });
                return (
                  <div key={m.id} style={{
                    minHeight: 44, padding: 3, borderTop: `1px dashed ${colors.rule}`,
                    display: "flex", flexDirection: "column", gap: 2,
                  }}>
                    {hourBlocks.map((b, i) => {
                      const t = state.tasks.find(x => x.id === b.taskId);
                      if (!t) return null;
                      const tone = tonesByQuadrant[quadrantOf(t)] || tonesByQuadrant.ELIMINATE;
                      const from = new Date(b.from);
                      return (
                        <div key={i} style={{
                          padding: "3px 6px", borderRadius: 5,
                          background: tone.bg, borderLeft: `3px solid ${tone.fg}`,
                          fontSize: 11, color: colors.ink,
                        }}>
                          <span style={{ fontFamily: "var(--joy-font-mono)", fontSize: 9, color: tone.fg, marginRight: 4 }}>
                            :{String(from.getMinutes()).padStart(2, "0")}
                          </span>
                          {t.title}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

// Calendar-month grid. Each day cell shows total blocks + hours
// across all members on that date.
function ScheduleMonthView({ state, schedule, allBlocks }) {
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const monthAnchor = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const monthName = monthAnchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  // Build a Mon-first 6-row calendar grid.
  const firstDay = new Date(monthAnchor);
  const jsDow = firstDay.getDay();
  const mondayOffset = jsDow === 0 ? -6 : 1 - jsDow; // shift so Mon = 0
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() + mondayOffset);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(gridStart.getTime() + i * 24 * 60 * 60 * 1000));
  }

  // Aggregate hours + counts per day.
  const dayStats = {};
  for (const b of allBlocks) {
    const from = new Date(b.from);
    const key = `${from.getFullYear()}-${from.getMonth()}-${from.getDate()}`;
    if (!dayStats[key]) dayStats[key] = { count: 0, hours: 0 };
    dayStats[key].count += 1;
    dayStats[key].hours += 0.5;
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <button onClick={() => setMonthOffset(o => o - 1)} style={btnGhost}>‹ prev</button>
        <div style={{ fontFamily: "var(--joy-font-head)", fontWeight: 700, fontSize: 18 }}>{monthName}</div>
        <button onClick={() => setMonthOffset(o => o + 1)} style={btnGhost}>next ›</button>
      </div>
      <div style={{ ...card, padding: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
            <div key={d} style={{ fontFamily: "var(--joy-font-mono)", fontSize: 10, color: colors.inkSoft, letterSpacing: "0.08em", textAlign: "center" }}>
              {d.toUpperCase()}
            </div>
          ))}
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === monthAnchor.getMonth();
            const isToday = d.toDateString() === today.toDateString();
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const stats = dayStats[key];
            return (
              <div key={i} style={{
                minHeight: 68, padding: 6, borderRadius: 6,
                background: stats ? "rgba(42,93,93,0.10)" : "rgba(28,25,22,0.025)",
                border: isToday ? `1.5px solid ${colors.teal}` : `1px solid ${colors.rule}`,
                opacity: inMonth ? 1 : 0.35,
                display: "flex", flexDirection: "column", gap: 2,
              }}>
                <div style={{ fontFamily: "var(--joy-font-mono)", fontSize: 11, color: colors.inkSoft }}>{d.getDate()}</div>
                {stats && (
                  <div style={{ marginTop: "auto", fontSize: 11 }}>
                    <div style={{ color: colors.teal, fontWeight: 600 }}>{stats.hours.toFixed(1)}h</div>
                    <div style={{ color: colors.inkSoft, fontSize: 10 }}>{stats.count} block{stats.count === 1 ? "" : "s"}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Year heatmap: 53-week grid, 7 rows (Mon..Sun), each cell shaded by
// total scheduled hours that day.
function ScheduleYearView({ allBlocks }) {
  const today = new Date();
  // Anchor: start of the ISO-ish year (Jan 1's Monday).
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const jsDow = yearStart.getDay();
  const mondayOffset = jsDow === 0 ? -6 : 1 - jsDow;
  const gridStart = new Date(yearStart);
  gridStart.setDate(yearStart.getDate() + mondayOffset);

  const dayHours = {};
  for (const b of allBlocks) {
    const from = new Date(b.from);
    const key = `${from.getFullYear()}-${from.getMonth()}-${from.getDate()}`;
    dayHours[key] = (dayHours[key] || 0) + 0.5;
  }

  const shadeFor = (hours) => {
    if (!hours) return "rgba(28,25,22,0.06)";
    if (hours < 2) return "rgba(58,168,154,0.20)";
    if (hours < 4) return "rgba(58,168,154,0.40)";
    if (hours < 6) return "rgba(58,168,154,0.65)";
    return "rgba(58,168,154,0.90)";
  };

  // 53 weeks × 7 days.
  const weeks = [];
  for (let w = 0; w < 53; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(gridStart.getTime() + (w * 7 + d) * 24 * 60 * 60 * 1000);
      col.push(date);
    }
    weeks.push(col);
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ ...card, padding: 14, overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ fontFamily: "var(--joy-font-head)", fontWeight: 700, fontSize: 18 }}>
            {today.getFullYear()}
          </div>
          <div style={{ fontFamily: "var(--joy-font-mono)", fontSize: 11, color: colors.inkSoft }}>
            scheduled hours per day · {Object.values(dayHours).reduce((a, b) => a + b, 0).toFixed(1)}h total
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(53, 12px)`, gap: 2 }}>
          {weeks.map((col, wi) => (
            <div key={wi} style={{ display: "grid", gridTemplateRows: "repeat(7, 12px)", gap: 2 }}>
              {col.map((d, di) => {
                const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                const h = dayHours[key] || 0;
                const inYear = d.getFullYear() === today.getFullYear();
                return (
                  <div key={di}
                    title={`${d.toLocaleDateString()} — ${h.toFixed(1)}h`}
                    style={{
                      width: 12, height: 12, borderRadius: 2,
                      background: inYear ? shadeFor(h) : "rgba(28,25,22,0.02)",
                      border: `1px solid ${colors.rule}`,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScheduleLane({ member, dayCols, placementsByMemberDay, tasks, totalHours, isPhone }) {
  const tonesByQuadrant = {
    DO: { fg: colors.rustDeep, bg: "rgba(184,73,42,0.10)" },
    SCHEDULE: { fg: colors.teal, bg: "rgba(42,93,93,0.10)" },
    DELEGATE: { fg: colors.ochre, bg: "rgba(201,138,44,0.12)" },
    ELIMINATE: { fg: colors.inkSoft, bg: "rgba(28,25,22,0.06)" },
  };
  return (
    <div style={{ ...card, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontFamily: "var(--joy-font-head)", fontWeight: 700, fontSize: 18 }}>{member.name}</div>
        <div style={{ fontFamily: "var(--joy-font-mono)", fontSize: 11, color: colors.inkSoft }}>
          {totalHours.toFixed(1)}h scheduled
        </div>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: isPhone ? "repeat(7, minmax(60px, 1fr))" : "repeat(7, 1fr)",
        gap: 6,
        overflowX: "auto",
      }}>
        {dayCols.map((day, idx) => {
          const key = `${member.id}|${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
          const blocks = (placementsByMemberDay[key] || []).sort(
            (a, b) => new Date(a.from).getTime() - new Date(b.from).getTime()
          );
          return (
            <div key={idx} style={{
              minHeight: 110, padding: 6, borderRadius: 8,
              background: "rgba(28,25,22,0.025)", border: `1px dashed ${colors.rule}`,
              display: "flex", flexDirection: "column", gap: 4,
            }}>
              <div style={{ fontFamily: "var(--joy-font-mono)", fontSize: 9, color: colors.inkSoft, letterSpacing: "0.04em" }}>
                {day.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()} {day.getDate()}
              </div>
              {blocks.length === 0 && (
                <div style={{ fontStyle: "italic", color: colors.inkSoft, fontSize: 10 }}>—</div>
              )}
              {blocks.map((b, i) => {
                const t = tasks.find(x => x.id === b.taskId);
                if (!t) return null;
                const tone = tonesByQuadrant[quadrantOf(t)] || tonesByQuadrant.ELIMINATE;
                const from = new Date(b.from);
                const to = new Date(b.to);
                return (
                  <div key={i} title={`${t.title} · score ${b.score}`} style={{
                    padding: "4px 6px", borderRadius: 6,
                    background: tone.bg, borderLeft: `3px solid ${tone.fg}`,
                    fontSize: 11, lineHeight: 1.25, color: colors.ink,
                  }}>
                    <div style={{ fontFamily: "var(--joy-font-mono)", fontSize: 9, color: tone.fg, fontWeight: 600 }}>
                      {String(from.getHours()).padStart(2, "0")}:{String(from.getMinutes()).padStart(2, "0")}–{String(to.getHours()).padStart(2, "0")}:{String(to.getMinutes()).padStart(2, "0")}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 500 }}>{t.title}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Insights View
// ─────────────────────────────────────────────────────────────────────────────

function InsightsView({ state, summary, assignments }) {
  const totalJoy = summary.reduce((s, x) => s + x.joyIndex, 0);
  const totalTalent = summary.reduce((s, x) => s + x.talentIndex, 0);
  const burnoutCount = summary.filter(s => s.burnout).length;
  const strainCount = summary.filter(s => s.strain).length;
  const unassigned = state.tasks.filter(t => quadrantOf(t) !== "ELIMINATE" && !assignments[t.id]).length;
  const eliminated = state.tasks.filter(t => quadrantOf(t) === "ELIMINATE").length;

  // Mismatched assignments (someone hates the task or is bad at it)
  const painPoints = state.tasks
    .map(t => {
      const a = assignments[t.id];
      if (!a) return null;
      const sc = t.scores[a.memberId];
      if (!sc) return null;
      if (sc.pleasure <= -2 || sc.talent <= -2) {
        const m = state.members.find(x => x.id === a.memberId);
        return { task: t, member: m, scores: sc };
      }
      return null;
    })
    .filter(Boolean);

  return (
    <div>
      <SectionHead
        eyebrow="04"
        title="The Reading"
        sub="What the assignment is costing you, and where it's working."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginTop: 16 }}>
        <BigStat icon={Heart} label="Total Joy Index" value={totalJoy > 0 ? `+${totalJoy}` : totalJoy} tone={totalJoy >= 0 ? "teal" : "rust"} />
        <BigStat icon={Brain} label="Total Talent Fit" value={totalTalent > 0 ? `+${totalTalent}` : totalTalent} />
        <BigStat icon={AlertTriangle} label="Burnout" value={burnoutCount} tone={burnoutCount > 0 ? "rust" : "ink"} />
        <BigStat icon={Zap} label="Stretched" value={strainCount} tone={strainCount > 0 ? "ochre" : "ink"} />
      </div>

      {/* per-person bars */}
      {summary.length > 0 && (
        <div style={{ ...card, marginTop: 18 }}>
          <div style={{ ...mutedLabel, marginBottom: 12 }}>JOY × LOAD PER PERSON</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {summary.map(s => {
              const loadPct = Math.min(140, (s.totalEffort / Math.max(s.budget, 1)) * 100);
              return (
                <div key={s.memberId}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                    <span style={{ fontFamily: "var(--joy-font-head)", fontWeight: 600 }}>{s.name}</span>
                    <span style={{ fontFamily: "var(--joy-font-mono)", fontSize: 11, color: colors.inkSoft }}>
                      load {s.totalEffort}/{s.budget.toFixed(1)} · joy {s.joyIndex > 0 ? "+" : ""}{s.joyIndex}
                    </span>
                  </div>
                  <div style={{ position: "relative", height: 10, background: "rgba(28,25,22,0.08)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{
                      width: Math.min(100, loadPct) + "%", height: "100%",
                      background: s.burnout ? colors.rustDeep : s.strain ? colors.ochre : colors.teal,
                      transition: "width 0.3s",
                    }} />
                    {loadPct > 100 && (
                      <div style={{
                        position: "absolute", left: "100%", top: 0, height: "100%",
                        width: (loadPct - 100) + "%", maxWidth: "40%",
                        background: `repeating-linear-gradient(45deg, ${colors.rustDeep}, ${colors.rustDeep} 4px, ${colors.rust} 4px, ${colors.rust} 8px)`,
                      }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pain points */}
      {painPoints.length > 0 && (
        <div style={{ ...card, marginTop: 14, border: "1px solid rgba(184,73,42,0.3)" }}>
          <div style={{ ...mutedLabel, color: colors.rustDeep, marginBottom: 10 }}>PAIN POINTS — RECONSIDER</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {painPoints.map(p => (
              <div key={p.task.id} style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                <span style={{ fontFamily: "var(--joy-font-head)", fontWeight: 600 }}>{p.task.title}</span>{" "}
                <span style={{ color: colors.inkSoft }}>→ {p.member?.name}</span>
                <div style={{ fontSize: 12, color: colors.inkSoft, fontStyle: "italic", fontFamily: "var(--joy-font-head)" }}>
                  {p.scores.pleasure <= -2 && p.scores.talent <= -2
                    ? "they neither enjoy this nor are good at it. swap, train, or drop."
                    : p.scores.pleasure <= -2
                      ? "they're capable but it drains them. ok occasionally, not chronically."
                      : "they enjoy this but lack skill. ok if growth is the point."}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(unassigned > 0 || eliminated > 0) && (
        <div style={{ ...card, marginTop: 14 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {unassigned > 0 && (
              <div>
                <div style={mutedLabel}>UNASSIGNED</div>
                <div style={{ fontFamily: "var(--joy-font-head)", fontSize: 22, fontWeight: 700 }}>{unassigned}</div>
                <div style={{ fontSize: 11, color: colors.inkSoft }}>add team members or capacity</div>
              </div>
            )}
            {eliminated > 0 && (
              <div>
                <div style={mutedLabel}>FLAGGED FOR ELIMINATION</div>
                <div style={{ fontFamily: "var(--joy-font-head)", fontSize: 22, fontWeight: 700, color: colors.inkSoft }}>{eliminated}</div>
                <div style={{ fontSize: 11, color: colors.inkSoft }}>not urgent, not important — drop them</div>
              </div>
            )}
          </div>
        </div>
      )}

      <ScheduleInsights state={state} assignments={assignments} summary={summary} />

      <ProgressNarrative state={state} summary={summary} totalJoy={totalJoy} burnoutCount={burnoutCount} />
    </div>
  );
}

// Scheduling-side stats: weekly scheduled hours per person, idle
// availability (unused windows), and overschedule warnings (when a
// person's placed blocks exceed their effort budget × 1.5h).
function ScheduleInsights({ state, assignments, summary }) {
  const schedule = useMemo(
    () => computeSchedule(state, assignments, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.tasks, state.members, assignments]
  );
  const totals = hoursPerMember(schedule);
  if (state.members.length === 0) return null;

  const rows = state.members.map(m => {
    const scheduledHours = totals[m.id] || 0;
    const availableHours = weeklyAvailableHours(m);
    const idle = Math.max(0, availableHours - scheduledHours);
    const budgetHours = (4 + m.capacity) * 1.5; // effort budget × 1.5h-per-effort-unit
    const oversched = scheduledHours > budgetHours;
    return { member: m, scheduledHours, availableHours, idle, budgetHours, oversched };
  });

  const anySched = rows.some(r => r.scheduledHours > 0);
  if (!anySched) return null;

  return (
    <div style={{ ...card, marginTop: 14 }}>
      <div style={{ ...mutedLabel, marginBottom: 12 }}>THIS WEEK'S SCHEDULE</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map(r => (
          <div key={r.member.id} style={{ display: "grid", gridTemplateColumns: "minmax(80px, 100px) 1fr 1fr 1fr", gap: 10, alignItems: "baseline", fontSize: 13 }}>
            <div style={{ fontFamily: "var(--joy-font-head)", fontWeight: 600 }}>{r.member.name}</div>
            <div style={{ fontFamily: "var(--joy-font-mono)", fontSize: 12 }}>
              <span style={{ color: r.oversched ? colors.rustDeep : colors.teal, fontWeight: 600 }}>
                {r.scheduledHours.toFixed(1)}h
              </span>
              <span style={{ color: colors.inkSoft }}> scheduled</span>
            </div>
            <div style={{ fontFamily: "var(--joy-font-mono)", fontSize: 12, color: colors.inkSoft }}>
              {r.idle.toFixed(1)}h idle
            </div>
            <div style={{ fontFamily: "var(--joy-font-mono)", fontSize: 12, color: r.oversched ? colors.rustDeep : colors.inkSoft }}>
              {r.oversched ? `⚠ over by ${(r.scheduledHours - r.budgetHours).toFixed(1)}h` : `budget ${r.budgetHours.toFixed(1)}h`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressNarrative({ state, summary, totalJoy, burnoutCount }) {
  if (state.tasks.length === 0 || state.members.length === 0) return null;
  let read = "";
  if (burnoutCount > 0) {
    read = "Stop. Someone is over capacity. You'll move slower, not faster, by pushing through. Reduce scope, eliminate the bottom-right quadrant, or add hands.";
  } else if (totalJoy < 0) {
    read = "You're getting things done, but the work is grinding people down. Look at the pain points below and see what you can swap, drop, or restructure.";
  } else if (totalJoy >= 0 && summary.every(s => !s.strain && !s.burnout)) {
    read = "Healthy state. Capacity is intact, joy is positive. This is the configuration you want — protect it as new tasks come in.";
  } else {
    read = "Workable. A few people are stretched, but no one is breaking. Watch for tasks accumulating in DO and DELEGATE.";
  }
  return (
    <div style={{
      marginTop: 18, padding: 18, borderRadius: 12,
      background: colors.bone, border: `1px dashed ${colors.rule}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Sparkles size={14} color={colors.rust} />
        <span style={mutedLabel}>THE READ</span>
      </div>
      <div style={{ fontFamily: "var(--joy-font-head)", fontSize: 18, fontStyle: "italic", lineHeight: 1.45, color: colors.ink }}>
        {read}
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: colors.inkSoft, fontFamily: "var(--joy-font-head)" }}>
        Goal: from <em>{state.goal.from || "—"}</em> to <em>{state.goal.to || "—"}</em>.
      </div>
    </div>
  );
}

function BigStat({ icon: Icon, label, value, tone = "ink" }) {
  const tones = { ink: colors.ink, teal: colors.teal, rust: colors.rustDeep, ochre: colors.ochre };
  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: colors.inkSoft }}>
        <Icon size={12} />
        <span style={mutedLabel}>{label}</span>
      </div>
      <div style={{ fontFamily: "var(--joy-font-head)", fontWeight: 800, fontSize: 36, lineHeight: 1, marginTop: 6, color: tones[tone], letterSpacing: "-0.02em", fontStyle: "italic" }}>
        {value}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────────────────────

function SectionHead({ eyebrow, title, sub, action }) {
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

function CategoriesBar({ state, update }) {
  const categories = state.categories || [];
  const addCategory = () => {
    const name = prompt("Category name?");
    if (!name || !name.trim()) return;
    update(s => {
      s.categories = s.categories || [];
      s.categories.push({ id: "c-" + Date.now(), name: name.trim() });
      return s;
    });
  };
  const renameCategory = (id, current) => {
    const name = prompt("Rename category:", current);
    if (!name || !name.trim()) return;
    update(s => {
      const c = (s.categories || []).find(x => x.id === id);
      if (c) c.name = name.trim();
      return s;
    });
  };
  const removeCategory = (id) => {
    if (!confirm("Delete this category? Tasks tagged with it will become uncategorized.")) return;
    update(s => {
      s.categories = (s.categories || []).filter(c => c.id !== id);
      (s.tasks || []).forEach(t => { if (t.categoryId === id) t.categoryId = null; });
      return s;
    });
  };
  return (
    <div style={{
      marginTop: 14, marginBottom: 4, display: "flex", alignItems: "center",
      gap: 8, flexWrap: "wrap",
    }}>
      <span style={{ ...mutedLabel, marginRight: 2 }}>CATEGORIES</span>
      {categories.length === 0 && (
        <span style={{ fontFamily: "var(--joy-font-head)", fontStyle: "italic", fontSize: 13, color: colors.inkSoft }}>
          none yet — add one to group tasks
        </span>
      )}
      {categories.map(c => (
        <span key={c.id} style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "4px 4px 4px 10px", borderRadius: 999,
          background: "rgba(28,25,22,0.05)", border: `1px solid ${colors.rule}`,
          fontFamily: "var(--joy-font-mono)", fontSize: 11, letterSpacing: "0.04em",
          color: colors.ink,
        }}>
          <button onClick={() => renameCategory(c.id, c.name)} title="Rename" style={{
            background: "transparent", border: "none", color: "inherit",
            font: "inherit", letterSpacing: "inherit", cursor: "pointer", padding: 0,
          }}>{c.name}</button>
          <button onClick={() => removeCategory(c.id)} title="Delete" style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 18, height: 18, borderRadius: 999, border: "none",
            background: "transparent", color: colors.inkSoft, cursor: "pointer",
          }}><X size={10}/></button>
        </span>
      ))}
      <button onClick={addCategory} style={{
        ...btnGhost, padding: "4px 10px",
      }}><Plus size={11}/> add category</button>
    </div>
  );
}

function StakeholdersBar({ state, update }) {
  const stakeholders = state.stakeholders || [];
  const add = () => {
    const name = prompt("Stakeholder name? (founder, customer, investor, etc.)");
    if (!name || !name.trim()) return;
    update(s => {
      s.stakeholders = s.stakeholders || [];
      s.stakeholders.push({ id: "s-" + Date.now(), name: name.trim() });
      return s;
    });
  };
  const rename = (id, current) => {
    const name = prompt("Rename stakeholder:", current);
    if (!name || !name.trim()) return;
    update(s => {
      const x = (s.stakeholders || []).find(y => y.id === id);
      if (x) x.name = name.trim();
      return s;
    });
  };
  const remove = (id) => {
    if (!confirm("Delete this stakeholder? Tasks tagged with it will become unassigned.")) return;
    update(s => {
      s.stakeholders = (s.stakeholders || []).filter(x => x.id !== id);
      (s.tasks || []).forEach(t => { if (t.stakeholderId === id) t.stakeholderId = null; });
      return s;
    });
  };
  return (
    <div style={{
      marginTop: 6, marginBottom: 4, display: "flex", alignItems: "center",
      gap: 8, flexWrap: "wrap",
    }}>
      <span style={{ ...mutedLabel, marginRight: 2 }}>STAKEHOLDERS</span>
      {stakeholders.length === 0 && (
        <span style={{ fontFamily: "var(--joy-font-head)", fontStyle: "italic", fontSize: 13, color: colors.inkSoft }}>
          none yet — add one to tag tasks with who they're for
        </span>
      )}
      {stakeholders.map(x => (
        <span key={x.id} style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "4px 4px 4px 10px", borderRadius: 999,
          background: "rgba(42,93,93,0.07)", border: `1px solid rgba(42,93,93,0.25)`,
          fontFamily: "var(--joy-font-mono)", fontSize: 11, letterSpacing: "0.04em",
          color: colors.teal,
        }}>
          <button onClick={() => rename(x.id, x.name)} title="Rename" style={{
            background: "transparent", border: "none", color: "inherit",
            font: "inherit", letterSpacing: "inherit", cursor: "pointer", padding: 0,
          }}>{x.name}</button>
          <button onClick={() => remove(x.id)} title="Delete" style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 18, height: 18, borderRadius: 999, border: "none",
            background: "transparent", color: colors.inkSoft, cursor: "pointer",
          }}><X size={10}/></button>
        </span>
      ))}
      <button onClick={add} style={{ ...btnGhost, padding: "4px 10px" }}><Plus size={11}/> add stakeholder</button>
    </div>
  );
}

// Compact due-date chip for the matrix grid (tiny mono style matching
// the U/I/E badge at the right edge of each task chip).
function DueDateChip({ dueDate }) {
  const label = formatDueDate(dueDate);
  if (!label) return null;
  const overdue = isOverdue(dueDate);
  return (
    <span
      title={`Due: ${label}`}
      style={{
        fontFamily: "var(--joy-font-mono)", fontSize: 9, letterSpacing: "0.04em",
        color: overdue ? colors.rustDeep : colors.teal, fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

// Pill variant for the tasks-list cards (uses the existing Pill component
// for visual consistency with the assignee / quadrant pills).
function DueDatePill({ dueDate }) {
  const label = formatDueDate(dueDate);
  if (!label) return null;
  const overdue = isOverdue(dueDate);
  return <Pill tone={overdue ? "warn" : "teal"}>{label}</Pill>;
}

// Editor for a task's due date. Switches between a fuzzy-label select
// and a native datetime input. "Clear" sets the field back to null.
function DueDatePicker({ value, onChange }) {
  const mode = value?.kind ?? "none";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={mutedLabel}>DUE</span>
      <div style={{ display: "flex", gap: 4 }}>
        {[
          ["none", "none"],
          ["fuzzy", "fuzzy"],
          ["exact", "exact"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              if (key === "none") onChange(null);
              else if (key === "fuzzy") onChange({ kind: "fuzzy", value: value?.kind === "fuzzy" ? value.value : "today" });
              else onChange({ kind: "exact", value: value?.kind === "exact" ? value.value : new Date().toISOString() });
            }}
            style={{
              ...btnGhost,
              padding: "4px 10px", fontSize: 10,
              ...(mode === key ? { background: colors.teal, color: "#ffffff", borderColor: colors.teal } : {}),
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "fuzzy" && (
        <select
          value={value.value}
          onChange={(e) => onChange({ kind: "fuzzy", value: e.target.value })}
          style={{
            padding: "5px 10px", borderRadius: 8,
            background: colors.paper, color: colors.ink,
            border: `1px solid ${colors.rule}`,
            fontFamily: "var(--joy-font-body)", fontSize: 13, cursor: "pointer",
          }}
        >
          {FUZZY_VALUES.map(fv => <option key={fv} value={fv}>{FUZZY_LABELS[fv]}</option>)}
        </select>
      )}
      {mode === "exact" && (
        <input
          type="datetime-local"
          value={(() => {
            // datetime-local wants "YYYY-MM-DDTHH:mm" without timezone
            const d = new Date(value.value);
            if (Number.isNaN(d.getTime())) return "";
            const pad = (n) => String(n).padStart(2, "0");
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          })()}
          onChange={(e) => {
            const d = new Date(e.target.value);
            if (!Number.isNaN(d.getTime())) onChange({ kind: "exact", value: d.toISOString() });
          }}
          style={{
            padding: "5px 10px", borderRadius: 8,
            background: colors.paper, color: colors.ink,
            border: `1px solid ${colors.rule}`,
            fontFamily: "var(--joy-font-body)", fontSize: 13,
          }}
        />
      )}
    </div>
  );
}

function Empty({ children }) {
  return (
    <div style={{
      marginTop: 24, padding: 32, textAlign: "center",
      border: `1px dashed ${colors.rule}`, borderRadius: 12,
      fontFamily: "var(--joy-font-head)", fontStyle: "italic", color: colors.inkSoft,
    }}>{children}</div>
  );
}

// Single/multi-line text input that auto-grows to fit its content so long
// values stay fully visible. Used for the goal box where one-line inputs
// would clip long strings on narrow viewports.
function AutoGrowTextarea({ value, onChange, placeholder, style }) {
  const ref = React.useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      style={{
        ...inputBare,
        resize: "none",
        lineHeight: 1.35,
        overflow: "hidden",
        ...style,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const card = {
  padding: 16, borderRadius: 12,
  background: colors.bone, border: `1px solid ${colors.rule}`,
};

const mutedLabel = {
  fontFamily: "var(--joy-font-mono)", fontSize: 10,
  letterSpacing: "0.12em", textTransform: "uppercase", color: colors.inkSoft,
};

const inputBare = {
  width: "100%", border: "none", background: "transparent", outline: "none",
  color: colors.ink, fontFamily: "var(--joy-font-body)", fontSize: 15, padding: "4px 0",
};

const tabBtn = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "7px 12px", borderRadius: 999,
  background: "transparent", border: `1px solid transparent`,
  fontFamily: "var(--joy-font-mono)", fontSize: 11, letterSpacing: "0.06em",
  color: colors.inkSoft, cursor: "pointer", textTransform: "uppercase",
  whiteSpace: "nowrap",
};
const tabBtnActive = {
  background: colors.teal, color: "#ffffff", border: `1px solid ${colors.teal}`,
};

const btnGhost = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "5px 10px", borderRadius: 999,
  background: "transparent", border: `1px solid ${colors.rule}`,
  fontFamily: "var(--joy-font-mono)", fontSize: 10, letterSpacing: "0.06em",
  color: colors.inkSoft, cursor: "pointer", textTransform: "uppercase",
};

const btnPrimary = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "8px 14px", borderRadius: 999,
  background: colors.teal, color: "#ffffff", border: "none",
  fontFamily: "var(--joy-font-mono)", fontSize: 11, letterSpacing: "0.06em",
  cursor: "pointer", textTransform: "uppercase",
};

const btnIcon = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 26, height: 26, borderRadius: 999,
  background: "transparent", border: `1px solid ${colors.rule}`,
  color: colors.inkSoft, cursor: "pointer",
};

const warnBox = {
  marginTop: 10, padding: "8px 10px", borderRadius: 8,
  background: "rgba(184,73,42,0.10)", border: `1px solid rgba(184,73,42,0.3)`,
  color: colors.rustDeep, fontSize: 12, fontFamily: "var(--joy-font-head)",
  display: "flex", alignItems: "center", gap: 6,
};
