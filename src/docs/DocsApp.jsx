import React, { useState, useEffect } from "react";
import {
  Sun, Moon, ArrowLeft, Heart, Brain, Battery, Zap, AlertTriangle,
  Grid3x3, Users, ListTodo, Calendar, Activity, Sparkles, Target,
} from "lucide-react";
import {
  colors, card, mutedLabel, btnGhost, SectionHead, Pill, useViewportWidth, useTheme,
} from "../ui/theme.jsx";

const BASE = import.meta.env.BASE_URL || "/";
const shot = (name) => `${BASE}screenshots/${name}.png`;

// Order matches the on-page sections; ids double as scroll anchors and as
// the link targets used by the in-app tooltips (see src/ui/Tooltip.jsx).
const TOC = [
  ["overview", "Overview"],
  ["philosophy", "Philosophy & origin"],
  ["concepts", "Core concepts"],
  ["goal", "Goal bar & controls"],
  ["matrix", "The Matrix tab"],
  ["team", "The Team tab"],
  ["tasks", "The Tasks tab"],
  ["schedule", "The Schedule tab"],
  ["insights", "The Insights tab"],
  ["assignment-algorithm", "Assignment algorithm"],
  ["scheduling-algorithm", "Scheduling algorithm"],
  ["themes", "Themes & fonts"],
  ["import-export", "Data & portability"],
  ["assistant", "Talk2View assistant"],
];

export default function DocsApp() {
  const isPhone = useViewportWidth() < 760;

  // The page renders client-side, so the browser's native hash scroll on load
  // finds no target yet. Re-run it once React has mounted the sections, and on
  // any later hashchange (e.g. the in-app tooltip "Learn more →" deep links).
  useEffect(() => {
    const scrollToHash = () => {
      const id = decodeURIComponent((window.location.hash || "").slice(1));
      if (!id) return;
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    };
    const raf = requestAnimationFrame(scrollToHash);
    window.addEventListener("hashchange", scrollToHash);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("hashchange", scrollToHash);
    };
  }, []);

  return (
    <div style={{
      minHeight: "100vh", background: colors.paper, color: colors.ink,
      fontFamily: "var(--joy-font-body)",
      backgroundImage: "radial-gradient(circle at 20% 0%, rgba(184,73,42,0.06), transparent 50%), radial-gradient(circle at 80% 100%, rgba(42,93,93,0.05), transparent 50%)",
    }}>
      <TopBar />

      <div style={{
        maxWidth: 1180, margin: "0 auto", padding: isPhone ? "8px 16px 80px" : "8px 24px 100px",
        display: "grid",
        gridTemplateColumns: isPhone ? "1fr" : "230px 1fr",
        gap: isPhone ? 16 : 40,
        alignItems: "start",
      }}>
        <Toc isPhone={isPhone} />
        <main style={{ minWidth: 0, maxWidth: 760 }}>
          <Hero />
          <Overview />
          <Philosophy />
          <Concepts />
          <GoalAndControls />
          <MatrixTab />
          <TeamTab />
          <TasksTab />
          <ScheduleTab />
          <InsightsTab />
          <AssignmentAlgorithm />
          <SchedulingAlgorithm />
          <Themes />
          <DataPortability />
          <Assistant />
          <Footer />
        </main>
      </div>
    </div>
  );
}

// ───────────────────────────── chrome ─────────────────────────────

function TopBar() {
  const { theme, setTheme } = useTheme();
  const isDark = theme.mode === "dark";
  const toggle = () => setTheme((t) => ({ ...t, mode: t.mode === "dark" ? "light" : "dark" }));
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 20,
      background: `color-mix(in srgb, ${colors.paper} 92%, transparent)`,
      backdropFilter: "blur(8px)",
      borderBottom: `1px solid ${colors.rule}`,
    }}>
      <div style={{
        maxWidth: 1180, margin: "0 auto", padding: "12px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <a href={BASE} style={{ ...btnGhost, textDecoration: "none" }}>
          <ArrowLeft size={12} /> back to the app
        </a>
        <div style={{ fontFamily: "var(--joy-font-mono)", fontSize: 11, letterSpacing: "0.18em", color: colors.inkSoft }}>
          THE JOY MATRIX · DOCS
        </div>
        <button onClick={toggle} style={btnGhost} aria-label="Toggle light/dark">
          {isDark ? <Sun size={12} /> : <Moon size={12} />} {isDark ? "light" : "dark"}
        </button>
      </div>
    </header>
  );
}

function Toc({ isPhone }) {
  return (
    <nav style={{
      position: isPhone ? "static" : "sticky", top: 70,
      ...(isPhone ? { ...card, padding: 14 } : {}),
    }}>
      <div style={{ ...mutedLabel, marginBottom: 10 }}>Contents</div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 7, counterReset: "toc" }}>
        {TOC.map(([id, label]) => (
          <li key={id} style={{ counterIncrement: "toc" }}>
            <a href={`#${id}`} style={{
              color: colors.inkSoft, textDecoration: "none",
              fontSize: 13, lineHeight: 1.3,
              display: "flex", gap: 8,
            }}>
              <span style={{ fontFamily: "var(--joy-font-mono)", fontSize: 10, color: colors.rust, minWidth: 16 }}>
                {String(TOC.findIndex(([x]) => x === id) + 1).padStart(2, "0")}
              </span>
              <span>{label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Hero() {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontFamily: "var(--joy-font-mono)", fontSize: 11, letterSpacing: "0.18em", color: colors.rust }}>
        THE FIELD GUIDE
      </div>
      <h1 style={{
        fontFamily: "var(--joy-font-head)", fontWeight: 900, fontStyle: "italic",
        fontSize: "clamp(34px, 6vw, 56px)", lineHeight: 0.98, letterSpacing: "-0.02em",
        margin: "8px 0 10px",
      }}>
        Everything the Joy Matrix does
      </h1>
      <p style={{ fontSize: 16, lineHeight: 1.6, color: colors.inkSoft, margin: 0, maxWidth: 620 }}>
        A complete tour of the app — the matrix, the team model, task scoring,
        the auto-scheduler, the insights, and the two algorithms underneath it
        all. Every screenshot on this page is regenerated automatically from the
        live app on each deploy, so it never drifts out of date.
      </p>
    </div>
  );
}

// ───────────────────────────── building blocks ─────────────────────────────

function Section({ id, eyebrow, title, sub, children }) {
  return (
    <section id={id} style={{ scrollMarginTop: 80, marginBottom: 56 }}>
      <SectionHead eyebrow={eyebrow} title={title} sub={sub} />
      <div style={{ marginTop: 18, fontSize: 15.5, lineHeight: 1.68 }}>
        {children}
      </div>
    </section>
  );
}

function P({ children }) {
  return <p style={{ margin: "0 0 14px" }}>{children}</p>;
}

function Lead({ children }) {
  return <p style={{ margin: "0 0 16px", fontSize: 17, lineHeight: 1.6, color: colors.ink }}>{children}</p>;
}

function H3({ children }) {
  return (
    <h3 style={{
      fontFamily: "var(--joy-font-head)", fontWeight: 700, fontStyle: "italic",
      fontSize: 21, letterSpacing: "-0.01em", margin: "26px 0 10px",
    }}>{children}</h3>
  );
}

function Bullets({ items }) {
  return (
    <ul style={{ margin: "0 0 14px", paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ color: colors.rust, marginTop: 8, flexShrink: 0, width: 6, height: 6, borderRadius: 999, background: colors.rust }} />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Note({ children, tone = "teal" }) {
  const accent = tone === "rust" ? colors.rust : tone === "ochre" ? colors.ochre : colors.teal;
  return (
    <div style={{
      ...card, borderLeft: `3px solid ${accent}`,
      margin: "0 0 16px", fontSize: 14.5, lineHeight: 1.6,
      display: "flex", gap: 10, alignItems: "flex-start",
    }}>
      <Sparkles size={15} color={accent} style={{ marginTop: 3, flexShrink: 0 }} />
      <div>{children}</div>
    </div>
  );
}

function Term({ name, children, icon: Icon, color = colors.teal }) {
  return (
    <div style={{ ...card, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        {Icon && <Icon size={15} color={color} />}
        <span style={{ fontFamily: "var(--joy-font-head)", fontWeight: 700, fontSize: 16 }}>{name}</span>
      </div>
      <div style={{ fontSize: 14.5, lineHeight: 1.55, color: colors.inkSoft }}>{children}</div>
    </div>
  );
}

function Code({ children }) {
  return (
    <code style={{
      fontFamily: "var(--joy-font-mono)", fontSize: 12.5,
      background: colors.paperDeep, border: `1px solid ${colors.rule}`,
      padding: "1px 6px", borderRadius: 5, whiteSpace: "nowrap",
    }}>{children}</code>
  );
}

function Figure({ name, caption, alt }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure style={{ margin: "4px 0 20px" }}>
      {failed ? (
        <div style={{
          ...card, padding: "26px 16px", textAlign: "center",
          color: colors.inkSoft, fontFamily: "var(--joy-font-mono)", fontSize: 11,
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          screenshot generated on deploy
        </div>
      ) : (
        <img
          src={shot(name)}
          alt={alt || caption}
          loading="lazy"
          onError={() => setFailed(true)}
          style={{
            width: "100%", display: "block", borderRadius: 12,
            border: `1px solid ${colors.rule}`, boxShadow: "0 8px 30px rgba(0,0,0,0.10)",
          }}
        />
      )}
      {caption && (
        <figcaption style={{ ...mutedLabel, textTransform: "none", letterSpacing: "normal", fontSize: 12, marginTop: 8, textAlign: "center" }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

// ───────────────────────────── sections ─────────────────────────────

function Overview() {
  return (
    <Section id="overview" eyebrow="01" title="Overview"
      sub="What the Joy Matrix is and the problem it solves.">
      <Lead>
        The Joy Matrix is a multidimensional extension of the classic
        Eisenhower Matrix, built for small teams. It sorts tasks by{" "}
        <strong>urgency × importance</strong>, then goes a step further: it
        scores how each task lands on each person across three human
        dimensions — <strong>pleasure</strong>, <strong>talent</strong>, and{" "}
        <strong>capacity</strong> — and auto-assigns the work to move from where
        you are (A) to where you want to be (B) as fast as possible{" "}
        <em>without burning anyone out</em>.
      </Lead>
      <Figure name="header" caption="The app header: your A → B goal and the global controls." />
      <P>
        It runs entirely in your browser. There is no account, no server, and no
        tracking — your project lives in <Code>localStorage</Code> and can be
        exported to a single JSON file at any time. The whole app is five tabs:
      </P>
      <Bullets items={[
        <><strong>Matrix</strong> — the urgency/importance grid with auto-assignments.</>,
        <><strong>Team</strong> — your people, their capacity, and their strengths.</>,
        <><strong>Tasks</strong> — scoring each task and each person's fit for it.</>,
        <><strong>Schedule</strong> — tasks placed into real time on a calendar.</>,
        <><strong>Insights</strong> — joy, load, burnout risk, and a plain-language read.</>,
      ]} />
    </Section>
  );
}

function Philosophy() {
  return (
    <Section id="philosophy" eyebrow="02" title="Philosophy & origin"
      sub="Where the idea came from, and the principle it's built on.">
      <Lead>
        The method started on a whiteboard. While running internal projects at{" "}
        <strong>Talk2View Pty&nbsp;Ltd</strong>, the team kept reaching for the
        Eisenhower Matrix to triage work — drawing the four quadrants on paper or
        a whiteboard and dropping tasks into them.
      </Lead>
      <P>
        It worked for deciding <em>what</em> mattered, but it kept missing{" "}
        <em>who</em> should do it. Two tasks could sit in the same quadrant and
        still be a great fit for one person and a slow, joyless grind for
        another. The matrix had no opinion about that — so the whiteboard
        version kept growing little annotations next to each task: who'd enjoy
        it, who was actually good at it, and who had any room left that week.
      </P>
      <P>
        The Joy Matrix is that whiteboard, formalised. Urgency and importance
        decide what to do and in what order; pleasure, talent, and capacity
        decide who it should land on. The guiding principle is{" "}
        <strong>sustainable speed</strong>: the fastest route from A to B is the
        one that doesn't quietly destroy the people walking it.
      </P>
      <Note>
        Capacity is treated as a <strong>ceiling, not a target</strong>. The goal
        is never to fill everyone to the brim — it's to get from A to B while
        keeping the team intact for whatever comes after B.
      </Note>
    </Section>
  );
}

function Concepts() {
  return (
    <Section id="concepts" eyebrow="03" title="Core concepts"
      sub="The five dimensions and the four quadrants.">
      <H3>The four quadrants</H3>
      <P>
        Every task is placed by two 1–5 sliders. A task is{" "}
        <strong>urgent</strong> when urgency ≥ 3 and <strong>important</strong>{" "}
        when importance ≥ 3. That yields the familiar grid:
      </P>
      <QuadrantGrid />
      <P>
        The small numbers (1–4) shown in the app are a <strong>workflow
        order</strong>, not grid positions: delegate first so others can start in
        parallel, then do your own urgent work, then invest in the
        important-but-not-urgent quadrant, and finally drop the residue.
      </P>

      <H3>The five dimensions</H3>
      <Term name="Urgency (1–5)" icon={Zap} color={colors.rust}>
        How soon this needs to happen. Drives the horizontal split of the matrix.
      </Term>
      <Term name="Importance (1–5)" icon={Target} color={colors.teal}>
        How much it matters to the goal. Drives the vertical split of the matrix.
      </Term>
      <Term name="Effort (1–5)" icon={Activity} color={colors.ochre}>
        Relative load units the task consumes from a person's weekly budget. Also
        sets how much calendar time the scheduler reserves for it.
      </Term>
      <Term name="Pleasure (−3…+3)" icon={Heart} color={colors.rust}>
        Per person, per task: how much they enjoy this kind of work. Negative
        means it drains them.
      </Term>
      <Term name="Talent (−3…+3)" icon={Brain} color={colors.teal}>
        Per person, per task: how good they are at it. Negative means it's a
        stretch.
      </Term>
      <Term name="Capacity (−3…+3)" icon={Battery} color={colors.teal}>
        Per person: their current bandwidth this week — not a fixed trait. It
        changes week to week and becomes their effort budget.
      </Term>
      <Note tone="ochre">
        Pleasure and talent are scored <strong>per (person, task)</strong>, so the
        same task can be a joy for one teammate and a slog for another. Tasks can
        also carry a <strong>difficulty</strong> (1–5) used by the scheduler to
        match hard work to high-concentration hours.
      </Note>
    </Section>
  );
}

function QuadrantGrid() {
  const cells = [
    { label: "DO", sub: "urgent · important", color: colors.rustDeep, n: 2 },
    { label: "SCHEDULE", sub: "important · not urgent", color: colors.teal, n: 3 },
    { label: "DELEGATE", sub: "urgent · not important", color: colors.ochre, n: 1 },
    { label: "ELIMINATE", sub: "neither — drop", color: colors.inkSoft, n: 4 },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "4px 0 16px" }}>
      {cells.map((c) => (
        <div key={c.label} style={{ ...card, borderTop: `3px solid ${c.color}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontFamily: "var(--joy-font-head)", fontWeight: 800, fontStyle: "italic", fontSize: 18, color: c.color }}>{c.label}</span>
            <span style={{ fontFamily: "var(--joy-font-mono)", fontSize: 11, color: colors.inkSoft }}>{String(c.n).padStart(2, "0")}</span>
          </div>
          <div style={{ ...mutedLabel, marginTop: 2 }}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

function GoalAndControls() {
  return (
    <Section id="goal" eyebrow="04" title="Goal bar & controls"
      sub="The A → B framing and the buttons in the header.">
      <P>
        At the top sits your goal, framed as a journey from <strong>A</strong>{" "}
        (where you are now) to <strong>B</strong> (where you want to be). It's
        free text and it feeds the closing narrative on the Insights tab, so it's
        worth writing honestly.
      </P>
      <H3>Header controls</H3>
      <Bullets items={[
        <><strong>light / dark</strong> — flip the colour mode; your choice is remembered.</>,
        <><strong>customize</strong> — open the panel to change theme preset, accent colours, and fonts.</>,
        <><strong>import</strong> — load a project from a Joy-Matrix JSON export <em>or</em> a CSV of tasks.</>,
        <><strong>export</strong> — download the whole project as a versioned JSON file.</>,
        <><strong>demo</strong> — replace everything with the built-in demo project.</>,
        <><strong>clear</strong> — wipe back to an empty slate.</>,
      ]} />
      <Note>
        Hover any button in the app to see a short tooltip with a{" "}
        <strong>Learn more →</strong> link that jumps straight to the matching
        section of this guide.
      </Note>
    </Section>
  );
}

function MatrixTab() {
  return (
    <Section id="matrix" eyebrow="05" title="The Matrix tab"
      sub="Tasks placed by urgency × importance, then auto-assigned.">
      <Figure name="matrix" caption="The matrix grid with auto-assigned owners and risk flags." />
      <P>
        Each quadrant lists the tasks that fall into it. Every task shows its
        auto-assigned owner (<Code>→ name</Code>), a <strong>FOR</strong> tag if
        it's tied to a stakeholder, and its <Code>U</Code>/<Code>I</Code>/<Code>E</Code>{" "}
        mini-stats. If the assigned person is over capacity, a{" "}
        <Pill tone="warn">⚠ risk</Pill> badge appears.
      </P>
      <P>
        Tap any task to jump to its editor on the Tasks tab. The{" "}
        <strong>more</strong> toggle opens a legend that explains the workflow
        order and the reasoning behind each quadrant. ELIMINATE tasks are listed
        but never assigned — they're candidates to drop.
      </P>
    </Section>
  );
}

function TeamTab() {
  return (
    <Section id="team" eyebrow="06" title="The Team tab"
      sub="Capacity is current bandwidth, not a fixed trait.">
      <Figure name="team" caption="Member cards with capacity, baselines, and live load stats." />
      <P>
        Add a teammate with <strong>+ add member</strong>. Each card has:
      </P>
      <Bullets items={[
        <><strong>Capacity</strong> slider (−3…+3) — sets the weekly effort budget. The label translates it into plain words, from "overloaded" to "lots of bandwidth".</>,
        <><strong>Category baselines</strong> — for each category, a default pleasure and talent score that auto-fills new tasks in that category (still overridable per task).</>,
        <><strong>Live stats</strong> — once they have work assigned: task count, load vs budget, a joy index, and a talent-fit index.</>,
        <><strong>Burnout / strain warnings</strong> — flagged when assigned effort pushes them past their budget.</>,
      ]} />
      <Figure name="team-baselines" caption="Per-category pleasure & talent baselines, expanded." />
      <P>
        Budget is derived from capacity: <Code>budget = max(0.5, 4 + capacity)</Code>{" "}
        effort units — so −3 ≈ 1 unit, 0 ≈ 4 units, +3 ≈ 7 units.
      </P>
    </Section>
  );
}

function TasksTab() {
  return (
    <Section id="tasks" eyebrow="07" title="The Tasks tab"
      sub="Score each task, and each person's fit for it.">
      <Figure name="tasks" caption="The task list with quadrant pills and assigned owners." />
      <P>
        <strong>+ add task</strong> creates a task; click it to open the editor.
        Above the list you can manage <strong>categories</strong> (groupings that
        drive baseline auto-fill) and <strong>stakeholders</strong> (who a task is
        for).
      </P>
      <Figure name="tasks-editor" caption="A task expanded: U/I/E sliders and per-member fit." />
      <P>The editor has three parts:</P>
      <Bullets items={[
        <><strong>Category & stakeholder</strong> — choosing a category re-seeds any per-member scores you haven't manually touched.</>,
        <><strong>Urgency / Importance / Effort</strong> — three 1–5 sliders that place the task in the matrix and size its schedule footprint.</>,
        <><strong>Per-member fit</strong> — a pleasure and talent slider for each teammate. Scores auto-filled from a category baseline are replaced the moment you drag them.</>,
      ]} />
    </Section>
  );
}

function ScheduleTab() {
  return (
    <Section id="schedule" eyebrow="08" title="The Schedule tab"
      sub="Tasks placed into real time, matched to availability and energy.">
      <P>
        The scheduler takes the assignments and lays them onto a rolling 7-day
        calendar in 30-minute blocks, respecting each person's availability
        windows and their per-time-of-day energy and concentration. Switch
        between four views with the day / week / month / year buttons.
      </P>
      <Figure name="schedule-week" caption="Week view: per-member swimlanes across seven days." />
      <Bullets items={[
        <><strong>Week</strong> — one swimlane per person across the seven days, with total hours.</>,
        <><strong>Day</strong> — an hour-by-hour grid; step through days with prev/next.</>,
        <><strong>Month</strong> — a calendar with scheduled hours and block counts per day.</>,
        <><strong>Year</strong> — a heatmap of scheduled load across the whole year.</>,
      ]} />
      <Figure name="schedule-day" caption="Day view: half-hour blocks per member, hour by hour." />
      <P>
        Inputs the scheduler reads, all set elsewhere: a member's{" "}
        <strong>availability</strong> (per-day time windows), their{" "}
        <strong>energy &amp; concentration</strong> windows (morning / midday /
        afternoon / evening), a task's <strong>due date</strong> (an exact date or
        a fuzzy label like <Code>this-week</Code>), and its{" "}
        <strong>difficulty</strong>. If a task can't fit before its deadline it's
        surfaced in a <strong>Conflicts</strong> list with the reason.
      </P>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Figure name="schedule-month" caption="Month view." />
        <Figure name="schedule-year" caption="Year heatmap." />
      </div>
    </Section>
  );
}

function InsightsTab() {
  return (
    <Section id="insights" eyebrow="09" title="The Insights tab"
      sub="What the assignment is costing you, and where it's working.">
      <Figure name="insights" caption="Headline stats, per-person load × joy, pain points, and the read." />
      <Bullets items={[
        <><strong>Headline stats</strong> — total joy index, total talent fit, and counts of people who are burnt out or stretched.</>,
        <><strong>Joy × load per person</strong> — a bar per teammate showing utilisation against budget; overflow past 100% is striped.</>,
        <><strong>Pain points</strong> — assignments where someone neither enjoys nor is good at the work, with a suggestion (swap, train, or drop).</>,
        <><strong>This week's schedule</strong> — scheduled vs idle hours per person, flagged when over budget.</>,
        <><strong>The read</strong> — a plain-language summary of project health, ending with your A → B goal.</>,
      ]} />
      <Note tone="rust">
        The joy index is <Code>Σ pleasure × effort</Code> and the talent index is{" "}
        <Code>Σ talent × effort</Code> across each person's assigned tasks — so a
        big draining task hurts the score more than a small one.
      </Note>
    </Section>
  );
}

function AssignmentAlgorithm() {
  return (
    <Section id="assignment-algorithm" eyebrow="10" title="Assignment algorithm"
      sub="How tasks get matched to people.">
      <P>
        Assignment is greedy. Tasks are processed in priority order (by quadrant,
        then by urgency × importance), and each is given to the best-fit person
        available, depleting that person's budget as it goes. ELIMINATE tasks are
        never assigned.
      </P>
      <H3>The fit score</H3>
      <P>For each candidate the app computes:</P>
      <div style={{ ...card, fontFamily: "var(--joy-font-mono)", fontSize: 12.5, lineHeight: 1.7, marginBottom: 14, whiteSpace: "pre-wrap" }}>
{`score = w.talent   × talent
      + w.pleasure × pleasure
      + w.capacity × (remaining ÷ budget × 3)
      − overshoot × 1.2`}
      </div>
      <P>
        The quadrant decides the weights, so the same person can be the right
        pick for one quadrant and the wrong pick for another:
      </P>
      <WeightsTable />
      <Bullets items={[
        <><strong>DO</strong> leans on talent — get urgent, important work to whoever's best at it.</>,
        <><strong>SCHEDULE</strong> leans on pleasure — strategic work goes to whoever it energises.</>,
        <><strong>DELEGATE</strong> leans on capacity — hand off to whoever has room.</>,
      ]} />
      <P>
        The <Code>overshoot × 1.2</Code> term penalises pushing someone past
        their budget. A person is flagged <strong>strained</strong> once their
        remaining budget goes negative, and at <strong>burnout risk</strong> once
        it drops below −1.5.
      </P>
    </Section>
  );
}

function WeightsTable() {
  const rows = [
    ["DO", "0.50", "0.20", "0.30", colors.rustDeep],
    ["SCHEDULE", "0.30", "0.50", "0.20", colors.teal],
    ["DELEGATE", "0.20", "0.30", "0.50", colors.ochre],
  ];
  const th = { ...mutedLabel, padding: "6px 10px", textAlign: "left" };
  const td = { padding: "8px 10px", fontFamily: "var(--joy-font-mono)", fontSize: 13, borderTop: `1px solid ${colors.rule}` };
  return (
    <div style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 14 }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={th}>Quadrant</th>
            <th style={th}>Talent</th>
            <th style={th}>Pleasure</th>
            <th style={th}>Capacity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([q, t, p, c, col]) => (
            <tr key={q}>
              <td style={{ ...td, fontFamily: "var(--joy-font-head)", fontWeight: 700, fontStyle: "italic", color: col }}>{q}</td>
              <td style={td}>{t}</td>
              <td style={td}>{p}</td>
              <td style={td}>{c}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SchedulingAlgorithm() {
  return (
    <Section id="scheduling-algorithm" eyebrow="11" title="Scheduling algorithm"
      sub="How assignments become calendar blocks.">
      <P>
        Tasks with a hard deadline are placed first (earliest deadline wins),
        then everything else by the same quadrant priority. For each task the
        scheduler reserves <Code>ceil(effort × 1.5 × 2)</Code> half-hour slots —
        roughly 1.5 hours of calendar time per effort unit.
      </P>
      <H3>How a slot is scored</H3>
      <P>
        It collects every free 30-minute slot inside the owner's availability
        before the deadline, scores each one, and takes the best, then orders
        them earliest-first:
      </P>
      <div style={{ ...card, fontFamily: "var(--joy-font-mono)", fontSize: 12.5, lineHeight: 1.7, marginBottom: 14, whiteSpace: "pre-wrap" }}>
{`slot = −|effort − energy|     × 2   (match heavy work to high-energy hours)
     − |difficulty − focus| × 2   (match hard work to high-focus hours)
     + pleasure × 0.5
     + talent   × 0.3`}
      </div>
      <P>
        Energy and concentration are set on a 1–3 scale per time-of-day and
        mapped onto the 1–5 effort/difficulty scale (1→1, 2→3, 3→5) so they
        compare cleanly. Availability windows, the deadline, and one-use-per-slot
        capacity are <strong>hard</strong> constraints; the four terms above are{" "}
        <strong>soft</strong> objectives. When the free slots run out before the
        required amount is placed, the task lands in <strong>Conflicts</strong>.
      </P>
    </Section>
  );
}

function Themes() {
  return (
    <Section id="themes" eyebrow="12" title="Themes & fonts"
      sub="Make it yours without leaving the page.">
      <Figure name="customize" caption="The customize panel: presets, accent colours, and font pickers." />
      <P>
        The app ships with two presets — <strong>Talk2View</strong> and{" "}
        <strong>Workbook</strong> — each with a light and dark palette. The{" "}
        <strong>customize</strong> panel lets you switch preset and mode, recolour
        five accent slots (paper, ink, rust, teal, ochre), and choose heading,
        body, and monospace fonts from a curated list (loaded on demand from
        Google Fonts). Reset buttons restore the preset's colours or fonts. This
        very documentation page uses the same theme system, so whatever you pick
        carries across.
      </P>
    </Section>
  );
}

function DataPortability() {
  return (
    <Section id="import-export" eyebrow="13" title="Data & portability"
      sub="Your project, your file, your browser.">
      <P>
        Everything is stored locally under the key{" "}
        <Code>joy-matrix-state-v1</Code>. Nothing is sent anywhere. Two ways in
        and one way out:
      </P>
      <Bullets items={[
        <><strong>Export</strong> — downloads a versioned JSON envelope (<Code>joy-matrix-YYYY-MM-DD.json</Code>) containing the whole project. Round-trippable.</>,
        <><strong>Import JSON</strong> — load a previous export back in (it migrates older schema versions forward automatically).</>,
        <><strong>Import CSV</strong> — drop in a task export from another tool; a mapping dialog opens.</>,
      ]} />
      <Figure name="csv-import" caption="The CSV import dialog: column mapping, options, and a preview." />
      <P>
        The CSV importer auto-detects columns, lets you remap them, optionally
        creates any referenced members / categories / stakeholders, previews the
        first few drafted tasks, and can either append to or replace your current
        tasks. Most project tools (Linear, Jira, Asana, Trello, Notion, …) export
        a compatible CSV directly.
      </P>
      <Note>
        The Joy Matrix is released to the public domain under{" "}
        <strong>Creative Commons Zero (CC0&nbsp;1.0)</strong>. Use it, fork it,
        ship it — no attribution required.
      </Note>
    </Section>
  );
}

function Assistant() {
  return (
    <Section id="assistant" eyebrow="14" title="Talk2View assistant"
      sub="Drive the whole app by chatting.">
      <P>
        A conversational assistant (powered by the Talk2View SDK) sits in the
        bottom-right corner. It can answer questions about your project —
        "who's at burnout risk?", "show me everyone's load", "what do the four
        quadrants mean?" — and it can act: add members and tasks, set capacity
        and scores, switch tabs, change the theme, and export the project. Edits
        that change your data ask for confirmation first.
      </P>
    </Section>
  );
}

function Footer() {
  return (
    <footer style={{
      marginTop: 24, paddingTop: 20, borderTop: `1px solid ${colors.rule}`,
      fontFamily: "var(--joy-font-mono)", fontSize: 10, color: colors.inkSoft,
      letterSpacing: "0.08em", display: "flex", flexDirection: "column", gap: 8, alignItems: "center",
    }}>
      <div>─── designed for sustainable speed ───</div>
      <a href={BASE} style={{ ...btnGhost, textDecoration: "none" }}>
        <ArrowLeft size={11} /> back to the app
      </a>
      <div>© 2026 Benny Zwick. Copyright waived under the Creative Commons Zero (CC0) License.</div>
    </footer>
  );
}
