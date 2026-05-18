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

import { quadrantOf } from "../App";
import { clamp, findCategory, findMember, findStakeholder, findTask } from "./lookup";

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

export function buildJoyMatrixTools({ getState, getDerived, update }) {
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
  ];
}
