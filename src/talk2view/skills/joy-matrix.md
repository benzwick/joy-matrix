---
name: joy-matrix
description: Domain knowledge for The Joy Matrix — an extension of the Eisenhower matrix that scores tasks by pleasure, talent, and capacity to maximize joy and eliminate burnout.
---

# The Joy Matrix

A productivity tool that extends the classic Eisenhower matrix (urgent ×
important) with three per-person dimensions: **pleasure**, **talent**, and
**capacity**. The app then assigns each task to the team member who will
move it fastest without burning anyone out.

**Important framing**: this is *not* a Joy-vs-Impact matrix. The two axes
are urgent × important (Eisenhower). Joy, talent, and capacity are *extra*
per-person scores that shape who an Eisenhower-classified task gets
assigned to, not the axes themselves.

---

## The four quadrants

Quadrants come from urgency and importance:

- **DO** — urgent + important. The algorithm weighs **talent** heaviest
  here. Get it done well, fast.
- **SCHEDULE** — important, not urgent. The algorithm weighs **pleasure**
  heaviest. Joy compounds into mastery in this quadrant.
- **DELEGATE** — urgent, not important. The algorithm weighs **capacity**
  heaviest. Goes to whoever has bandwidth.
- **ELIMINATE** — neither urgent nor important. The algorithm assigns
  nobody. Drop or defer.

A task lands in DO if urgency ≥ 3 *and* importance ≥ 3. SCHEDULE if
importance ≥ 3 but urgency < 3. DELEGATE if urgency ≥ 3 but importance < 3.
ELIMINATE if both < 3.

---

## Scoring dimensions

Per task:
- **urgency** (1–5)
- **importance** (1–5)
- **effort** (1–5) — how much of an assignee's capacity budget the task
  consumes.

Per (task, member) pair:
- **pleasure** (−3..+3) — how much joy this person draws from this work
  (positive = energizing, negative = draining).
- **talent** (−3..+3) — how well-suited they are (positive = strong fit,
  negative = stretch or mismatch).

Per member:
- **capacity** (−3..+3) — *current* bandwidth, not a permanent trait. It
  changes week to week (vacation, illness, a hot deadline elsewhere).
  Capacity translates to an **effort budget** of 1–7 units:
  - capacity −3 → budget 1
  - capacity 0 → budget 4
  - capacity +3 → budget 7

The algorithm subtracts each assigned task's effort from the chosen
person's remaining budget.

---

## The assignment algorithm

For each task (in priority order: DO > SCHEDULE > DELEGATE; within a
quadrant by `urgency × importance` descending), the algorithm scores every
member and picks the highest:

  score = w.talent × talent
        + w.pleasure × pleasure
        + w.capacity × (remaining / initial_budget × 3)
        − burnout_penalty

Where `w` depends on the quadrant:

| Quadrant | w.talent | w.pleasure | w.capacity |
|----------|---------|------------|------------|
| DO       | 0.50    | 0.20       | 0.30       |
| SCHEDULE | 0.30    | 0.50       | 0.20       |
| DELEGATE | 0.20    | 0.30       | 0.50       |

`burnout_penalty = 1.2 × max(0, effort − remaining_budget)` — heavily
discourages stacking work on someone who's already over budget.

After assignment, a per-member rollup computes:
- **load** (total effort used)
- **joy index** (Σ pleasure × effort for assigned tasks)
- **talent fit** (Σ talent × effort)
- **burnout** flag — true when remaining < −1.5
- **strain** flag — true when remaining ∈ [−1.5, 0) (over budget but not
  yet in burnout territory)

---

## Categories

Optional. Each project can define categories (e.g. Engineering, Design,
Marketing, Ops). Two layers:

1. **Per-member baselines** — each member can set a baseline pleasure and
   talent score for each category. Backend dev loves and is good at
   engineering; hates writing grants. Set it once.
2. **Per-task category** — each task can be tagged with one category.
   When a task is created (or its category changes), the per-member
   scores auto-fill from each member's baseline for that category.
3. **Lock on edit** — once a user moves a per-task slider for a
   (task, member) pair, that score is "locked": future category changes
   won't overwrite it. The intent is "you've explicitly scored this; we
   won't second-guess you."

If a member has no baseline for the category, the auto-fill produces
neutral scores (0/0).

---

## Stakeholders

Optional. A short list of people or groups the work is *for* — founder,
early users, the team, a specific customer. Each task can carry one
stakeholder tag. Displayed in the Matrix view next to the assignee as
"for {stakeholder}". Doesn't change the algorithm — it's annotation, not
weight.

---

## Availability

Each member has a per-day-of-week availability map:

```
availability: { mon: [{from: "09:00", to: "17:00"}], tue: [...], ... }
```

Keys are `mon..sun`, values are arrays of `{from, to}` HH:MM windows.
Empty array = unavailable that day. A day key missing entirely is also
treated as unavailable. Multiple ranges per day are allowed (e.g.
morning + afternoon with a lunch break in between).

Use the `set_member_availability` tool to edit. It accepts:

- Array of `{from, to}` objects.
- String shorthand: `"all_day"`, `"unavailable"`, or
  `"09:00-12:00, 14:00-18:00"`.
- The special value `"weekdays_9_5"` resets the whole week to
  Mon–Fri 09:00–17:00 in one call (day parameter ignored).

Availability is read by the scheduler in the Schedule tab — it never
places work outside a member's available windows.

---

## Difficulty (per-task, per-member)

Each entry in `tasks[].scores[memberId]` carries an optional
`difficulty` score on the 1–5 scale (1 = mindless busywork, 3 = normal,
5 = needs deep focus). Stored alongside the existing `pleasure` and
`talent` for that (task, member) pair. Defaults to 3 when unset.

Crucially, difficulty is **per-member** — the same task can be deep
work for one person and trivial for another. "Refactor auth" might be
a 5 for someone new to the codebase and a 2 for someone who wrote it.

The scheduler matches a task's difficulty (for its assigned member)
against the **concentration** dimension of that member's daytime
windows. High-difficulty tasks land in high-concentration slots.

Set via `set_task_difficulty({ task_title, member_name, difficulty })`
or `set_task_score` (which now also accepts `difficulty`).

---

## Energy and concentration windows

Each member also carries a day-agnostic energy + concentration curve
over the day, split into four buckets:

```
windows: {
  morning:   { energy: 1-3, concentration: 1-3 },
  midday:    { ... },
  afternoon: { ... },
  evening:   { ... },
}
```

Each score is 1 (low), 2 (med), or 3 (high). Defaults are 2/2 — neutral.

Time-of-day boundaries:

- morning: 06:00–12:00
- midday: 12:00–14:00
- afternoon: 14:00–18:00
- evening: 18:00–22:00

The scheduler reads these to match work with the right window: high
**effort** tasks land in high-**energy** slots; high **difficulty**
tasks land in high-**concentration** slots. Pleasure / talent still
decide *who* the task goes to; energy / concentration decide *when*.

Use `set_energy_window({ member_name, time_of_day, energy?, concentration? })`
to edit. Either field is optional — pass only what's changing.

---

## Due dates

Optional per task. Two forms:

- **Fuzzy labels**, evaluated relative to the user's local clock:
  `now`, `today`, `this-morning`, `this-afternoon`, `this-evening`,
  `tomorrow`, `this-week`, `soon` (3-day window), `later` (14-day
  window), `whenever` (no deadline, lowest priority), `never` (excluded
  from scheduling).
- **Exact** — an ISO 8601 datetime.

Displayed as a small pill on the task chip (matrix grid) and the task
card (tasks list). Pill turns warn-coloured (rust) when overdue.

Use the `set_task_due_date` tool to set or clear. The tool accepts
either form: `"this-friday"` and `"2026-06-15T14:00"` both work.

---

## The Schedule tab and auto-scheduler

The Schedule tab (between Tasks and Insights) takes each task's
assignment, due date, and the assigned member's availability +
energy/concentration curve, and places work into real 30-minute time
blocks on a rolling 7-day calendar.

Algorithm (informal):

1. Tasks with due dates land first, earliest deadline first. Tasks
   with no deadline (or `whenever`) fill remaining capacity. `never`
   tasks are excluded.
2. Each task needs `effort × 1.5` hours, packed at 30-min granularity
   (effort 1 → 3 slots, effort 5 → 15 slots).
3. For each task, every free 30-min slot inside the assigned member's
   availability before the deadline gets a score combining four
   things:
   - `−|effort − slot.energy|` (high effort wants high energy)
   - `−|difficulty − slot.concentration|` (deep work wants peak focus)
   - `+ pleasure × 0.5` (mild bonus where work is enjoyable)
   - `+ talent × 0.3` (mild bonus where it's a strong fit)
4. The top-N highest-scoring slots are picked and marked occupied.
5. Tasks that don't fit before their deadline surface in a
   "conflicts" strip with a reason.

The tab has four view modes (Day / Week / Month / Year) sharing the
same placement data; only the projection changes.

The `summarize_schedule` tool returns this week's placements,
per-member hour totals, and any conflicts in JSON for the chat to
quote from.

---

## The five tabs

- **Matrix** — the four-quadrant grid with task chips and assignees.
  Click a task chip to jump to its editor.
- **Team** — one card per member: capacity slider, expandable category
  baselines, availability windows, energy + concentration curve,
  per-member rollup stats (tasks, load, joy, talent fit,
  burnout/strain warnings).
- **Tasks** — categories + stakeholders bars at top, then the task
  list. Each task is editable inline (title, U/I/E sliders, category,
  stakeholder, due date picker, per-member pleasure/talent/difficulty
  grid).
- **Schedule** — auto-placement weekly calendar in four views
  (Day / Week / Month / Year). See the section above.
- **Insights** — global stats (total joy, total talent fit, burnout
  count, strain count), per-person joy×load bars, a "pain points" list
  (assignments where the chosen person has pleasure ≤ −2 or talent ≤ −2),
  a per-person scheduled / idle / over-budget breakdown, and a written
  "read" of whether the configuration is healthy or grinding.

---

## Themes

Two built-in themes, each with light and dark variants:

- **Talk2View** (default) — warm off-white paper, near-black ink,
  seafoam-teal accent. Borrowed from talk2view.com.
- **Workbook** — warm cream paper, deep ink, hot-rust accent. Editorial
  feel.

User can override individual colors (paper, ink, rust, teal, ochre) and
swap fonts (heading / body / mono) via the Customize panel.

---

## What the app is *not*

- No accounts, no signup, no login wall.
- No cloud sync, no backend. State lives entirely in the visitor's browser
  via localStorage.
- No multi-user collaboration in real time — it's a single-browser
  planning tool by design.
- Export and import are JSON files; that's how a user shares a project
  with a teammate.

---

## Ethos and credits

- Released into the **public domain** via the Unlicense.
- Dedicated to **Terry A. Davis** (creator of TempleOS), following his
  declaration that all his work is public domain.
- Source: github.com/benzwick/joy-matrix
- Live: joy-matrix.com
- Built as a demonstration of a philosophy of work — joy and sustainability
  over grind.
