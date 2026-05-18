// Tools the Talk2View chat can call to act on the Joy Matrix project.
//
// Each tool factory expects:
//   getState()    -> current project state (refs ensure freshness)
//   getDerived()  -> { assignments, summary } from computeAssignments
//   update(fn)    -> mutates state via the AppInner update helper
//   setTab(name)  -> switches the visible tab
//   setTheme(t)   -> updates theme state
//
// Tool execute() returns a JSON-stringified result. Convention:
//   { ok: true, ... }              success
//   { ok: false, error, candidates? }  failure (candidates listed when a
//                                       name lookup was ambiguous)

import { PRESETS, buildExportEnvelope, quadrantOf } from "../App";
import { clamp, findCategory, findMember, findStakeholder, findTask } from "./lookup";

const VALID_TABS = new Set(["matrix", "team", "tasks", "insights"]);
const VALID_MODES = new Set(["light", "dark"]);

function ok(extra = {}) { return JSON.stringify({ ok: true, ...extra }); }
function err(error, extra = {}) { return JSON.stringify({ ok: false, error, ...extra }); }

// Compact projections used to keep tool output token-friendly. The agent
// can always follow up with get_member / get_task for full detail.

function projectMember(m, summary) {
  const s = summary.find((x) => x.memberId === m.id);
  return {
    name: m.name,
    capacity: m.capacity,
    load: s ? s.totalEffort : 0,
    budget: s ? Number(s.budget.toFixed(1)) : null,
    joyIndex: s ? s.joyIndex : 0,
    talentFit: s ? s.talentIndex : 0,
    burnout: !!(s && s.burnout),
    strain: !!(s && s.strain),
  };
}

function projectTask(t, state, assignments) {
  const a = assignments[t.id] || null;
  const assignee = a ? (state.members.find((m) => m.id === a.memberId)?.name ?? null) : null;
  const category = t.categoryId ? (state.categories || []).find((c) => c.id === t.categoryId)?.name ?? null : null;
  const stakeholder = t.stakeholderId ? (state.stakeholders || []).find((x) => x.id === t.stakeholderId)?.name ?? null : null;
  return {
    title: t.title,
    quadrant: quadrantOf(t),
    urgency: t.urgency,
    importance: t.importance,
    effort: t.effort,
    category,
    stakeholder,
    assignee,
    burnoutRisk: !!(a && a.burnoutRisk),
  };
}

export function buildJoyMatrixTools({ getState, getDerived, update, setTab, setTheme, loadDemo, clearProject }) {
  return [
    {
      name: "summarize_project",
      description:
        "Get a high-level summary of the current Joy Matrix project: goal, counts, aggregate joy/talent indexes, and how many members are at burnout/strain.",
      permission: false,
      parameters: { type: "object", properties: {} },
      execute: async () => {
        const state = getState();
        const { summary, assignments } = getDerived();
        const totalJoy = summary.reduce((acc, s) => acc + s.joyIndex, 0);
        const totalTalent = summary.reduce((acc, s) => acc + s.talentIndex, 0);
        const burnoutCount = summary.filter((s) => s.burnout).length;
        const strainCount = summary.filter((s) => s.strain).length;
        const unassigned = state.tasks.filter(
          (t) => quadrantOf(t) !== "ELIMINATE" && !assignments[t.id]
        ).length;
        const eliminated = state.tasks.filter((t) => quadrantOf(t) === "ELIMINATE").length;
        return ok({
          goal: state.goal,
          counts: {
            members: state.members.length,
            tasks: state.tasks.length,
            categories: (state.categories || []).length,
            stakeholders: (state.stakeholders || []).length,
          },
          totals: {
            joyIndex: totalJoy,
            talentFit: totalTalent,
            burnout: burnoutCount,
            strain: strainCount,
            unassigned,
            eliminated,
          },
        });
      },
    },

    {
      name: "list_members",
      description:
        "List every team member with their capacity, current load and budget, joy index, talent fit, and burnout/strain flags.",
      permission: false,
      parameters: { type: "object", properties: {} },
      execute: async () => {
        const state = getState();
        const { summary } = getDerived();
        return ok({ members: state.members.map((m) => projectMember(m, summary)) });
      },
    },

    {
      name: "list_tasks",
      description:
        "List every task with its quadrant, urgency/importance/effort, current assignee, category and stakeholder tags, and whether the assignee is at burnout risk.",
      permission: false,
      parameters: { type: "object", properties: {} },
      execute: async () => {
        const state = getState();
        const { assignments } = getDerived();
        return ok({ tasks: state.tasks.map((t) => projectTask(t, state, assignments)) });
      },
    },

    {
      name: "list_categories",
      description: "List every category name defined in the project.",
      permission: false,
      parameters: { type: "object", properties: {} },
      execute: async () => {
        const state = getState();
        return ok({ categories: (state.categories || []).map((c) => c.name) });
      },
    },

    {
      name: "list_stakeholders",
      description: "List every stakeholder name defined in the project.",
      permission: false,
      parameters: { type: "object", properties: {} },
      execute: async () => {
        const state = getState();
        return ok({ stakeholders: (state.stakeholders || []).map((s) => s.name) });
      },
    },

    {
      name: "get_member",
      description:
        "Get full detail for one team member by name, including their capacity, summary stats, and per-category baseline pleasure + talent scores.",
      permission: false,
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "Member name (case-insensitive, substring OK)." } },
        required: ["name"],
      },
      execute: async (args) => {
        const state = getState();
        const { summary } = getDerived();
        const hit = findMember(state, args.name);
        if (hit.error) return err(hit.error, { candidates: hit.candidates });
        const m = hit.item;
        const cats = state.categories || [];
        const baselines = cats.map((c) => {
          const b = (m.categoryScores || {})[c.id] || {};
          return { category: c.name, pleasure: b.pleasure ?? 0, talent: b.talent ?? 0 };
        });
        return ok({ member: { ...projectMember(m, summary), baselines } });
      },
    },

    {
      name: "get_task",
      description:
        "Get full detail for one task by title, including its quadrant, U/I/E, category, stakeholder, assignee, reasoning, and per-member pleasure + talent scores.",
      permission: false,
      parameters: {
        type: "object",
        properties: { title: { type: "string", description: "Task title (case-insensitive, substring OK)." } },
        required: ["title"],
      },
      execute: async (args) => {
        const state = getState();
        const { assignments } = getDerived();
        const hit = findTask(state, args.title);
        if (hit.error) return err(hit.error, { candidates: hit.candidates });
        const t = hit.item;
        const a = assignments[t.id] || null;
        const scores = state.members.map((m) => {
          const sc = (t.scores || {})[m.id] || { pleasure: 0, talent: 0 };
          return { member: m.name, pleasure: sc.pleasure, talent: sc.talent, autoFilled: !!sc.autoFilled };
        });
        return ok({
          task: {
            ...projectTask(t, state, assignments),
            reasoning: a?.reasoning ?? null,
            scores,
          },
        });
      },
    },

    {
      name: "set_goal",
      description:
        "Update the project's goal: where the team is now (from / A) and where they want to be (to / B). Pass either or both fields.",
      permission: false,
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Where the team is now." },
          to: { type: "string", description: "Where the team wants to be." },
        },
      },
      execute: async (args) => {
        update((s) => {
          s.goal = s.goal || { from: "", to: "" };
          if (typeof args.from === "string") s.goal.from = args.from;
          if (typeof args.to === "string") s.goal.to = args.to;
          return s;
        });
        return ok({ goal: getState().goal });
      },
    },

    {
      name: "add_member",
      description:
        "Add a new team member. Capacity is current bandwidth on a -3..+3 scale and defaults to 0 (neutral). Scores in every existing task are initialised to 0 for the new member.",
      permission: false,
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Member name." },
          capacity: { type: "integer", minimum: -3, maximum: 3, description: "Current bandwidth, -3..+3. Defaults to 0." },
        },
        required: ["name"],
      },
      execute: async (args) => {
        const name = String(args.name || "").trim();
        if (!name) return err("Missing member name.");
        const capacity = clamp(args.capacity ?? 0, -3, 3);
        update((s) => {
          const id = "m" + Date.now();
          s.members.push({ id, name, capacity, categoryScores: {} });
          s.tasks.forEach((t) => {
            t.scores[id] = { pleasure: 0, talent: 0 };
          });
          return s;
        });
        return ok({ added: { name, capacity } });
      },
    },

    {
      name: "remove_member",
      description: "Remove a team member by name. Also removes their per-task scores. Destructive — requires user approval.",
      permission: true,
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "Member name." } },
        required: ["name"],
      },
      execute: async (args) => {
        const hit = findMember(getState(), args.name);
        if (hit.error) return err(hit.error, { candidates: hit.candidates });
        const id = hit.item.id;
        const removedName = hit.item.name;
        update((s) => {
          s.members = s.members.filter((m) => m.id !== id);
          s.tasks.forEach((t) => {
            if (t.scores) delete t.scores[id];
          });
          return s;
        });
        return ok({ removed: removedName });
      },
    },

    {
      name: "set_member_capacity",
      description: "Set a member's current capacity on the -3..+3 scale. Lower values shrink their effort budget and discourage new assignments.",
      permission: false,
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          capacity: { type: "integer", minimum: -3, maximum: 3 },
        },
        required: ["name", "capacity"],
      },
      execute: async (args) => {
        const hit = findMember(getState(), args.name);
        if (hit.error) return err(hit.error, { candidates: hit.candidates });
        const id = hit.item.id;
        const newCap = clamp(args.capacity, -3, 3);
        update((s) => {
          const m = s.members.find((x) => x.id === id);
          if (m) m.capacity = newCap;
          return s;
        });
        return ok({ name: hit.item.name, capacity: newCap });
      },
    },

    {
      name: "add_task",
      description:
        "Add a new task. Optional: urgency, importance, effort (each 1-5, default 3/3/2), category name, stakeholder name. If a category is supplied, per-member scores auto-fill from that category's baselines.",
      permission: false,
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          urgency: { type: "integer", minimum: 1, maximum: 5 },
          importance: { type: "integer", minimum: 1, maximum: 5 },
          effort: { type: "integer", minimum: 1, maximum: 5 },
          category: { type: "string", description: "Category name (case-insensitive, substring OK)." },
          stakeholder: { type: "string", description: "Stakeholder name (case-insensitive, substring OK)." },
        },
        required: ["title"],
      },
      execute: async (args) => {
        const title = String(args.title || "").trim();
        if (!title) return err("Missing task title.");
        let categoryId = null;
        if (args.category) {
          const c = findCategory(getState(), args.category);
          if (c.error) return err(c.error, { candidates: c.candidates });
          categoryId = c.item.id;
        }
        let stakeholderId = null;
        if (args.stakeholder) {
          const x = findStakeholder(getState(), args.stakeholder);
          if (x.error) return err(x.error, { candidates: x.candidates });
          stakeholderId = x.item.id;
        }
        const urgency = clamp(args.urgency ?? 3, 1, 5);
        const importance = clamp(args.importance ?? 3, 1, 5);
        const effort = clamp(args.effort ?? 2, 1, 5);
        update((s) => {
          const id = "t" + Date.now();
          const scores = {};
          s.members.forEach((m) => {
            scores[m.id] = { pleasure: 0, talent: 0, autoFilled: true };
          });
          const t = { id, title, categoryId, stakeholderId, urgency, importance, effort, scores };
          // Mirror the UI's auto-fill rule for category-baseline scores.
          if (categoryId) {
            s.members.forEach((m) => {
              const baseline = (m.categoryScores || {})[categoryId];
              if (!baseline) return;
              scores[m.id] = {
                pleasure: baseline.pleasure ?? 0,
                talent: baseline.talent ?? 0,
                autoFilled: true,
              };
            });
          }
          s.tasks.push(t);
          return s;
        });
        return ok({ added: { title, urgency, importance, effort, categoryId, stakeholderId } });
      },
    },

    {
      name: "remove_task",
      description: "Remove a task by title. Destructive — requires user approval.",
      permission: true,
      parameters: {
        type: "object",
        properties: { title: { type: "string" } },
        required: ["title"],
      },
      execute: async (args) => {
        const hit = findTask(getState(), args.title);
        if (hit.error) return err(hit.error, { candidates: hit.candidates });
        const removed = hit.item.title;
        const id = hit.item.id;
        update((s) => {
          s.tasks = s.tasks.filter((t) => t.id !== id);
          return s;
        });
        return ok({ removed });
      },
    },

    {
      name: "update_task",
      description: "Update a task's urgency, importance, effort, or title.",
      permission: false,
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Current task title to find." },
          urgency: { type: "integer", minimum: 1, maximum: 5 },
          importance: { type: "integer", minimum: 1, maximum: 5 },
          effort: { type: "integer", minimum: 1, maximum: 5 },
          new_title: { type: "string", description: "New title, if renaming." },
        },
        required: ["title"],
      },
      execute: async (args) => {
        const hit = findTask(getState(), args.title);
        if (hit.error) return err(hit.error, { candidates: hit.candidates });
        const id = hit.item.id;
        update((s) => {
          const t = s.tasks.find((x) => x.id === id);
          if (!t) return s;
          if (args.urgency !== undefined) t.urgency = clamp(args.urgency, 1, 5);
          if (args.importance !== undefined) t.importance = clamp(args.importance, 1, 5);
          if (args.effort !== undefined) t.effort = clamp(args.effort, 1, 5);
          if (typeof args.new_title === "string" && args.new_title.trim()) {
            t.title = args.new_title.trim();
          }
          return s;
        });
        const after = getState().tasks.find((t) => t.id === id);
        return ok({ updated: { title: after.title, urgency: after.urgency, importance: after.importance, effort: after.effort } });
      },
    },

    {
      name: "set_member_baseline",
      description:
        "Set a member's baseline pleasure and/or talent score for one category. Use this when the user describes a durable affinity: e.g. 'Maya hates writing grants but is great at them' sets the Grants category baseline for Maya. Each score is -3..+3.",
      permission: false,
      parameters: {
        type: "object",
        properties: {
          member_name: { type: "string" },
          category_name: { type: "string" },
          pleasure: { type: "integer", minimum: -3, maximum: 3 },
          talent: { type: "integer", minimum: -3, maximum: 3 },
        },
        required: ["member_name", "category_name"],
      },
      execute: async (args) => {
        const state = getState();
        const mh = findMember(state, args.member_name);
        if (mh.error) return err(mh.error, { candidates: mh.candidates });
        const ch = findCategory(state, args.category_name);
        if (ch.error) return err(ch.error, { candidates: ch.candidates });
        const mId = mh.item.id;
        const cId = ch.item.id;
        update((s) => {
          const m = s.members.find((x) => x.id === mId);
          if (!m) return s;
          m.categoryScores = m.categoryScores || {};
          const existing = m.categoryScores[cId] || { pleasure: 0, talent: 0 };
          if (args.pleasure !== undefined) existing.pleasure = clamp(args.pleasure, -3, 3);
          if (args.talent !== undefined) existing.talent = clamp(args.talent, -3, 3);
          m.categoryScores[cId] = existing;
          return s;
        });
        const after = getState().members.find((m) => m.id === mId).categoryScores[cId];
        return ok({
          member: mh.item.name,
          category: ch.item.name,
          baseline: { pleasure: after.pleasure, talent: after.talent },
        });
      },
    },

    {
      name: "set_task_score",
      description:
        "Set a member's pleasure and/or talent score for one specific task. Locks the score so a later category change won't overwrite it. Use when a user gives task-specific feedback: 'On the auth refactor, Jordan loves it.'",
      permission: false,
      parameters: {
        type: "object",
        properties: {
          task_title: { type: "string" },
          member_name: { type: "string" },
          pleasure: { type: "integer", minimum: -3, maximum: 3 },
          talent: { type: "integer", minimum: -3, maximum: 3 },
        },
        required: ["task_title", "member_name"],
      },
      execute: async (args) => {
        const state = getState();
        const th = findTask(state, args.task_title);
        if (th.error) return err(th.error, { candidates: th.candidates });
        const mh = findMember(state, args.member_name);
        if (mh.error) return err(mh.error, { candidates: mh.candidates });
        const tId = th.item.id;
        const mId = mh.item.id;
        update((s) => {
          const t = s.tasks.find((x) => x.id === tId);
          if (!t) return s;
          const existing = (t.scores || {})[mId] || { pleasure: 0, talent: 0 };
          if (args.pleasure !== undefined) existing.pleasure = clamp(args.pleasure, -3, 3);
          if (args.talent !== undefined) existing.talent = clamp(args.talent, -3, 3);
          existing.autoFilled = false;
          t.scores = t.scores || {};
          t.scores[mId] = existing;
          return s;
        });
        const after = getState().tasks.find((t) => t.id === tId).scores[mId];
        return ok({
          task: th.item.title,
          member: mh.item.name,
          score: { pleasure: after.pleasure, talent: after.talent, autoFilled: !!after.autoFilled },
        });
      },
    },

    {
      name: "set_task_category",
      description:
        "Set or change a task's category. Untouched per-member scores re-seed from each member's baseline for the new category. Pass an empty string or omit category_name to clear the category.",
      permission: false,
      parameters: {
        type: "object",
        properties: {
          task_title: { type: "string" },
          category_name: { type: "string", description: "Category name; empty or omitted to clear." },
        },
        required: ["task_title"],
      },
      execute: async (args) => {
        const state = getState();
        const th = findTask(state, args.task_title);
        if (th.error) return err(th.error, { candidates: th.candidates });
        const tId = th.item.id;
        let categoryId = null;
        if (args.category_name && args.category_name.trim()) {
          const ch = findCategory(state, args.category_name);
          if (ch.error) return err(ch.error, { candidates: ch.candidates });
          categoryId = ch.item.id;
        }
        update((s) => {
          const t = s.tasks.find((x) => x.id === tId);
          if (!t) return s;
          t.categoryId = categoryId;
          if (!categoryId) return s;
          // Auto-fill untouched scores from baselines for the new category.
          s.members.forEach((m) => {
            const sc = (t.scores || {})[m.id];
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
        return ok({ task: th.item.title, categoryId });
      },
    },

    {
      name: "set_task_stakeholder",
      description:
        "Set or change a task's stakeholder (who the task is *for*). Pass an empty string or omit stakeholder_name to clear.",
      permission: false,
      parameters: {
        type: "object",
        properties: {
          task_title: { type: "string" },
          stakeholder_name: { type: "string", description: "Stakeholder name; empty or omitted to clear." },
        },
        required: ["task_title"],
      },
      execute: async (args) => {
        const state = getState();
        const th = findTask(state, args.task_title);
        if (th.error) return err(th.error, { candidates: th.candidates });
        const tId = th.item.id;
        let stakeholderId = null;
        if (args.stakeholder_name && args.stakeholder_name.trim()) {
          const sh = findStakeholder(state, args.stakeholder_name);
          if (sh.error) return err(sh.error, { candidates: sh.candidates });
          stakeholderId = sh.item.id;
        }
        update((s) => {
          const t = s.tasks.find((x) => x.id === tId);
          if (t) t.stakeholderId = stakeholderId;
          return s;
        });
        return ok({ task: th.item.title, stakeholderId });
      },
    },

    {
      name: "add_category",
      description: "Add a new task category. Categories can be used to tag tasks and to set per-member baseline scores.",
      permission: false,
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
      execute: async (args) => {
        const name = String(args.name || "").trim();
        if (!name) return err("Missing category name.");
        const state = getState();
        const existing = (state.categories || []).find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (existing) return err(`Category "${existing.name}" already exists.`);
        update((s) => {
          s.categories = s.categories || [];
          s.categories.push({ id: "c-" + Date.now(), name });
          return s;
        });
        return ok({ added: name });
      },
    },

    {
      name: "remove_category",
      description: "Remove a task category by name. Any tasks tagged with it become uncategorized. Destructive — requires user approval.",
      permission: true,
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
      execute: async (args) => {
        const state = getState();
        const hit = findCategory(state, args.name);
        if (hit.error) return err(hit.error, { candidates: hit.candidates });
        const id = hit.item.id;
        const removed = hit.item.name;
        update((s) => {
          s.categories = (s.categories || []).filter((c) => c.id !== id);
          (s.tasks || []).forEach((t) => {
            if (t.categoryId === id) t.categoryId = null;
          });
          return s;
        });
        return ok({ removed });
      },
    },

    {
      name: "add_stakeholder",
      description: "Add a new stakeholder. Stakeholders are the people or groups a task is *for* — founder, early users, the team, a specific customer.",
      permission: false,
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
      execute: async (args) => {
        const name = String(args.name || "").trim();
        if (!name) return err("Missing stakeholder name.");
        const state = getState();
        const existing = (state.stakeholders || []).find((s) => s.name.toLowerCase() === name.toLowerCase());
        if (existing) return err(`Stakeholder "${existing.name}" already exists.`);
        update((s) => {
          s.stakeholders = s.stakeholders || [];
          s.stakeholders.push({ id: "s-" + Date.now(), name });
          return s;
        });
        return ok({ added: name });
      },
    },

    {
      name: "remove_stakeholder",
      description: "Remove a stakeholder by name. Any tasks tagged with it lose the tag. Destructive — requires user approval.",
      permission: true,
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
      execute: async (args) => {
        const state = getState();
        const hit = findStakeholder(state, args.name);
        if (hit.error) return err(hit.error, { candidates: hit.candidates });
        const id = hit.item.id;
        const removed = hit.item.name;
        update((s) => {
          s.stakeholders = (s.stakeholders || []).filter((x) => x.id !== id);
          (s.tasks || []).forEach((t) => {
            if (t.stakeholderId === id) t.stakeholderId = null;
          });
          return s;
        });
        return ok({ removed });
      },
    },

    {
      name: "switch_tab",
      description: "Switch the visible tab. Useful after running other tools so the user sees the result.",
      permission: false,
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", enum: ["matrix", "team", "tasks", "insights"] },
        },
        required: ["name"],
      },
      execute: async (args) => {
        const name = String(args.name || "").toLowerCase();
        if (!VALID_TABS.has(name)) return err(`Unknown tab "${args.name}". Valid: matrix, team, tasks, insights.`);
        setTab(name);
        return ok({ tab: name });
      },
    },

    {
      name: "set_theme",
      description:
        "Switch the visual theme. Pass theme_id to change the colour preset (e.g. \"talk2view\" or \"workbook\") and/or mode (\"light\" or \"dark\"). Either field can be supplied alone.",
      permission: false,
      parameters: {
        type: "object",
        properties: {
          theme_id: { type: "string", description: "Preset id; one of the keys in PRESETS." },
          mode: { type: "string", enum: ["light", "dark"] },
        },
      },
      execute: async (args) => {
        if (args.theme_id !== undefined && !PRESETS[args.theme_id]) {
          return err(`Unknown theme "${args.theme_id}".`, { candidates: Object.keys(PRESETS) });
        }
        if (args.mode !== undefined && !VALID_MODES.has(args.mode)) {
          return err(`Unknown mode "${args.mode}". Valid: light, dark.`);
        }
        setTheme((t) => ({
          ...t,
          themeId: args.theme_id ?? t.themeId,
          mode: args.mode ?? t.mode,
        }));
        return ok({ theme_id: args.theme_id, mode: args.mode });
      },
    },

    {
      name: "load_demo",
      description: "Replace the current project with the built-in demo data (three members, six tasks, sample categories and stakeholders). Destructive — requires user approval.",
      permission: true,
      parameters: { type: "object", properties: {} },
      execute: async () => {
        loadDemo();
        return ok({ loaded: "demo" });
      },
    },

    {
      name: "clear_project",
      description: "Wipe the project to an empty state — no members, no tasks, no categories, no stakeholders. Destructive — requires user approval.",
      permission: true,
      parameters: { type: "object", properties: {} },
      execute: async () => {
        clearProject();
        return ok({ cleared: true });
      },
    },

    {
      name: "export_project",
      description: "Export the current project as a JSON string. Hand the string back to the user so they can copy it, or share it as part of the conversation.",
      permission: false,
      parameters: { type: "object", properties: {} },
      execute: async () => {
        const envelope = buildExportEnvelope(getState());
        return ok({ json: JSON.stringify(envelope, null, 2) });
      },
    },
  ];
}
