// Auto-scheduler: turns task→member assignments into concrete time
// blocks on a rolling 7-day calendar.
//
// computeSchedule(state, assignments, now) returns:
//   {
//     placements: { [taskId]: [{ from, to, memberId, bucket, score }] },
//     conflicts:  [{ taskId, reason }],
//     weekStart, weekEnd
//   }
//
// Hard constraints (respected): availability windows, deadline window,
// capacity (each 30-min slot used once per member).
// Soft objectives (optimised): effort ↔ energy match,
// difficulty ↔ concentration match, pleasure / talent bonus.

import { resolveDueDate } from "./dueDate";
import { windowsForDate } from "./availability";
import { bucketForDate, windowFor } from "./windows";

const HALF_HOUR_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function slotKey(date) {
  // Stable per-half-hour identifier inside the week.
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
}

// Within a quadrant, urgency × importance descending — same intuition
// as the assignment algorithm in App.jsx, used as a tiebreaker after
// deadline urgency.
function quadrantOrder(t) {
  const u = t.urgency >= 3, i = t.importance >= 3;
  if (u && i) return 0;       // DO
  if (!u && i) return 100;    // SCHEDULE
  if (u && !i) return 200;    // DELEGATE
  return 999;                 // ELIMINATE
}

function taskPriority(t) {
  return quadrantOrder(t) - (t.urgency * t.importance);
}

// Collect every free 30-min slot inside the assigned member's
// availability between fromMs and toMs (already-occupied keys excluded).
function collectFreeSlots(member, fromMs, toMs, occupied) {
  const out = [];
  if (toMs <= fromMs) return out;
  const occSet = occupied || new Set();
  for (let dayStart = startOfDay(new Date(fromMs)); dayStart.getTime() < toMs; dayStart = new Date(dayStart.getTime() + DAY_MS)) {
    const wins = windowsForDate(member, dayStart);
    for (const w of wins) {
      const start = Math.max(w.from.getTime(), fromMs);
      const end = Math.min(w.to.getTime(), toMs);
      if (start >= end) continue;
      for (let t = start; t + HALF_HOUR_MS <= end; t += HALF_HOUR_MS) {
        const key = slotKey(new Date(t));
        if (occSet.has(key)) continue;
        out.push({ from: new Date(t), to: new Date(t + HALF_HOUR_MS) });
      }
    }
  }
  return out;
}

// Score a single 30-min slot against a task assigned to a member.
function scoreSlot({ task, member, slot }) {
  const bucket = bucketForDate(slot.from);
  const w = windowFor(member, bucket);
  // Normalise 1–3 windows onto the 1–5 effort/difficulty scale so they
  // compare cleanly: 1→1, 2→3, 3→5.
  const energyNorm = 1 + (w.energy - 1) * 2;
  const concentrationNorm = 1 + (w.concentration - 1) * 2;
  const score = task.scores?.[member.id] || { pleasure: 0, talent: 0, difficulty: 3 };
  const difficulty = score.difficulty ?? 3;
  const effortMatch = -Math.abs(task.effort - energyNorm) * 2;
  const concentrationMatch = -Math.abs(difficulty - concentrationNorm) * 2;
  const pleasureBonus = (score.pleasure ?? 0) * 0.5;
  const talentBonus = (score.talent ?? 0) * 0.3;
  const total = effortMatch + concentrationMatch + pleasureBonus + talentBonus;
  return { total, bucket, breakdown: { effortMatch, concentrationMatch, pleasureBonus, talentBonus, energyNorm, concentrationNorm } };
}

export function computeSchedule(state, assignments, now = new Date()) {
  const weekStart = startOfDay(now);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
  const placements = {};
  const conflicts = [];
  const occupied = {}; // memberId -> Set<slotKey>

  if (!state?.tasks?.length || !assignments) {
    return { placements, conflicts, weekStart, weekEnd };
  }

  // Order: tasks with a hard deadline first (earliest first), then
  // tasks with an open window (whenever / no deadline) by quadrant.
  const enriched = state.tasks
    .map((t) => {
      const a = assignments[t.id];
      if (!a) return null;
      if (t.dueDate?.kind === "fuzzy" && t.dueDate.value === "never") return null;
      const win = resolveDueDate(t.dueDate, now);
      return { task: t, assignment: a, win };
    })
    .filter(Boolean);

  enriched.sort((a, b) => {
    const aBound = a.win?.to ? a.win.to.getTime() : Number.POSITIVE_INFINITY;
    const bBound = b.win?.to ? b.win.to.getTime() : Number.POSITIVE_INFINITY;
    if (aBound !== bBound) return aBound - bBound;
    return taskPriority(a.task) - taskPriority(b.task);
  });

  for (const { task, assignment, win } of enriched) {
    const member = state.members.find((m) => m.id === assignment.memberId);
    if (!member) continue;

    const requiredSlots = Math.max(1, Math.ceil(task.effort * 1.5 * 2));
    const fromMs = (win?.from?.getTime?.() ?? now.getTime());
    const placementFrom = Math.max(fromMs, now.getTime());
    const deadlineMs = win?.to ? win.to.getTime() : weekEnd.getTime();
    const placementTo = Math.min(deadlineMs, weekEnd.getTime());

    if (!occupied[member.id]) occupied[member.id] = new Set();
    const free = collectFreeSlots(member, placementFrom, placementTo, occupied[member.id]);

    if (free.length < requiredSlots) {
      conflicts.push({
        taskId: task.id,
        title: task.title,
        memberId: member.id,
        reason: free.length === 0
          ? `${member.name} has no availability before ${win?.to ? win.to.toLocaleDateString() : "the week ends"}.`
          : `Need ${requiredSlots} half-hour slots, only ${free.length} fit before deadline.`,
      });
      continue;
    }

    const scored = free.map((slot) => {
      const s = scoreSlot({ task, member, slot });
      return { ...slot, score: s.total, bucket: s.bucket };
    });
    scored.sort((a, b) => b.score - a.score);

    const taken = scored.slice(0, requiredSlots).sort((a, b) => a.from.getTime() - b.from.getTime());
    placements[task.id] = taken.map((s) => ({
      from: s.from.toISOString(),
      to: s.to.toISOString(),
      memberId: member.id,
      bucket: s.bucket,
      score: Number(s.score.toFixed(2)),
    }));
    for (const s of taken) occupied[member.id].add(slotKey(s.from));
  }

  return { placements, conflicts, weekStart, weekEnd };
}

// Convenience: total scheduled hours per member this week.
export function hoursPerMember(schedule) {
  const totals = {};
  for (const [, blocks] of Object.entries(schedule.placements || {})) {
    for (const b of blocks) {
      totals[b.memberId] = (totals[b.memberId] || 0) + 0.5;
    }
  }
  return totals;
}
