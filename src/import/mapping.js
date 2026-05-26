// Column-name heuristics + value coercion for CSV imports.
//
// Each Joy-Matrix field maps to one source column. The detector below
// looks at a list of header strings and returns its best guess
// (`null` if no header matches). Match is case-insensitive on
// normalised tokens — "Due Date", "due_date", "DUEDATE" all collapse
// to "duedate".
//
// Supported tools (column-name spotted from real exports):
//   OpenProject, Linear, Jira, Asana, Trello, Notion, GitHub Issues,
//   ClickUp, Monday, Todoist.

export const FIELDS = [
  { key: "title",       label: "Title",       required: true,
    help: "What the task is. Required." },
  { key: "dueDate",     label: "Due date",    required: false,
    help: "ISO date / datetime, or a fuzzy label like \"today\", \"this-week\"." },
  { key: "effort",      label: "Effort",      required: false,
    help: "1–5. Numbers ≥ 6 are treated as hours or story points and bucketed." },
  { key: "urgency",     label: "Urgency",     required: false,
    help: "1–5. \"High/Urgent\" → 5, \"Normal/Medium\" → 3, \"Low\" → 1." },
  { key: "importance",  label: "Importance",  required: false,
    help: "1–5. Same scale as urgency." },
  { key: "assignee",    label: "Assignee",    required: false,
    help: "Looked up against existing member names (case-insensitive)." },
  { key: "category",    label: "Category",    required: false,
    help: "Matched against existing categories; missing ones can be created." },
  { key: "stakeholder", label: "Stakeholder", required: false,
    help: "Matched against existing stakeholders; missing ones can be created." },
];

// Header → field map. Lower-case, only [a-z0-9].
const HEADER_HINTS = {
  title: [
    "title", "summary", "subject", "name", "task", "taskname", "cardname",
    "issuename", "content", "workpackage",
  ],
  dueDate: [
    "duedate", "due", "deadline", "finishdate", "enddate", "targetdate",
    "duedateutc", "dateutc", "date", "duedates", "due_at", "dueat", "due_on",
  ],
  effort: [
    "effort", "estimate", "estimatedtime", "originalestimate", "timeestimate",
    "storypoints", "points", "size", "hours", "estimatedhours", "estimatedeffort",
  ],
  urgency: [
    "urgency", "priority", "importanceurgency", "severity",
  ],
  importance: [
    "importance", "value", "impact", "strategicvalue", "businessvalue",
  ],
  assignee: [
    "assignee", "assignees", "owner", "responsible", "assignedto",
    "members", "user", "person",
  ],
  category: [
    "category", "type", "tracker", "workpackagetype", "issuetype",
    "team", "section", "tag", "tags", "labels", "label",
  ],
  stakeholder: [
    "stakeholder", "project", "client", "customer", "audience", "for",
  ],
};

function normalise(h) {
  return String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Given the CSV's header row, return { [field]: header | null } — a
// best-guess mapping the user can override.
export function autoDetect(headers) {
  const norms = headers.map(normalise);
  const out = {};
  for (const f of FIELDS) {
    const hints = HEADER_HINTS[f.key];
    let pick = null;
    for (const hint of hints) {
      const i = norms.indexOf(hint);
      if (i !== -1) { pick = headers[i]; break; }
    }
    if (!pick) {
      // Loose contains-match as a fallback.
      for (const hint of hints) {
        const i = norms.findIndex((n) => n.includes(hint));
        if (i !== -1) { pick = headers[i]; break; }
      }
    }
    out[f.key] = pick;
  }
  return out;
}

// ─── value coercion ─────────────────────────────────────────────────────

const PRIORITY_TO_SCORE = {
  // Standard PM-tool priority strings.
  urgent: 5, critical: 5, highest: 5, "p0": 5, "1": 5,
  high: 4, "p1": 4, "2": 4,
  normal: 3, medium: 3, med: 3, "p2": 3, "3": 3,
  low: 2, "p3": 2, "4": 2,
  trivial: 1, lowest: 1, "none": 1, "p4": 1, "5": 1,
};

export function coerceScore(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim().toLowerCase();
  if (s in PRIORITY_TO_SCORE) return PRIORITY_TO_SCORE[s];
  const n = Number(s);
  if (Number.isFinite(n)) return Math.max(1, Math.min(5, Math.round(n)));
  return null;
}

// 1, 2, 3 → 1–5 directly. 4–7 → 4. 8–12 → 5. Above → 5.
// This handles story-point Fibonacci scales and hour estimates alike.
export function coerceEffort(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim().toLowerCase();
  // Match "2h", "30m", "1d", "3 hours", "PT2H30M"-ish.
  const isoMatch = s.match(/^pt(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?$/i);
  let hours = null;
  if (isoMatch) {
    hours = (Number(isoMatch[1] || 0)) + (Number(isoMatch[2] || 0) / 60);
  } else {
    const hMatch = s.match(/^(\d+(?:\.\d+)?)\s*(h|hour|hours)?$/);
    const dMatch = s.match(/^(\d+(?:\.\d+)?)\s*(d|day|days)$/);
    const mMatch = s.match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes)$/);
    if (dMatch) hours = Number(dMatch[1]) * 8;
    else if (mMatch) hours = Number(mMatch[1]) / 60;
    else if (hMatch) hours = Number(hMatch[1]);
  }
  if (hours != null) {
    if (hours <= 1) return 1;
    if (hours <= 3) return 2;
    if (hours <= 6) return 3;
    if (hours <= 16) return 4;
    return 5;
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n <= 1) return 1;
  if (n <= 2) return 1;
  if (n <= 3) return 2;
  if (n <= 5) return 3;
  if (n <= 8) return 4;
  return 5;
}

const FUZZY_KEYS = new Set([
  "now", "today", "this-morning", "this-afternoon", "this-evening",
  "tomorrow", "this-week", "soon", "later", "whenever", "never",
]);

export function coerceDueDate(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  const slug = s.toLowerCase().replace(/\s+/g, "-");
  if (FUZZY_KEYS.has(slug)) return { kind: "fuzzy", value: slug };
  // ISO 8601 or anything Date can parse.
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return { kind: "exact", value: d.toISOString() };
  return null;
}

// Case-insensitive lookup against an existing list. `getName(item)`
// extracts the comparable name; returns the matched item or null.
export function lookupByName(list, raw, getName = (x) => x.name) {
  if (!raw) return null;
  const target = String(raw).trim().toLowerCase();
  if (!target) return null;
  for (const item of list) {
    if (String(getName(item) || "").trim().toLowerCase() === target) return item;
  }
  // Partial / starts-with as a fallback (handles "Jane D." vs "Jane Doe").
  for (const item of list) {
    const n = String(getName(item) || "").trim().toLowerCase();
    if (n && (n.startsWith(target) || target.startsWith(n))) return item;
  }
  return null;
}

// ─── pipeline: rows + mapping + project → preview ───────────────────────

// Turn parsed rows + a column mapping into Joy-Matrix task drafts. The
// drafts aren't merged into state yet — the modal displays them so the
// user can sanity-check before committing.
//
// `project` is the current project state; used to look up existing
// member / category / stakeholder names. `newMembersAllowed` etc. let
// the modal toggle "create missing references" on or off.
export function buildDrafts({ headers, rows, mapping, project, options = {} }) {
  const hIndex = Object.fromEntries(headers.map((h, i) => [h, i]));
  const get = (row, field) => {
    const h = mapping[field];
    if (!h) return "";
    const i = hIndex[h];
    return i == null ? "" : (row[i] ?? "");
  };

  const drafts = [];
  const newMembers = new Map();        // name → draft id
  const newCategories = new Map();
  const newStakeholders = new Map();
  const warnings = [];

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // +1 header row, +1 1-based
    const title = get(row, "title").trim();
    if (!title) {
      warnings.push({ row: rowNumber, msg: "Row skipped: title is empty." });
      return;
    }

    const draft = {
      title,
      urgency: coerceScore(get(row, "urgency")) ?? 3,
      importance: coerceScore(get(row, "importance")) ?? 3,
      effort: coerceEffort(get(row, "effort")) ?? 2,
      dueDate: coerceDueDate(get(row, "dueDate")),
      categoryId: null,
      stakeholderId: null,
      assigneeId: null,
      _sourceRow: rowNumber,
    };

    // Priority-derived split: if user mapped priority → urgency only,
    // gently nudge importance to match so the task lands in DO/DELEGATE
    // appropriately. Skip when importance was mapped explicitly.
    if (!mapping.importance && mapping.urgency) {
      draft.importance = draft.urgency;
    }

    const assigneeName = get(row, "assignee").trim();
    if (assigneeName) {
      const existing = lookupByName(project.members, assigneeName);
      if (existing) {
        draft.assigneeId = existing.id;
      } else if (options.createMissingMembers) {
        if (!newMembers.has(assigneeName)) newMembers.set(assigneeName, true);
        draft._newAssigneeName = assigneeName;
      } else {
        warnings.push({ row: rowNumber, msg: `Unknown assignee "${assigneeName}" — task imported unassigned.` });
      }
    }

    const categoryName = get(row, "category").trim();
    if (categoryName) {
      const existing = lookupByName(project.categories, categoryName);
      if (existing) {
        draft.categoryId = existing.id;
      } else if (options.createMissingCategories) {
        if (!newCategories.has(categoryName)) newCategories.set(categoryName, true);
        draft._newCategoryName = categoryName;
      }
    }

    const stakeholderName = get(row, "stakeholder").trim();
    if (stakeholderName) {
      const existing = lookupByName(project.stakeholders, stakeholderName);
      if (existing) {
        draft.stakeholderId = existing.id;
      } else if (options.createMissingStakeholders) {
        if (!newStakeholders.has(stakeholderName)) newStakeholders.set(stakeholderName, true);
        draft._newStakeholderName = stakeholderName;
      }
    }

    drafts.push(draft);
  });

  return {
    drafts,
    warnings,
    newMembers: [...newMembers.keys()],
    newCategories: [...newCategories.keys()],
    newStakeholders: [...newStakeholders.keys()],
  };
}
