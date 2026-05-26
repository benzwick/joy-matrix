// The Joy Matrix project model: state shape, schema migration, the assignment
// algorithm, localStorage IO, and the JSON import/export envelope. This is a
// pure, React-free module — the single source of truth for "what a project is
// and how it's scored". App.jsx (the UI), tools.js (the chat tools), and the
// docs chat all import from here, which keeps the chat decoupled from the app
// and the storage IO in one place.
//
// Dimensions:
//   urgency    1–5
//   importance 1–5
//   effort     1–5     (relative load units consumed from a person's budget)
//   pleasure   -3..+3  per (task, member)
//   talent     -3..+3  per (task, member)
//   capacity   -3..+3  per member (current bandwidth, not a fixed trait)

const STORAGE_KEY = "joy-matrix-state-v1";
export const SCHEMA_VERSION = 5;

export const DEMO_STATE = {
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

export const EMPTY_STATE = {
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

export const QUADRANT_META = {
  DO:        { label: "DO",        sub: "urgent · important",       weight: { talent: 0.50, pleasure: 0.20, capacity: 0.30 } },
  SCHEDULE:  { label: "SCHEDULE",  sub: "important · not urgent",   weight: { talent: 0.30, pleasure: 0.50, capacity: 0.20 } },
  DELEGATE:  { label: "DELEGATE",  sub: "urgent · not important",   weight: { talent: 0.20, pleasure: 0.30, capacity: 0.50 } },
  ELIMINATE: { label: "ELIMINATE", sub: "neither — drop or defer",  weight: null },
};

// Workflow order: process delegations first (others run in parallel),
// then your own urgent work, then the strategic investments, then drop
// what's left. Numbers are surfaced in the UI and in the explainer.
export const QUADRANT_ORDER = { DELEGATE: 1, DO: 2, SCHEDULE: 3, ELIMINATE: 4 };

// budget in effort units: capacity -3→1, 0→4, +3→7
export const budgetOf = (m) => Math.max(0.5, 4 + m.capacity);

// priority order for greedy assignment
const QUAD_ORDER = ["DO", "SCHEDULE", "DELEGATE"];
const taskPriority = (t) => {
  const q = quadrantOf(t);
  const base = { DO: 0, SCHEDULE: 100, DELEGATE: 200, ELIMINATE: 999 }[q];
  // within quadrant: urgency*importance descending
  return base - (t.urgency * t.importance);
};

export function computeAssignments(state) {
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

export function loadState() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) return migrateState(JSON.parse(v));
  } catch (e) { /* not found or invalid */ }
  return null;
}
export function saveState(state) {
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

export function parseImport(raw) {
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

export function triggerJsonDownload(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a);
  a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
