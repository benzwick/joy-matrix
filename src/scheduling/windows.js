// Energy + concentration windows: a per-member, time-of-day map of
// 1–3 scores. Day-agnostic for v1 — the same curve applies every day.
//
//   windows: {
//     morning:   { energy, concentration },
//     midday:    { energy, concentration },
//     afternoon: { energy, concentration },
//     evening:   { energy, concentration },
//   }

export const DAYTIMES = ["morning", "midday", "afternoon", "evening"];

export const DAYTIME_LABELS = {
  morning: "morning",
  midday: "midday",
  afternoon: "afternoon",
  evening: "evening",
};

// Half-open hour bounds for each bucket, used by the scheduler to map
// a concrete clock-time slot to the right window.
export const DAYTIME_BOUNDS = {
  morning:   { fromHour: 6,  toHour: 12 },
  midday:    { fromHour: 12, toHour: 14 },
  afternoon: { fromHour: 14, toHour: 18 },
  evening:   { fromHour: 18, toHour: 22 },
};

export const SCORE_LABELS = { 1: "low", 2: "med", 3: "high" };

// Return the daytime bucket that contains a given Date.
export function bucketForDate(date) {
  const h = date.getHours();
  if (h < DAYTIME_BOUNDS.morning.toHour) return "morning";
  if (h < DAYTIME_BOUNDS.midday.toHour) return "midday";
  if (h < DAYTIME_BOUNDS.afternoon.toHour) return "afternoon";
  return "evening";
}

// Neutral defaults: 2/2 in every bucket.
export function defaultWindows() {
  const out = {};
  for (const t of DAYTIMES) out[t] = { energy: 2, concentration: 2 };
  return out;
}

// Safe read with neutral fallback.
export function windowFor(member, bucket) {
  const w = member?.windows?.[bucket];
  return {
    energy: Math.max(1, Math.min(3, w?.energy ?? 2)),
    concentration: Math.max(1, Math.min(3, w?.concentration ?? 2)),
  };
}
