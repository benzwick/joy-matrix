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
import { findMember, findTask } from "./lookup";

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

export function buildJoyMatrixTools({ getState, getDerived }) {
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
  ];
}
