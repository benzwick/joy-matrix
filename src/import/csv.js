// Minimal RFC 4180-ish CSV parser. Handles:
//   - quoted fields ("foo,bar")
//   - escaped quotes inside quoted fields ("she said ""hi""")
//   - embedded newlines inside quoted fields
//   - LF and CRLF line endings
//   - a stripped BOM at the start of the file
//
// Returns { headers: string[], rows: string[][] } where every row has the
// same arity as headers (shorter rows are padded with empty strings,
// longer rows are truncated).

const BOM = "﻿";

function detectDelimiter(text) {
  // Sniff the first non-empty, non-quoted line. Most PM-tool exports use
  // commas, but Excel-on-locale sometimes ships semicolons or tabs.
  let inQuote = false;
  let line = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { inQuote = !inQuote; line += ch; continue; }
    if (!inQuote && (ch === "\n" || ch === "\r")) {
      if (line.trim()) break;
      line = "";
      continue;
    }
    line += ch;
  }
  const counts = {
    ",": (line.match(/,/g) || []).length,
    ";": (line.match(/;/g) || []).length,
    "\t": (line.match(/\t/g) || []).length,
  };
  let best = ",", bestCount = -1;
  for (const [d, c] of Object.entries(counts)) {
    if (c > bestCount) { best = d; bestCount = c; }
  }
  return best;
}

export function parseCsv(rawInput, opts = {}) {
  if (typeof rawInput !== "string") return { headers: [], rows: [] };
  let text = rawInput;
  if (text.startsWith(BOM)) text = text.slice(1);
  const delim = opts.delimiter || detectDelimiter(text);

  const records = [];
  let field = "";
  let row = [];
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuote = false; }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') { inQuote = true; continue; }
    if (ch === delim) { row.push(field); field = ""; continue; }
    if (ch === "\r") { /* swallowed — \n on next iter ends the record */ continue; }
    if (ch === "\n") {
      row.push(field);
      field = "";
      // Skip purely empty lines so trailing newlines don't add a blank row.
      if (row.length > 1 || (row.length === 1 && row[0] !== "")) records.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  // flush last field / row if no trailing newline
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || (row.length === 1 && row[0] !== "")) records.push(row);
  }

  if (records.length === 0) return { headers: [], rows: [] };
  const headers = records[0].map((h) => h.trim());
  const width = headers.length;
  const rows = records.slice(1).map((r) => {
    const out = r.slice(0, width);
    while (out.length < width) out.push("");
    return out;
  });
  return { headers, rows };
}
