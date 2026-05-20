// Due-date helpers: fuzzy ↔ datetime window resolution + display
// formatting. A task's dueDate is either:
//   { kind: "fuzzy", value: <one of FUZZY_VALUES> }
//   { kind: "exact", value: <ISO 8601 string> }
//   null  (no due date)

export const FUZZY_VALUES = [
  "now",
  "today",
  "this-morning",
  "this-afternoon",
  "this-evening",
  "tomorrow",
  "this-week",
  "soon",
  "later",
  "whenever",
  "never",
];

export const FUZZY_LABELS = {
  "now": "now",
  "today": "today",
  "this-morning": "this morning",
  "this-afternoon": "this afternoon",
  "this-evening": "this evening",
  "tomorrow": "tomorrow",
  "this-week": "this week",
  "soon": "soon",
  "later": "later",
  "whenever": "whenever",
  "never": "never",
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function atTime(d, hour, minute = 0) {
  const x = startOfDay(d);
  x.setHours(hour, minute, 0, 0);
  return x;
}

// Resolve a dueDate into a { from, to } Date window, or null for
// "never" (excluded from scheduling) and "whenever" (open-ended).
// `now` defaults to the current moment but is parameterised so the
// scheduler can replay deterministically.
export function resolveDueDate(dueDate, now = new Date()) {
  if (!dueDate) return null;
  if (dueDate.kind === "exact") {
    const at = new Date(dueDate.value);
    if (Number.isNaN(at.getTime())) return null;
    return { from: now, to: at };
  }
  if (dueDate.kind !== "fuzzy") return null;
  const v = dueDate.value;
  if (v === "never") return null;
  if (v === "whenever") return { from: now, to: null };
  if (v === "now") return { from: now, to: new Date(now.getTime() + HOUR) };
  if (v === "today") return { from: now, to: atTime(now, 22) };
  if (v === "this-morning") return { from: atTime(now, 6), to: atTime(now, 12) };
  if (v === "this-afternoon") return { from: atTime(now, 12), to: atTime(now, 18) };
  if (v === "this-evening") return { from: atTime(now, 18), to: atTime(now, 22) };
  if (v === "tomorrow") {
    const tom = new Date(now.getTime() + DAY);
    return { from: atTime(tom, 6), to: atTime(tom, 22) };
  }
  if (v === "this-week") {
    const end = new Date(now);
    const daysToSunday = (7 - end.getDay()) % 7 || 7;
    end.setDate(end.getDate() + daysToSunday);
    end.setHours(22, 0, 0, 0);
    return { from: now, to: end };
  }
  if (v === "soon") return { from: now, to: new Date(now.getTime() + 3 * DAY) };
  if (v === "later") {
    return { from: new Date(now.getTime() + DAY), to: new Date(now.getTime() + 14 * DAY) };
  }
  return null;
}

// True if the dueDate's deadline has passed.
export function isOverdue(dueDate, now = new Date()) {
  const win = resolveDueDate(dueDate, now);
  if (!win || !win.to) return false;
  return win.to.getTime() < now.getTime();
}

// Short string for chips and cards. Returns null for no due date.
export function formatDueDate(dueDate, now = new Date()) {
  if (!dueDate) return null;
  if (dueDate.kind === "fuzzy") return FUZZY_LABELS[dueDate.value] || dueDate.value;
  if (dueDate.kind !== "exact") return null;
  const at = new Date(dueDate.value);
  if (Number.isNaN(at.getTime())) return null;
  const diffMs = at.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / DAY);
  if (diffMs < 0) {
    const overdueDays = Math.abs(diffDays);
    if (overdueDays === 0) return "overdue";
    if (overdueDays === 1) return "1 day overdue";
    return `${overdueDays} days overdue`;
  }
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays < 7) return `in ${diffDays} days`;
  if (diffDays < 14) return "next week";
  return at.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Parse a free-text string into a dueDate value. Accepts:
//   - any FUZZY_VALUES literal
//   - "none" / "" / null → null (clears)
//   - ISO 8601 datetime string → exact
// Returns { ok: true, dueDate } or { ok: false, error }.
export function parseDueDateInput(input) {
  if (input == null || input === "" || input === "none") return { ok: true, dueDate: null };
  if (typeof input !== "string") return { ok: false, error: "Due date must be a string." };
  const trimmed = input.trim();
  if (FUZZY_VALUES.includes(trimmed)) {
    return { ok: true, dueDate: { kind: "fuzzy", value: trimmed } };
  }
  // accept slight variants
  const normalised = trimmed.toLowerCase().replace(/\s+/g, "-");
  if (FUZZY_VALUES.includes(normalised)) {
    return { ok: true, dueDate: { kind: "fuzzy", value: normalised } };
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return { ok: true, dueDate: { kind: "exact", value: parsed.toISOString() } };
  }
  return {
    ok: false,
    error: `Could not parse "${input}" as a date. Use one of: ${FUZZY_VALUES.join(", ")}, or an ISO date like 2026-06-15T14:00.`,
  };
}
