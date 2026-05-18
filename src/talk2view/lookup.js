// Small helpers used by every Joy Matrix tool: case-insensitive name
// lookups that return either a single match or a candidate list for the
// agent to disambiguate with the user.

export function clamp(n, min, max) {
  const x = Number(n);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}

// Pick a single item from `items` by `key` field, given a user-supplied
// query. Returns { item } on success, { error, candidates? } otherwise.
function findOne(items, key, query, kind) {
  if (!query) return { error: `Missing ${kind} name.` };
  const q = String(query).toLowerCase().trim();
  // 1. Exact (case-insensitive) match
  const exact = items.filter((x) => String(x[key]).toLowerCase() === q);
  if (exact.length === 1) return { item: exact[0] };
  if (exact.length > 1) {
    return { error: `Multiple ${kind}s named "${query}".`, candidates: exact.map((x) => x[key]) };
  }
  // 2. Substring match (case-insensitive)
  const matches = items.filter((x) => String(x[key]).toLowerCase().includes(q));
  if (matches.length === 1) return { item: matches[0] };
  if (matches.length === 0) return { error: `No ${kind} matches "${query}".` };
  return {
    error: `Multiple ${kind}s match "${query}". Which did you mean?`,
    candidates: matches.map((x) => x[key]),
  };
}

export function findMember(state, name) {
  return findOne(state.members || [], "name", name, "member");
}
export function findTask(state, title) {
  return findOne(state.tasks || [], "title", title, "task");
}
export function findCategory(state, name) {
  return findOne(state.categories || [], "name", name, "category");
}
export function findStakeholder(state, name) {
  return findOne(state.stakeholders || [], "name", name, "stakeholder");
}
