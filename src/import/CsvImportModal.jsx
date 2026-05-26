// Interactive CSV importer. The header "import" button accepts both
// .json (existing flow) and .csv. On a CSV, this modal opens — the
// user remaps any auto-detected columns that don't look right,
// decides whether to create new members / categories / stakeholders
// referenced in the file, previews up to five drafted tasks, and
// commits or cancels.

import React, { useMemo, useState } from "react";
import { X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { parseCsv } from "./csv";
import { FIELDS, autoDetect, buildDrafts } from "./mapping";

const COLORS = {
  paper: "var(--joy-paper)",
  paperDeep: "var(--joy-paper-deep)",
  ink: "var(--joy-ink)",
  inkSoft: "var(--joy-ink-soft)",
  rule: "var(--joy-rule)",
  teal: "var(--joy-teal)",
  rust: "var(--joy-rust)",
  rustDeep: "var(--joy-rust-deep)",
  bone: "var(--joy-bone)",
};

const mutedLabel = {
  fontFamily: "var(--joy-font-mono)", fontSize: 10,
  letterSpacing: "0.12em", color: COLORS.inkSoft,
  textTransform: "uppercase",
};

const btnGhost = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "6px 12px", borderRadius: 999,
  background: "transparent", border: `1px solid ${COLORS.rule}`,
  fontFamily: "var(--joy-font-mono)", fontSize: 10, letterSpacing: "0.06em",
  color: COLORS.inkSoft, cursor: "pointer", textTransform: "uppercase",
};

const btnPrimary = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "8px 16px", borderRadius: 999,
  background: COLORS.teal, color: "#ffffff", border: "none",
  fontFamily: "var(--joy-font-mono)", fontSize: 11, letterSpacing: "0.06em",
  cursor: "pointer", textTransform: "uppercase",
};

const select = {
  width: "100%", padding: "5px 8px", borderRadius: 6,
  background: COLORS.paper, color: COLORS.ink,
  border: `1px solid ${COLORS.rule}`,
  fontFamily: "var(--joy-font-body)", fontSize: 12, cursor: "pointer",
};

export default function CsvImportModal({ rawText, filename, project, onClose, onCommit }) {
  const parsed = useMemo(() => parseCsv(rawText || ""), [rawText]);
  const detected = useMemo(() => autoDetect(parsed.headers), [parsed.headers]);

  const [mapping, setMapping] = useState(detected);
  const [createMissingMembers, setCreateMissingMembers] = useState(true);
  const [createMissingCategories, setCreateMissingCategories] = useState(true);
  const [createMissingStakeholders, setCreateMissingStakeholders] = useState(false);
  const [replace, setReplace] = useState(false);

  // Re-sync mapping when a fresh file is dropped in.
  React.useEffect(() => { setMapping(detected); }, [detected]);

  const built = useMemo(() => buildDrafts({
    headers: parsed.headers,
    rows: parsed.rows,
    mapping,
    project,
    options: { createMissingMembers, createMissingCategories, createMissingStakeholders },
  }), [parsed, mapping, project, createMissingMembers, createMissingCategories, createMissingStakeholders]);

  const titleMapped = !!mapping.title;
  const canImport = titleMapped && built.drafts.length > 0;

  const commit = () => {
    if (!canImport) return;
    onCommit({
      drafts: built.drafts,
      newMembers: createMissingMembers ? built.newMembers : [],
      newCategories: createMissingCategories ? built.newCategories : [],
      newStakeholders: createMissingStakeholders ? built.newStakeholders : [],
      replace,
    });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "max(24px, 4vh) 16px", overflowY: "auto",
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          background: COLORS.bone,
          color: COLORS.ink,
          border: `1px solid ${COLORS.rule}`,
          borderRadius: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.30)",
          padding: 20,
          fontFamily: "var(--joy-font-body)",
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{
              fontFamily: "var(--joy-font-head)", fontWeight: 700, fontSize: 22,
              fontStyle: "italic", letterSpacing: "-0.01em", lineHeight: 1.1,
            }}>
              Import from CSV
            </div>
            <div style={{ fontSize: 12, color: COLORS.inkSoft, marginTop: 2 }}>
              {filename ? `${filename} · ` : ""}{parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"} detected
            </div>
          </div>
          <button onClick={onClose} style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30, borderRadius: 999,
            background: "transparent", border: `1px solid ${COLORS.rule}`,
            color: COLORS.inkSoft, cursor: "pointer",
          }} aria-label="Close import dialog">
            <X size={14} />
          </button>
        </div>

        {parsed.headers.length === 0 ? (
          <EmptyState onClose={onClose} />
        ) : (
          <>
            <Section label="Match columns" hint="Map each Joy-Matrix field to a column in your file. Title is required; everything else is optional.">
              <div style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr",
                rowGap: 8, columnGap: 12,
                alignItems: "center",
              }}>
                {FIELDS.map((f) => (
                  <React.Fragment key={f.key}>
                    <div style={{ fontSize: 13, fontFamily: "var(--joy-font-head)", fontWeight: 600 }}>
                      {f.label}{f.required && <span style={{ color: COLORS.rust }}> *</span>}
                    </div>
                    <select
                      value={mapping[f.key] || ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || null }))}
                      style={{
                        ...select,
                        borderColor: f.required && !mapping[f.key] ? COLORS.rust : COLORS.rule,
                      }}
                      title={f.help}
                    >
                      <option value="">— none —</option>
                      {parsed.headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </React.Fragment>
                ))}
              </div>
            </Section>

            <Section label="Options">
              <CheckRow
                checked={createMissingMembers}
                onChange={setCreateMissingMembers}
                label={`Create ${built.newMembers.length || "missing"} member${built.newMembers.length === 1 ? "" : "s"}`}
                detail={built.newMembers.length ? built.newMembers.join(", ") : "no new names referenced"}
                disabled={built.newMembers.length === 0}
              />
              <CheckRow
                checked={createMissingCategories}
                onChange={setCreateMissingCategories}
                label={`Create ${built.newCategories.length || "missing"} categor${built.newCategories.length === 1 ? "y" : "ies"}`}
                detail={built.newCategories.length ? built.newCategories.join(", ") : "no new names referenced"}
                disabled={built.newCategories.length === 0}
              />
              <CheckRow
                checked={createMissingStakeholders}
                onChange={setCreateMissingStakeholders}
                label={`Create ${built.newStakeholders.length || "missing"} stakeholder${built.newStakeholders.length === 1 ? "" : "s"}`}
                detail={built.newStakeholders.length ? built.newStakeholders.join(", ") : "no new names referenced"}
                disabled={built.newStakeholders.length === 0}
              />
              <CheckRow
                checked={replace}
                onChange={setReplace}
                label="Replace existing tasks"
                detail={replace ? "current tasks will be cleared first" : `append to ${project.tasks.length} existing task${project.tasks.length === 1 ? "" : "s"}`}
              />
            </Section>

            <Section label={`Preview (${Math.min(5, built.drafts.length)} of ${built.drafts.length})`}>
              {built.drafts.length === 0 ? (
                <div style={{ fontSize: 12, color: COLORS.inkSoft, fontStyle: "italic" }}>
                  No rows would be imported — try mapping a different Title column.
                </div>
              ) : (
                <div style={{ overflowX: "auto", margin: "0 -4px" }}>
                  <table style={{
                    borderCollapse: "collapse", width: "100%", minWidth: 560,
                    fontSize: 12, fontFamily: "var(--joy-font-body)",
                  }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: COLORS.inkSoft, fontFamily: "var(--joy-font-mono)", fontSize: 10, letterSpacing: "0.06em" }}>
                        <th style={th}>Title</th>
                        <th style={th}>U</th>
                        <th style={th}>I</th>
                        <th style={th}>E</th>
                        <th style={th}>Due</th>
                        <th style={th}>Assignee</th>
                        <th style={th}>Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {built.drafts.slice(0, 5).map((d, i) => (
                        <tr key={i} style={{ borderTop: `1px solid ${COLORS.rule}` }}>
                          <td style={td}>{d.title}</td>
                          <td style={td}>{d.urgency}</td>
                          <td style={td}>{d.importance}</td>
                          <td style={td}>{d.effort}</td>
                          <td style={td}>{formatDue(d.dueDate)}</td>
                          <td style={td}>{describeRef(d.assigneeId, d._newAssigneeName, project.members, createMissingMembers)}</td>
                          <td style={td}>{describeRef(d.categoryId, d._newCategoryName, project.categories, createMissingCategories)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {built.warnings.length > 0 && (
              <Section label={`${built.warnings.length} warning${built.warnings.length === 1 ? "" : "s"}`}>
                <ul style={{
                  margin: 0, padding: 0, listStyle: "none",
                  display: "flex", flexDirection: "column", gap: 4,
                  maxHeight: 120, overflowY: "auto",
                }}>
                  {built.warnings.slice(0, 20).map((w, i) => (
                    <li key={i} style={{ fontSize: 12, color: COLORS.rustDeep, display: "flex", gap: 6, alignItems: "flex-start" }}>
                      <AlertTriangle size={12} style={{ marginTop: 2, flexShrink: 0 }} />
                      <span>Row {w.row}: {w.msg}</span>
                    </li>
                  ))}
                  {built.warnings.length > 20 && (
                    <li style={{ fontSize: 11, color: COLORS.inkSoft, fontStyle: "italic" }}>
                      …and {built.warnings.length - 20} more.
                    </li>
                  )}
                </ul>
              </Section>
            )}

            {/* footer */}
            <div style={{
              display: "flex", gap: 10, justifyContent: "flex-end",
              marginTop: 16, paddingTop: 14, borderTop: `1px solid ${COLORS.rule}`,
            }}>
              <button onClick={onClose} style={btnGhost}>Cancel</button>
              <button
                onClick={commit}
                disabled={!canImport}
                style={{ ...btnPrimary, opacity: canImport ? 1 : 0.4, cursor: canImport ? "pointer" : "not-allowed" }}
              >
                <CheckCircle2 size={12} /> Import {built.drafts.length} task{built.drafts.length === 1 ? "" : "s"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const th = { padding: "6px 8px", textAlign: "left", whiteSpace: "nowrap" };
const td = { padding: "6px 8px", verticalAlign: "top" };

function Section({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ ...mutedLabel, marginBottom: 6 }}>{label}</div>
      {hint && (
        <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 8 }}>{hint}</div>
      )}
      {children}
    </div>
  );
}

function CheckRow({ checked, onChange, label, detail, disabled }) {
  return (
    <label style={{
      display: "flex", alignItems: "flex-start", gap: 8,
      padding: "4px 0",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
    }}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        style={{ marginTop: 3 }}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13 }}>{label}</div>
        {detail && (
          <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 2, wordBreak: "break-word" }}>
            {detail}
          </div>
        )}
      </div>
    </label>
  );
}

function describeRef(existingId, newName, list, willCreate) {
  if (existingId) {
    const item = list.find((x) => x.id === existingId);
    return item?.name || "—";
  }
  if (newName) return `${newName}${willCreate ? " *" : " (ignored)"}`;
  return <span style={{ color: COLORS.inkSoft }}>—</span>;
}

function formatDue(dd) {
  if (!dd) return <span style={{ color: COLORS.inkSoft }}>—</span>;
  if (dd.kind === "fuzzy") return dd.value;
  try {
    const d = new Date(dd.value);
    return d.toLocaleDateString();
  } catch {
    return dd.value;
  }
}

function EmptyState({ onClose }) {
  return (
    <div style={{ padding: "20px 0" }}>
      <div style={{ fontSize: 14, color: COLORS.rustDeep, marginBottom: 12 }}>
        Couldn't read any rows from this file. It may be empty, or in an unexpected format.
      </div>
      <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 16 }}>
        Joy Matrix accepts standard CSV with a header row in the first line. Most project-management tools export this format directly — try the "Export → CSV" option in OpenProject, Linear, Jira, Asana, Trello, ClickUp, or Notion.
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={onClose} style={btnGhost}>Close</button>
      </div>
    </div>
  );
}
