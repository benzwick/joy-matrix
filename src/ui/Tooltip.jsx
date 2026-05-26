// Hover/focus tooltip that pairs a short description with a deep link into
// the documentation page (/docs/#anchor). Wrap any control:
//
//   <Tooltip topic="tab-matrix"><button …/></Tooltip>
//
// The wrapper is inline-flex so it drops into the app's existing flex
// toolbars/tab bars without changing layout. The native `title` on the
// inner control is kept as a no-JS / touch fallback.

import React, { useState, useId } from "react";
import { colors, card, mutedLabel } from "./theme.jsx";

// Docs live at a sibling page. BASE_URL is "/" in this deployment, so this
// resolves to "/docs/#anchor"; it stays correct if the Vite base changes.
export function docsLink(anchor) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}docs/#${anchor}`;
}

// One place for tooltip copy + which doc section each control points at.
// `anchor` values MUST match the section ids rendered by src/docs/DocsApp.jsx.
export const DOC_TOPICS = {
  // Tabs
  "tab-matrix":   { text: "Urgency × importance grid. Tasks auto-assign to the best-fit person per quadrant.", anchor: "matrix" },
  "tab-team":     { text: "People, their current capacity, and per-category pleasure/talent baselines.", anchor: "team" },
  "tab-tasks":    { text: "Score each task's urgency, importance, effort, and per-person fit.", anchor: "tasks" },
  "tab-schedule": { text: "Auto-place tasks into real time using availability and energy windows.", anchor: "schedule" },
  "tab-insights": { text: "Joy, talent, load, burnout risk, pain points, and the weekly read.", anchor: "insights" },

  // Header controls
  "ctl-theme":     { text: "Toggle light / dark mode. Your choice is remembered.", anchor: "themes" },
  "ctl-customize": { text: "Switch theme presets, recolor the five accent slots, and pick fonts.", anchor: "themes" },
  "ctl-import":    { text: "Load a project from a Joy-Matrix JSON export or a CSV of tasks.", anchor: "import-export" },
  "ctl-export":    { text: "Download the whole project as a versioned JSON file.", anchor: "import-export" },
  "ctl-demo":      { text: "Replace everything with the built-in demo project.", anchor: "import-export" },
  "ctl-clear":     { text: "Wipe the project back to an empty slate.", anchor: "import-export" },

  // Primary actions
  "act-add-member":      { text: "Add a teammate, then set their capacity and baselines.", anchor: "team" },
  "act-add-task":        { text: "Add a task, then score its urgency, importance, effort, and fit.", anchor: "tasks" },
  "act-add-category":    { text: "Group tasks into a category to auto-fill per-person baselines.", anchor: "tasks" },
  "act-add-stakeholder": { text: "Tag who a task is for.", anchor: "tasks" },

  // Schedule controls
  "sched-view": { text: "Switch between day, week, month, and year views of the schedule.", anchor: "schedule" },
};

export default function Tooltip({ topic, text, anchor, align = "start", children, wrapperStyle }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const t = topic ? DOC_TOPICS[topic] : null;
  const body = text ?? t?.text;
  const target = anchor ?? t?.anchor;
  if (!body) return children;

  return (
    <span
      style={{ position: "relative", display: "inline-flex", ...wrapperStyle }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
      onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
    >
      {React.isValidElement(children)
        ? React.cloneElement(children, { "aria-describedby": open ? id : undefined })
        : children}
      {open && (
        <span
          role="tooltip"
          id={id}
          style={{
            ...card,
            position: "absolute",
            top: "100%",
            [align === "end" ? "right" : "left"]: 0,
            marginTop: 6,
            width: 230,
            zIndex: 60,
            padding: "10px 12px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
            cursor: "default",
            textTransform: "none",
            letterSpacing: "normal",
          }}
        >
          <span style={{
            display: "block",
            fontFamily: "var(--joy-font-body)", fontSize: 12.5, lineHeight: 1.4,
            color: colors.ink,
          }}>
            {body}
          </span>
          {target && (
            <a
              href={docsLink(target)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...mutedLabel,
                display: "inline-block", marginTop: 8,
                color: colors.teal, textDecoration: "none",
              }}
            >
              Learn more →
            </a>
          )}
        </span>
      )}
    </span>
  );
}
