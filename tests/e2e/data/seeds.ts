// Deterministic localStorage project seeds. Stable ids so data-testid
// selectors (member-card-${id}, task-fit-${id}-pleasure, …) are known
// up front. Shape matches DEMO_STATE / migrateState in src/App.jsx.

export const STORAGE_KEY = "joy-matrix-state-v1";
export const THEME_STORAGE_KEY = "joy-matrix-theme-v1";
export const SCHEMA_VERSION = 5;

// A fixed Monday morning. Used as "now" for the frozen clock so weekday
// availability windows and fuzzy due dates ("this-week") resolve the same
// way every run. 2025-06-02 is a Monday.
export const FROZEN_NOW = "2025-06-02T09:00:00.000Z";

const fullWeek = () => ({
  mon: [{ from: "09:00", to: "17:00" }],
  tue: [{ from: "09:00", to: "17:00" }],
  wed: [{ from: "09:00", to: "17:00" }],
  thu: [{ from: "09:00", to: "17:00" }],
  fri: [{ from: "09:00", to: "17:00" }],
  sat: [],
  sun: [],
});

const neutralWindows = () => ({
  morning: { energy: 2, concentration: 2 },
  midday: { energy: 2, concentration: 2 },
  afternoon: { energy: 2, concentration: 2 },
  evening: { energy: 2, concentration: 2 },
});

export const EMPTY_STATE = {
  schemaVersion: SCHEMA_VERSION,
  goal: { from: "", to: "" },
  categories: [],
  stakeholders: [],
  members: [],
  tasks: [],
};

// One member with weekday availability + one DO task due this week. Enough
// for the auto-scheduler to place real blocks, so the schedule sub-views
// and ScheduleInsights have something to render.
export const SCHEDULE_STATE = {
  schemaVersion: SCHEMA_VERSION,
  goal: { from: "kickoff", to: "shipped" },
  categories: [{ id: "c-eng", name: "Engineering" }],
  stakeholders: [{ id: "s-users", name: "Early users" }],
  members: [
    {
      id: "m-avery",
      name: "Avery",
      capacity: 2,
      availability: fullWeek(),
      windows: neutralWindows(),
      categoryScores: { "c-eng": { pleasure: 2, talent: 2 } },
    },
  ],
  tasks: [
    {
      id: "t-build",
      title: "Build the feature",
      categoryId: "c-eng",
      stakeholderId: "s-users",
      urgency: 4,
      importance: 4,
      effort: 2,
      dueDate: { kind: "fuzzy", value: "this-week" },
      scores: { "m-avery": { pleasure: 2, talent: 2, difficulty: 3 } },
    },
  ],
};

// One low-capacity member crushed by a heavy, hated task: drives the
// burnout BigStat, a pain point, negative joy, and the "Stop." narrative.
export const BURNOUT_STATE = {
  schemaVersion: SCHEMA_VERSION,
  goal: { from: "overloaded", to: "sustainable" },
  categories: [{ id: "c-ops", name: "Ops" }],
  stakeholders: [],
  members: [
    {
      id: "m-pat",
      name: "Pat",
      capacity: -3,
      availability: fullWeek(),
      windows: neutralWindows(),
      categoryScores: {},
    },
  ],
  tasks: [
    {
      id: "t-grind",
      title: "The grind",
      categoryId: "c-ops",
      stakeholderId: null,
      urgency: 5,
      importance: 5,
      effort: 5,
      dueDate: null,
      scores: { "m-pat": { pleasure: -3, talent: -3, difficulty: 5 } },
    },
  ],
};

// One high-capacity member with a light, loved task: drives the
// "Healthy state." narrative and positive joy.
export const HEALTHY_STATE = {
  schemaVersion: SCHEMA_VERSION,
  goal: { from: "calm", to: "thriving" },
  categories: [{ id: "c-des", name: "Design" }],
  stakeholders: [],
  members: [
    {
      id: "m-robin",
      name: "Robin",
      capacity: 3,
      availability: fullWeek(),
      windows: neutralWindows(),
      categoryScores: {},
    },
  ],
  tasks: [
    {
      id: "t-joy",
      title: "The joyful task",
      categoryId: "c-des",
      stakeholderId: null,
      urgency: 4,
      importance: 4,
      effort: 1,
      dueDate: null,
      scores: { "m-robin": { pleasure: 3, talent: 3, difficulty: 1 } },
    },
  ],
};

// A legacy v3 project (pre-stakeholders) used to exercise migrateState.
export const LEGACY_V3_STATE = {
  schemaVersion: 3,
  goal: { from: "old", to: "new" },
  categories: [{ id: "c-1", name: "Legacy cat" }],
  members: [
    {
      id: "m-1",
      name: "Legacy member",
      capacity: 0,
      availability: fullWeek(),
      windows: neutralWindows(),
      categoryScores: {},
    },
  ],
  tasks: [
    {
      id: "t-1",
      title: "Legacy task",
      categoryId: "c-1",
      urgency: 3,
      importance: 3,
      effort: 2,
      dueDate: null,
      scores: { "m-1": { pleasure: 0, talent: 0, difficulty: 3 } },
    },
  ],
};
