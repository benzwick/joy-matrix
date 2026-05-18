import React, { useState, useEffect, useMemo } from "react";
import {
  Plus, X, Sparkles, AlertTriangle, Trash2, RefreshCw,
  Zap, Heart, Brain, Battery, ArrowRight, Target, Users, ListTodo, Grid3x3, Activity
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types of intent
//   urgency    1–5
//   importance 1–5
//   effort     1–5  (relative load units consumed from a person's budget)
//   pleasure   -3..+3   per (task, member)
//   talent     -3..+3   per (task, member)
//   capacity   -3..+3   per member  (current bandwidth, not a fixed trait)
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "joymatrix-state-v1";

const DEMO_STATE = {
  goal: {
    from: "scattered MVP, no users",
    to: "launched product loved by 1,000 users",
  },
  members: [
    { id: "m1", name: "Maya", capacity: 2 },
    { id: "m2", name: "Jordan", capacity: 0 },
    { id: "m3", name: "Sam", capacity: -1 },
  ],
  tasks: [
    {
      id: "t1", title: "Ship landing page redesign",
      urgency: 4, importance: 4, effort: 2,
      scores: {
        m1: { pleasure: 3, talent: 3 },
        m2: { pleasure: 0, talent: 1 },
        m3: { pleasure: -1, talent: 0 },
      },
    },
    {
      id: "t2", title: "Set up Stripe + billing flows",
      urgency: 3, importance: 5, effort: 4,
      scores: {
        m1: { pleasure: -2, talent: 0 },
        m2: { pleasure: 1, talent: 3 },
        m3: { pleasure: -1, talent: 1 },
      },
    },
    {
      id: "t3", title: "Write & schedule launch tweet thread",
      urgency: 5, importance: 2, effort: 1,
      scores: {
        m1: { pleasure: 1, talent: 2 },
        m2: { pleasure: -1, talent: 0 },
        m3: { pleasure: 3, talent: 3 },
      },
    },
    {
      id: "t4", title: "Refactor auth (tech debt)",
      urgency: 1, importance: 4, effort: 4,
      scores: {
        m1: { pleasure: -2, talent: -1 },
        m2: { pleasure: 2, talent: 3 },
        m3: { pleasure: -3, talent: -2 },
      },
    },
    {
      id: "t5", title: "Update outdated help docs",
      urgency: 1, importance: 1, effort: 2,
      scores: {
        m1: { pleasure: -1, talent: 1 },
        m2: { pleasure: -2, talent: 0 },
        m3: { pleasure: 0, talent: 2 },
      },
    },
    {
      id: "t6", title: "Run 5 user research interviews",
      urgency: 2, importance: 5, effort: 3,
      scores: {
        m1: { pleasure: 2, talent: 2 },
        m2: { pleasure: -2, talent: 0 },
        m3: { pleasure: 3, talent: 3 },
      },
    },
  ],
};

const EMPTY_STATE = {
  goal: { from: "", to: "" },
  members: [],
  tasks: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Algorithm
// ─────────────────────────────────────────────────────────────────────────────

const quadrantOf = (t) => {
  const u = t.urgency >= 3, i = t.importance >= 3;
  if (u && i) return "DO";
  if (!u && i) return "SCHEDULE";
  if (u && !i) return "DELEGATE";
  return "ELIMINATE";
};

const QUADRANT_META = {
  DO:        { label: "DO",        sub: "urgent · important",       weight: { talent: 0.50, pleasure: 0.20, capacity: 0.30 } },
  SCHEDULE:  { label: "SCHEDULE",  sub: "important · not urgent",   weight: { talent: 0.30, pleasure: 0.50, capacity: 0.20 } },
  DELEGATE:  { label: "DELEGATE",  sub: "urgent · not important",   weight: { talent: 0.20, pleasure: 0.30, capacity: 0.50 } },
  ELIMINATE: { label: "ELIMINATE", sub: "neither — drop or defer",  weight: null },
};

// budget in effort units: capacity -3→1, 0→4, +3→7
const budgetOf = (m) => Math.max(0.5, 4 + m.capacity);

// priority order for greedy assignment
const QUAD_ORDER = ["DO", "SCHEDULE", "DELEGATE"];
const taskPriority = (t) => {
  const q = quadrantOf(t);
  const base = { DO: 0, SCHEDULE: 100, DELEGATE: 200, ELIMINATE: 999 }[q];
  // within quadrant: urgency*importance descending
  return base - (t.urgency * t.importance);
};

function computeAssignments(state) {
  const remaining = Object.fromEntries(state.members.map(m => [m.id, budgetOf(m)]));
  const initialBudget = Object.fromEntries(state.members.map(m => [m.id, budgetOf(m)]));
  const sorted = [...state.tasks].sort((a, b) => taskPriority(a) - taskPriority(b));
  const assignments = {};      // taskId -> { memberId, score, reasoning, burnoutRisk }
  const memberLoad = Object.fromEntries(state.members.map(m => [m.id, []]));

  for (const task of sorted) {
    const q = quadrantOf(task);
    if (q === "ELIMINATE" || state.members.length === 0) {
      assignments[task.id] = null;
      continue;
    }
    const w = QUADRANT_META[q].weight;
    let best = null;
    for (const m of state.members) {
      const s = task.scores?.[m.id] ?? { pleasure: 0, talent: 0 };
      const remainNorm = remaining[m.id] / Math.max(1, initialBudget[m.id]); // 0..1ish
      const overshoot = Math.max(0, task.effort - remaining[m.id]);
      const burnoutPenalty = overshoot * 1.2;
      const score =
        w.talent * s.talent +
        w.pleasure * s.pleasure +
        w.capacity * (remainNorm * 3) -   // scale capacity into ~-3..3 range
        burnoutPenalty;
      if (!best || score > best.score) {
        best = { memberId: m.id, score, talent: s.talent, pleasure: s.pleasure, overshoot };
      }
    }
    if (!best) { assignments[task.id] = null; continue; }
    remaining[best.memberId] -= task.effort;
    memberLoad[best.memberId].push(task.id);
    const reasoning = buildReasoning(q, best, state.members.find(m => m.id === best.memberId));
    assignments[task.id] = {
      memberId: best.memberId,
      score: best.score,
      reasoning,
      burnoutRisk: remaining[best.memberId] < -1.5,
    };
  }

  // per-member rollups
  const summary = state.members.map(m => {
    const taskIds = memberLoad[m.id];
    const tasks = taskIds.map(id => state.tasks.find(t => t.id === id));
    const totalEffort = tasks.reduce((s, t) => s + t.effort, 0);
    const joyIndex = tasks.reduce((s, t) => s + (t.scores?.[m.id]?.pleasure ?? 0) * t.effort, 0);
    const talentIndex = tasks.reduce((s, t) => s + (t.scores?.[m.id]?.talent ?? 0) * t.effort, 0);
    const used = initialBudget[m.id] - remaining[m.id];
    const utilization = initialBudget[m.id] > 0 ? used / initialBudget[m.id] : 0;
    return {
      memberId: m.id, name: m.name,
      taskCount: tasks.length, totalEffort,
      joyIndex, talentIndex,
      remaining: remaining[m.id],
      budget: initialBudget[m.id],
      utilization,
      burnout: remaining[m.id] < -1.5,
      strain: remaining[m.id] < 0 && remaining[m.id] >= -1.5,
    };
  });

  return { assignments, summary };
}

function buildReasoning(q, best, member) {
  const bits = [];
  if (best.talent >= 2) bits.push("strong talent fit");
  else if (best.talent <= -2) bits.push("stretch (low talent)");
  if (best.pleasure >= 2) bits.push("brings them joy");
  else if (best.pleasure <= -2) bits.push("painful — minimize");
  if (best.overshoot > 0) bits.push("over capacity, watch for burnout");
  if (bits.length === 0) bits.push("best available match");
  return `${member?.name ?? "?"}: ${bits.join(" · ")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage
// ─────────────────────────────────────────────────────────────────────────────

function loadState() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) return JSON.parse(v);
  } catch (e) { /* not found or invalid */ }
  return null;
}
function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// UI primitives
// ─────────────────────────────────────────────────────────────────────────────

const colors = {
  paper: "#f4ebdb",
  paperDeep: "#ece1cb",
  ink: "#1c1916",
  inkSoft: "#3a342c",
  rule: "rgba(28,25,22,0.14)",
  rust: "#b8492a",
  rustDeep: "#8e2f17",
  teal: "#2a5d5d",
  ochre: "#c98a2c",
  bone: "#fbf6ec",
};

function Pill({ children, tone = "ink" }) {
  const tones = {
    ink:  { bg: "rgba(28,25,22,0.06)", color: colors.ink, bd: "rgba(28,25,22,0.14)" },
    rust: { bg: "rgba(184,73,42,0.10)", color: colors.rustDeep, bd: "rgba(184,73,42,0.30)" },
    teal: { bg: "rgba(42,93,93,0.10)",  color: colors.teal, bd: "rgba(42,93,93,0.30)" },
    warn: { bg: "rgba(184,73,42,0.18)", color: colors.rustDeep, bd: "rgba(184,73,42,0.50)" },
  };
  const t = tones[tone];
  return (
    <span style={{
      fontFamily: "Geist Mono, ui-monospace, monospace",
      fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
      padding: "3px 8px", borderRadius: 999,
      background: t.bg, color: t.color, border: `1px solid ${t.bd}`,
      whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function Slider({ value, onChange, min, max, step = 1, color = colors.ink, label }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Geist Mono, monospace", fontSize: 10, color: colors.inkSoft, letterSpacing: "0.06em", marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color: color, fontWeight: 600 }}>{value > 0 ? `+${value}` : value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%", height: 4, borderRadius: 999, appearance: "none",
          background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, rgba(28,25,22,0.12) ${pct}%, rgba(28,25,22,0.12) 100%)`,
          cursor: "pointer",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("matrix");
  const [editingTask, setEditingTask] = useState(null);

  // inject fonts
  useEffect(() => {
    const id = "joymatrix-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,900&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
  }, []);

  // load
  useEffect(() => {
    const saved = loadState();
    setState(saved ?? DEMO_STATE);
  }, []);

  // save
  useEffect(() => {
    if (state) saveState(state);
  }, [state]);

  const { assignments, summary } = useMemo(
    () => state ? computeAssignments(state) : { assignments: {}, summary: [] },
    [state]
  );

  if (!state) {
    return (
      <div style={{ minHeight: "100vh", background: colors.paper, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Fraunces, serif", color: colors.ink }}>
        loading…
      </div>
    );
  }

  const update = (fn) => setState((s) => fn(structuredClone(s)));

  const addMember = () => {
    const name = prompt("Team member name?");
    if (!name) return;
    update(s => {
      const id = "m" + Date.now();
      s.members.push({ id, name, capacity: 0 });
      // initialize empty scores in each task
      s.tasks.forEach(t => { t.scores[id] = { pleasure: 0, talent: 0 }; });
      return s;
    });
  };

  const removeMember = (id) => {
    update(s => {
      s.members = s.members.filter(m => m.id !== id);
      s.tasks.forEach(t => { delete t.scores[id]; });
      return s;
    });
  };

  const addTask = () => {
    const title = prompt("Task title?");
    if (!title) return;
    update(s => {
      const id = "t" + Date.now();
      const scores = {};
      s.members.forEach(m => { scores[m.id] = { pleasure: 0, talent: 0 }; });
      s.tasks.push({ id, title, urgency: 3, importance: 3, effort: 2, scores });
      return s;
    });
  };

  const removeTask = (id) => {
    update(s => { s.tasks = s.tasks.filter(t => t.id !== id); return s; });
  };

  const reset = () => {
    if (!confirm("Reset to demo data? Current state will be lost.")) return;
    setState(structuredClone(DEMO_STATE));
  };
  const clearAll = () => {
    if (!confirm("Clear everything?")) return;
    setState(structuredClone(EMPTY_STATE));
  };

  return (
    <div style={{
      minHeight: "100vh", background: colors.paper, color: colors.ink,
      fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif",
      backgroundImage: "radial-gradient(circle at 20% 0%, rgba(184,73,42,0.06), transparent 50%), radial-gradient(circle at 80% 100%, rgba(42,93,93,0.05), transparent 50%)",
    }}>
      {/* header */}
      <header style={{ padding: "32px 20px 16px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, letterSpacing: "0.18em", color: colors.inkSoft }}>
            JOYMATRIX · v1
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={reset} title="Load demo data" style={btnGhost}>
              <RefreshCw size={12} /> demo
            </button>
            <button onClick={clearAll} title="Clear all" style={btnGhost}>
              <Trash2 size={12} /> clear
            </button>
          </div>
        </div>

        <h1 style={{
          fontFamily: "Fraunces, serif", fontWeight: 900, fontStyle: "italic",
          fontSize: "clamp(36px, 7vw, 64px)", lineHeight: 0.95, letterSpacing: "-0.02em",
          margin: "12px 0 4px",
          fontVariationSettings: '"opsz" 144',
        }}>
          From <span style={{ fontStyle: "normal", fontWeight: 400, color: colors.rustDeep }}>A</span>{" "}
          to <span style={{ fontStyle: "normal", fontWeight: 400, color: colors.teal }}>B</span>,
          <br/>
          <span style={{ fontWeight: 400, fontStyle: "normal", color: colors.inkSoft, fontSize: "0.6em" }}>
            without burning anyone out.
          </span>
        </h1>

        {/* goal box */}
        <div style={{
          marginTop: 20, padding: 16, borderRadius: 12,
          background: colors.bone, border: `1px solid ${colors.rule}`,
          display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center",
        }}>
          <div>
            <div style={mutedLabel}>FROM (A)</div>
            <input
              value={state.goal.from}
              onChange={(e) => update(s => { s.goal.from = e.target.value; return s; })}
              placeholder="where you are now"
              style={inputBare}
            />
          </div>
          <ArrowRight size={20} color={colors.inkSoft} />
          <div>
            <div style={{ ...mutedLabel, color: colors.teal }}>TO (B)</div>
            <input
              value={state.goal.to}
              onChange={(e) => update(s => { s.goal.to = e.target.value; return s; })}
              placeholder="where you want to be"
              style={inputBare}
            />
          </div>
        </div>
      </header>

      {/* tabs */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 10,
        background: colors.paper + "ee", backdropFilter: "blur(8px)",
        borderTop: `1px solid ${colors.rule}`, borderBottom: `1px solid ${colors.rule}`,
        padding: "10px 16px", marginBottom: 4,
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 4, overflowX: "auto" }}>
          {[
            ["matrix",  "Matrix",  Grid3x3],
            ["team",    "Team",    Users],
            ["tasks",   "Tasks",   ListTodo],
            ["insights","Insights",Activity],
          ].map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              ...tabBtn, ...(tab === key ? tabBtnActive : {}),
            }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </nav>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 16px 80px" }}>
        {tab === "matrix"   && <MatrixView state={state} assignments={assignments} onEditTask={(t) => { setTab("tasks"); setEditingTask(t.id); }} />}
        {tab === "team"     && <TeamView state={state} update={update} addMember={addMember} removeMember={removeMember} summary={summary} />}
        {tab === "tasks"    && <TasksView state={state} update={update} addTask={addTask} removeTask={removeTask} editing={editingTask} setEditing={setEditingTask} assignments={assignments} />}
        {tab === "insights" && <InsightsView state={state} summary={summary} assignments={assignments} />}
      </main>

      <footer style={{ textAlign: "center", padding: "24px 16px 40px", fontFamily: "Geist Mono, monospace", fontSize: 10, color: colors.inkSoft, letterSpacing: "0.08em" }}>
        ─── designed for sustainable speed ───
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Matrix View
// ─────────────────────────────────────────────────────────────────────────────

function MatrixView({ state, assignments, onEditTask }) {
  const groups = { DO: [], SCHEDULE: [], DELEGATE: [], ELIMINATE: [] };
  state.tasks.forEach(t => groups[quadrantOf(t)].push(t));

  const cellMeta = {
    DO:        { color: colors.rustDeep, bg: "rgba(184,73,42,0.06)" },
    SCHEDULE:  { color: colors.teal,     bg: "rgba(42,93,93,0.06)" },
    DELEGATE:  { color: colors.ochre,    bg: "rgba(201,138,44,0.07)" },
    ELIMINATE: { color: colors.inkSoft,  bg: "rgba(28,25,22,0.04)" },
  };

  return (
    <div>
      <SectionHead
        eyebrow="01"
        title="The Matrix"
        sub="Tasks placed by urgency × importance, then auto-assigned."
      />

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 10,
        marginTop: 16, minHeight: 480,
      }}>
        {["DO", "DELEGATE", "SCHEDULE", "ELIMINATE"].map(q => {
          const meta = QUADRANT_META[q];
          const cm = cellMeta[q];
          return (
            <div key={q} style={{
              borderRadius: 14, padding: "14px 14px 10px",
              background: cm.bg, border: `1px solid ${colors.rule}`,
              display: "flex", flexDirection: "column", gap: 8, minHeight: 220,
            }}>
              <div>
                <div style={{ fontFamily: "Fraunces, serif", fontWeight: 700, fontSize: 22, color: cm.color, letterSpacing: "-0.02em" }}>
                  {meta.label}
                </div>
                <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: "0.1em", color: colors.inkSoft, textTransform: "uppercase" }}>
                  {meta.sub}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                {groups[q].length === 0 && (
                  <div style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", color: colors.inkSoft, fontSize: 13 }}>
                    nothing here yet
                  </div>
                )}
                {groups[q].map(t => {
                  const a = assignments[t.id];
                  const assignee = a ? state.members.find(m => m.id === a.memberId) : null;
                  return (
                    <button key={t.id} onClick={() => onEditTask(t)} style={{
                      textAlign: "left", padding: "8px 10px", borderRadius: 8,
                      background: colors.bone, border: `1px solid ${colors.rule}`,
                      cursor: "pointer", color: colors.ink,
                      display: "flex", flexDirection: "column", gap: 4,
                    }}>
                      <div style={{ fontWeight: 500, fontSize: 13.5, lineHeight: 1.25 }}>{t.title}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {assignee ? (
                          <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, color: cm.color, fontWeight: 600 }}>
                            → {assignee.name}
                          </span>
                        ) : q !== "ELIMINATE" ? (
                          <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, color: colors.inkSoft }}>unassigned</span>
                        ) : (
                          <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, color: colors.inkSoft }}>drop or defer</span>
                        )}
                        {a?.burnoutRisk && (
                          <span title="burnout risk" style={{ display: "inline-flex", alignItems: "center", gap: 2, fontFamily: "Geist Mono, monospace", fontSize: 9, color: colors.rustDeep }}>
                            <AlertTriangle size={10} /> risk
                          </span>
                        )}
                        <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 9, color: colors.inkSoft, marginLeft: "auto" }}>
                          U{t.urgency} I{t.importance} E{t.effort}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Legend />
    </div>
  );
}

function Legend() {
  return (
    <div style={{
      marginTop: 18, padding: 14, borderRadius: 10,
      background: colors.bone, border: `1px solid ${colors.rule}`,
      display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12,
      fontSize: 12, color: colors.inkSoft, lineHeight: 1.5,
    }}>
      <div>
        <div style={{ ...mutedLabel, color: colors.rustDeep, marginBottom: 4 }}>DO — talent first</div>
        High-urgency, high-importance. Algorithm weighs talent heaviest so it gets done well, fast.
      </div>
      <div>
        <div style={{ ...mutedLabel, color: colors.teal, marginBottom: 4 }}>SCHEDULE — pleasure first</div>
        Important, not urgent. Pleasure dominates — this is where joy compounds into mastery.
      </div>
      <div>
        <div style={{ ...mutedLabel, color: colors.ochre, marginBottom: 4 }}>DELEGATE — capacity first</div>
        Urgent but not important. Goes to whoever has bandwidth to spare, regardless of love for it.
      </div>
      <div>
        <div style={{ ...mutedLabel, color: colors.inkSoft, marginBottom: 4 }}>ELIMINATE — kill it</div>
        Neither urgent nor important. Don't assign. Don't do.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Team View
// ─────────────────────────────────────────────────────────────────────────────

function TeamView({ state, update, addMember, removeMember, summary }) {
  return (
    <div>
      <SectionHead
        eyebrow="02"
        title="The Team"
        sub="Capacity is current bandwidth, not a fixed trait. It changes week to week."
        action={<button onClick={addMember} style={btnPrimary}><Plus size={14}/> add member</button>}
      />

      {state.members.length === 0 && (
        <Empty>No team members yet. Add someone to begin.</Empty>
      )}

      <div style={{ display: "grid", gap: 12, marginTop: 16, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {state.members.map(m => {
          const s = summary.find(x => x.memberId === m.id);
          return (
            <div key={m.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                <input
                  value={m.name}
                  onChange={(e) => update(st => { st.members.find(x => x.id === m.id).name = e.target.value; return st; })}
                  style={{ ...inputBare, fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", padding: 0 }}
                />
                <button onClick={() => removeMember(m.id)} style={btnIcon} title="remove"><X size={14}/></button>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <Battery size={12} color={colors.teal} />
                  <span style={mutedLabel}>CAPACITY</span>
                </div>
                <Slider
                  value={m.capacity}
                  onChange={(v) => update(st => { st.members.find(x => x.id === m.id).capacity = v; return st; })}
                  min={-3} max={3} color={colors.teal} label={capacityWord(m.capacity)}
                />
              </div>

              {s && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${colors.rule}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <Stat label="tasks" value={s.taskCount} />
                    <Stat label="load" value={`${s.totalEffort}/${s.budget.toFixed(1)}`} />
                    <Stat label="joy" value={s.joyIndex > 0 ? `+${s.joyIndex}` : s.joyIndex} tone={s.joyIndex >= 0 ? "teal" : "rust"} />
                    <Stat label="talent fit" value={s.talentIndex > 0 ? `+${s.talentIndex}` : s.talentIndex} />
                  </div>
                  {s.burnout && (
                    <div style={warnBox}>
                      <AlertTriangle size={13}/> Burnout risk — over capacity by {Math.abs(s.remaining).toFixed(1)}
                    </div>
                  )}
                  {s.strain && (
                    <div style={{ ...warnBox, background: "rgba(201,138,44,0.10)", color: colors.ochre, borderColor: "rgba(201,138,44,0.3)" }}>
                      <AlertTriangle size={13}/> Stretched — at limit
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function capacityWord(c) {
  if (c >= 2) return "lots of bandwidth";
  if (c === 1) return "available";
  if (c === 0) return "neutral";
  if (c === -1) return "stretched";
  if (c === -2) return "near limit";
  return "overloaded";
}

function Stat({ label, value, tone = "ink" }) {
  const colorMap = { ink: colors.ink, teal: colors.teal, rust: colors.rustDeep };
  return (
    <div>
      <div style={mutedLabel}>{label}</div>
      <div style={{ fontFamily: "Fraunces, serif", fontWeight: 700, fontSize: 20, color: colorMap[tone], lineHeight: 1.1, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tasks View
// ─────────────────────────────────────────────────────────────────────────────

function TasksView({ state, update, addTask, removeTask, editing, setEditing, assignments }) {
  return (
    <div>
      <SectionHead
        eyebrow="03"
        title="The Tasks"
        sub="Score each person's pleasure & talent for each task. Be honest."
        action={<button onClick={addTask} style={btnPrimary}><Plus size={14}/> add task</button>}
      />

      {state.tasks.length === 0 && (
        <Empty>No tasks yet.</Empty>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {state.tasks.map(t => {
          const isOpen = editing === t.id;
          const a = assignments[t.id];
          const assignee = a ? state.members.find(m => m.id === a.memberId) : null;
          const q = quadrantOf(t);
          return (
            <div key={t.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    value={t.title}
                    onChange={(e) => update(st => { st.tasks.find(x => x.id === t.id).title = e.target.value; return st; })}
                    style={{ ...inputBare, fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", padding: 0 }}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <Pill tone={q === "DO" ? "rust" : q === "SCHEDULE" ? "teal" : "ink"}>{q}</Pill>
                    {assignee && <Pill tone="ink">→ {assignee.name}</Pill>}
                    {a?.burnoutRisk && <Pill tone="warn"><AlertTriangle size={9} style={{ display: "inline", verticalAlign: "middle" }} /> risk</Pill>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => setEditing(isOpen ? null : t.id)} style={btnGhost}>
                    {isOpen ? "close" : "edit"}
                  </button>
                  <button onClick={() => removeTask(t.id)} style={btnIcon}><X size={14}/></button>
                </div>
              </div>

              {a?.reasoning && !isOpen && (
                <div style={{ marginTop: 8, fontSize: 12, color: colors.inkSoft, fontStyle: "italic", fontFamily: "Fraunces, serif" }}>
                  "{a.reasoning}"
                </div>
              )}

              {isOpen && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${colors.rule}`, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                    <Slider value={t.urgency} onChange={(v) => update(st => { st.tasks.find(x => x.id === t.id).urgency = v; return st; })} min={1} max={5} color={colors.rustDeep} label="urgency" />
                    <Slider value={t.importance} onChange={(v) => update(st => { st.tasks.find(x => x.id === t.id).importance = v; return st; })} min={1} max={5} color={colors.teal} label="importance" />
                    <Slider value={t.effort} onChange={(v) => update(st => { st.tasks.find(x => x.id === t.id).effort = v; return st; })} min={1} max={5} color={colors.ochre} label="effort" />
                  </div>

                  {state.members.length > 0 && (
                    <div>
                      <div style={{ ...mutedLabel, marginBottom: 8 }}>PER-MEMBER FIT</div>
                      <div style={{ display: "grid", gap: 10 }}>
                        {state.members.map(m => {
                          const sc = t.scores[m.id] ?? { pleasure: 0, talent: 0 };
                          return (
                            <div key={m.id} style={{
                              display: "grid", gridTemplateColumns: "minmax(80px, 100px) 1fr 1fr", gap: 12, alignItems: "center",
                              padding: "8px 10px", background: "rgba(28,25,22,0.025)", borderRadius: 8,
                            }}>
                              <div style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                              <Slider value={sc.pleasure} onChange={(v) => update(st => { st.tasks.find(x => x.id === t.id).scores[m.id] = { ...sc, pleasure: v }; return st; })} min={-3} max={3} color={colors.rust} label={<span><Heart size={9} style={{display:"inline"}}/> pleasure</span>} />
                              <Slider value={sc.talent} onChange={(v) => update(st => { st.tasks.find(x => x.id === t.id).scores[m.id] = { ...sc, talent: v }; return st; })} min={-3} max={3} color={colors.teal} label={<span><Brain size={9} style={{display:"inline"}}/> talent</span>} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Insights View
// ─────────────────────────────────────────────────────────────────────────────

function InsightsView({ state, summary, assignments }) {
  const totalJoy = summary.reduce((s, x) => s + x.joyIndex, 0);
  const totalTalent = summary.reduce((s, x) => s + x.talentIndex, 0);
  const burnoutCount = summary.filter(s => s.burnout).length;
  const strainCount = summary.filter(s => s.strain).length;
  const unassigned = state.tasks.filter(t => quadrantOf(t) !== "ELIMINATE" && !assignments[t.id]).length;
  const eliminated = state.tasks.filter(t => quadrantOf(t) === "ELIMINATE").length;

  // Mismatched assignments (someone hates the task or is bad at it)
  const painPoints = state.tasks
    .map(t => {
      const a = assignments[t.id];
      if (!a) return null;
      const sc = t.scores[a.memberId];
      if (!sc) return null;
      if (sc.pleasure <= -2 || sc.talent <= -2) {
        const m = state.members.find(x => x.id === a.memberId);
        return { task: t, member: m, scores: sc };
      }
      return null;
    })
    .filter(Boolean);

  return (
    <div>
      <SectionHead
        eyebrow="04"
        title="The Reading"
        sub="What the assignment is costing you, and where it's working."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginTop: 16 }}>
        <BigStat icon={Heart} label="Total Joy Index" value={totalJoy > 0 ? `+${totalJoy}` : totalJoy} tone={totalJoy >= 0 ? "teal" : "rust"} />
        <BigStat icon={Brain} label="Total Talent Fit" value={totalTalent > 0 ? `+${totalTalent}` : totalTalent} />
        <BigStat icon={AlertTriangle} label="Burnout" value={burnoutCount} tone={burnoutCount > 0 ? "rust" : "ink"} />
        <BigStat icon={Zap} label="Stretched" value={strainCount} tone={strainCount > 0 ? "ochre" : "ink"} />
      </div>

      {/* per-person bars */}
      {summary.length > 0 && (
        <div style={{ ...card, marginTop: 18 }}>
          <div style={{ ...mutedLabel, marginBottom: 12 }}>JOY × LOAD PER PERSON</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {summary.map(s => {
              const loadPct = Math.min(140, (s.totalEffort / Math.max(s.budget, 1)) * 100);
              return (
                <div key={s.memberId}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                    <span style={{ fontFamily: "Fraunces, serif", fontWeight: 600 }}>{s.name}</span>
                    <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, color: colors.inkSoft }}>
                      load {s.totalEffort}/{s.budget.toFixed(1)} · joy {s.joyIndex > 0 ? "+" : ""}{s.joyIndex}
                    </span>
                  </div>
                  <div style={{ position: "relative", height: 10, background: "rgba(28,25,22,0.08)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{
                      width: Math.min(100, loadPct) + "%", height: "100%",
                      background: s.burnout ? colors.rustDeep : s.strain ? colors.ochre : colors.teal,
                      transition: "width 0.3s",
                    }} />
                    {loadPct > 100 && (
                      <div style={{
                        position: "absolute", left: "100%", top: 0, height: "100%",
                        width: (loadPct - 100) + "%", maxWidth: "40%",
                        background: `repeating-linear-gradient(45deg, ${colors.rustDeep}, ${colors.rustDeep} 4px, ${colors.rust} 4px, ${colors.rust} 8px)`,
                      }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pain points */}
      {painPoints.length > 0 && (
        <div style={{ ...card, marginTop: 14, borderColor: "rgba(184,73,42,0.3)" }}>
          <div style={{ ...mutedLabel, color: colors.rustDeep, marginBottom: 10 }}>PAIN POINTS — RECONSIDER</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {painPoints.map(p => (
              <div key={p.task.id} style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                <span style={{ fontFamily: "Fraunces, serif", fontWeight: 600 }}>{p.task.title}</span>{" "}
                <span style={{ color: colors.inkSoft }}>→ {p.member?.name}</span>
                <div style={{ fontSize: 12, color: colors.inkSoft, fontStyle: "italic", fontFamily: "Fraunces, serif" }}>
                  {p.scores.pleasure <= -2 && p.scores.talent <= -2
                    ? "they neither enjoy this nor are good at it. swap, train, or drop."
                    : p.scores.pleasure <= -2
                      ? "they're capable but it drains them. ok occasionally, not chronically."
                      : "they enjoy this but lack skill. ok if growth is the point."}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(unassigned > 0 || eliminated > 0) && (
        <div style={{ ...card, marginTop: 14 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {unassigned > 0 && (
              <div>
                <div style={mutedLabel}>UNASSIGNED</div>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 700 }}>{unassigned}</div>
                <div style={{ fontSize: 11, color: colors.inkSoft }}>add team members or capacity</div>
              </div>
            )}
            {eliminated > 0 && (
              <div>
                <div style={mutedLabel}>FLAGGED FOR ELIMINATION</div>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 700, color: colors.inkSoft }}>{eliminated}</div>
                <div style={{ fontSize: 11, color: colors.inkSoft }}>not urgent, not important — drop them</div>
              </div>
            )}
          </div>
        </div>
      )}

      <ProgressNarrative state={state} summary={summary} totalJoy={totalJoy} burnoutCount={burnoutCount} />
    </div>
  );
}

function ProgressNarrative({ state, summary, totalJoy, burnoutCount }) {
  if (state.tasks.length === 0 || state.members.length === 0) return null;
  let read = "";
  if (burnoutCount > 0) {
    read = "Stop. Someone is over capacity. You'll move slower, not faster, by pushing through. Reduce scope, eliminate the bottom-right quadrant, or add hands.";
  } else if (totalJoy < 0) {
    read = "You're getting things done, but the work is grinding people down. Look at the pain points below and see what you can swap, drop, or restructure.";
  } else if (totalJoy >= 0 && summary.every(s => !s.strain && !s.burnout)) {
    read = "Healthy state. Capacity is intact, joy is positive. This is the configuration you want — protect it as new tasks come in.";
  } else {
    read = "Workable. A few people are stretched, but no one is breaking. Watch for tasks accumulating in DO and DELEGATE.";
  }
  return (
    <div style={{
      marginTop: 18, padding: 18, borderRadius: 12,
      background: colors.bone, border: `1px dashed ${colors.rule}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Sparkles size={14} color={colors.rust} />
        <span style={mutedLabel}>THE READ</span>
      </div>
      <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontStyle: "italic", lineHeight: 1.45, color: colors.ink }}>
        {read}
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: colors.inkSoft, fontFamily: "Fraunces, serif" }}>
        Goal: from <em>{state.goal.from || "—"}</em> to <em>{state.goal.to || "—"}</em>.
      </div>
    </div>
  );
}

function BigStat({ icon: Icon, label, value, tone = "ink" }) {
  const tones = { ink: colors.ink, teal: colors.teal, rust: colors.rustDeep, ochre: colors.ochre };
  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: colors.inkSoft }}>
        <Icon size={12} />
        <span style={mutedLabel}>{label}</span>
      </div>
      <div style={{ fontFamily: "Fraunces, serif", fontWeight: 800, fontSize: 36, lineHeight: 1, marginTop: 6, color: tones[tone], letterSpacing: "-0.02em", fontStyle: "italic" }}>
        {value}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────────────────────

function SectionHead({ eyebrow, title, sub, action }) {
  return (
    <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", paddingBottom: 12, borderBottom: `1px solid ${colors.rule}` }}>
      <div>
        <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, letterSpacing: "0.18em", color: colors.rust }}>{eyebrow} ──</div>
        <h2 style={{ fontFamily: "Fraunces, serif", fontWeight: 700, fontStyle: "italic", fontSize: "clamp(28px, 5vw, 40px)", letterSpacing: "-0.02em", margin: "4px 0 4px" }}>{title}</h2>
        <div style={{ fontSize: 13, color: colors.inkSoft, fontFamily: "Fraunces, serif" }}>{sub}</div>
      </div>
      {action}
    </div>
  );
}

function Empty({ children }) {
  return (
    <div style={{
      marginTop: 24, padding: 32, textAlign: "center",
      border: `1px dashed ${colors.rule}`, borderRadius: 12,
      fontFamily: "Fraunces, serif", fontStyle: "italic", color: colors.inkSoft,
    }}>{children}</div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const card = {
  padding: 16, borderRadius: 12,
  background: colors.bone, border: `1px solid ${colors.rule}`,
};

const mutedLabel = {
  fontFamily: "Geist Mono, monospace", fontSize: 10,
  letterSpacing: "0.12em", textTransform: "uppercase", color: colors.inkSoft,
};

const inputBare = {
  width: "100%", border: "none", background: "transparent", outline: "none",
  color: colors.ink, fontFamily: "Geist, sans-serif", fontSize: 15, padding: "4px 0",
};

const tabBtn = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "7px 12px", borderRadius: 999,
  background: "transparent", border: `1px solid transparent`,
  fontFamily: "Geist Mono, monospace", fontSize: 11, letterSpacing: "0.06em",
  color: colors.inkSoft, cursor: "pointer", textTransform: "uppercase",
  whiteSpace: "nowrap",
};
const tabBtnActive = {
  background: colors.ink, color: colors.paper, borderColor: colors.ink,
};

const btnGhost = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "5px 10px", borderRadius: 999,
  background: "transparent", border: `1px solid ${colors.rule}`,
  fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: "0.06em",
  color: colors.inkSoft, cursor: "pointer", textTransform: "uppercase",
};

const btnPrimary = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "8px 14px", borderRadius: 999,
  background: colors.ink, color: colors.paper, border: "none",
  fontFamily: "Geist Mono, monospace", fontSize: 11, letterSpacing: "0.06em",
  cursor: "pointer", textTransform: "uppercase",
};

const btnIcon = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 26, height: 26, borderRadius: 999,
  background: "transparent", border: `1px solid ${colors.rule}`,
  color: colors.inkSoft, cursor: "pointer",
};

const warnBox = {
  marginTop: 10, padding: "8px 10px", borderRadius: 8,
  background: "rgba(184,73,42,0.10)", border: `1px solid rgba(184,73,42,0.3)`,
  color: colors.rustDeep, fontSize: 12, fontFamily: "Fraunces, serif",
  display: "flex", alignItems: "center", gap: 6,
};
