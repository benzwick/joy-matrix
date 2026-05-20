// Availability helpers. A member's availability is a per-day map of
// time ranges:
//   availability: { mon: [{from: "09:00", to: "17:00"}], tue: [...], ... }
// Empty array = unavailable that day. Missing key = unavailable.

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DAY_LABELS = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu",
  fri: "Fri", sat: "Sat", sun: "Sun",
};
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"];

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidHHMM(s) {
  return typeof s === "string" && HHMM_RE.test(s);
}

// Validate and clean a list of ranges: drops invalid entries, sorts
// by start time, merges overlaps.
export function normaliseRanges(ranges) {
  if (!Array.isArray(ranges)) return [];
  const cleaned = ranges
    .filter((r) => r && isValidHHMM(r.from) && isValidHHMM(r.to) && r.from < r.to)
    .map((r) => ({ from: r.from, to: r.to }))
    .sort((a, b) => a.from.localeCompare(b.from));
  const merged = [];
  for (const r of cleaned) {
    const last = merged[merged.length - 1];
    if (last && r.from <= last.to) {
      last.to = r.to > last.to ? r.to : last.to;
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

// Convenience: a "weekdays 9 to 5" availability for new members.
export function weekdayNineToFive() {
  const a = {};
  for (const d of DAYS) {
    a[d] = WEEKDAYS.includes(d) ? [{ from: "09:00", to: "17:00" }] : [];
  }
  return a;
}

// Empty availability — explicit "never available".
export function emptyAvailability() {
  const a = {};
  for (const d of DAYS) a[d] = [];
  return a;
}

// Parse a user / agent input into a clean ranges array. Accepts:
//   - array of {from, to} objects
//   - "all_day" → [{from: "00:00", to: "23:59"}]
//   - "unavailable" / "" / null → []
//   - "09:00-12:00" or "9-12" or "09:00-12:00, 14:00-18:00" shorthand
// Returns { ok: true, ranges } or { ok: false, error }.
export function parseRangesInput(input) {
  if (input == null || input === "" || input === "unavailable" || input === "none") {
    return { ok: true, ranges: [] };
  }
  if (input === "all_day") return { ok: true, ranges: [{ from: "00:00", to: "23:59" }] };
  if (Array.isArray(input)) {
    const cleaned = normaliseRanges(input);
    return { ok: true, ranges: cleaned };
  }
  if (typeof input === "string") {
    const parts = input.split(",").map((s) => s.trim()).filter(Boolean);
    const out = [];
    for (const p of parts) {
      const m = p.match(/^(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?$/);
      if (!m) return { ok: false, error: `Could not parse "${p}" — use HH:MM-HH:MM` };
      const pad = (h, mm) => `${String(parseInt(h, 10)).padStart(2, "0")}:${(mm || "00").padStart(2, "0")}`;
      const from = pad(m[1], m[2]);
      const to = pad(m[3], m[4]);
      if (!isValidHHMM(from) || !isValidHHMM(to) || from >= to) {
        return { ok: false, error: `Invalid range "${p}"` };
      }
      out.push({ from, to });
    }
    return { ok: true, ranges: normaliseRanges(out) };
  }
  return { ok: false, error: "Availability input must be a string or array of {from, to}." };
}

// Day-of-week key for a JS Date — matches our DAYS shape (mon..sun).
export function dayKey(date) {
  // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat. Remap to our mon..sun order.
  const jsDay = date.getDay();
  const idx = jsDay === 0 ? 6 : jsDay - 1;
  return DAYS[idx];
}

// Resolve a member's availability for a specific calendar date,
// returning concrete { from: Date, to: Date } windows anchored to
// that day. Returns [] if the day key is missing or has no ranges.
export function windowsForDate(member, date) {
  const key = dayKey(date);
  const ranges = (member?.availability && member.availability[key]) || [];
  return ranges.map((r) => {
    const [fh, fm] = r.from.split(":").map(Number);
    const [th, tm] = r.to.split(":").map(Number);
    const from = new Date(date);
    from.setHours(fh, fm, 0, 0);
    const to = new Date(date);
    to.setHours(th, tm, 0, 0);
    return { from, to };
  });
}

// Total hours of availability in a week — useful for capacity sanity.
export function weeklyAvailableHours(member) {
  let mins = 0;
  for (const d of DAYS) {
    for (const r of (member?.availability?.[d] || [])) {
      const [fh, fm] = r.from.split(":").map(Number);
      const [th, tm] = r.to.split(":").map(Number);
      mins += (th * 60 + tm) - (fh * 60 + fm);
    }
  }
  return mins / 60;
}
