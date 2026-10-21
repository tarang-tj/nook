// Counts the interview answers in tally.csv. No dependencies.
// Run from the repository root:  node interviews/tally.mjs
// Or point it at another file:    node interviews/tally.mjs path/to/file.csv

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HEADER = [
  "interviewee",
  "date",
  "segment",
  "moved_in_last_12mo",
  "moving_next_12mo",
  "last_move_fit_problem",
  "would_join_list",
  "would_pay_14_99",
  "interest_1_to_5",
  "notes_file",
];
const SEGMENTS = ["on-campus", "off-campus", "non-student renter"];
const YES_NO = ["yes", "no"];
const PAY = ["yes", "maybe", "no"];

// Splits one CSV line. Handles "quoted, fields" and "" inside quotes.
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (quoted) return null;
  out.push(cur);
  return out.map((f) => f.trim());
}

function isRealDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Returns a list of problems with one row, empty when the row is fine.
function checkRow(row) {
  const problems = [];
  const oneOf = (field, allowed) => {
    if (!allowed.includes(row[field])) {
      problems.push(`${field} is "${row[field]}", expected one of: ${allowed.join(", ")}`);
    }
  };
  if (!/^Interviewee \d+$/.test(row.interviewee)) {
    problems.push(`interviewee is "${row.interviewee}", expected a label like "Interviewee 3" (no names)`);
  }
  if (!isRealDate(row.date)) problems.push(`date is "${row.date}", expected YYYY-MM-DD`);
  oneOf("segment", SEGMENTS);
  oneOf("moved_in_last_12mo", YES_NO);
  oneOf("moving_next_12mo", YES_NO);
  oneOf("last_move_fit_problem", YES_NO);
  oneOf("would_join_list", YES_NO);
  oneOf("would_pay_14_99", PAY);
  if (!/^[1-5]$/.test(row.interest_1_to_5)) {
    problems.push(`interest_1_to_5 is "${row.interest_1_to_5}", expected a whole number from 1 to 5`);
  }
  return problems;
}

function parse(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const header = splitCsvLine(lines[0] ?? "");
  if (!header || header.join(",") !== HEADER.join(",")) {
    return { errors: [`line 1: header must be exactly: ${HEADER.join(",")}`], rows: [] };
  }
  const errors = [];
  const rows = [];
  const seen = new Map();
  for (let i = 1; i < lines.length; i++) {
    const lineNo = i + 1;
    if (lines[i].trim() === "") continue;
    const fields = splitCsvLine(lines[i]);
    if (!fields) {
      errors.push(`line ${lineNo}: a quote is opened and never closed`);
      continue;
    }
    if (fields.length !== HEADER.length) {
      errors.push(`line ${lineNo}: has ${fields.length} fields, expected ${HEADER.length}`);
      continue;
    }
    const row = Object.fromEntries(HEADER.map((h, j) => [h, fields[j]]));
    for (const p of checkRow(row)) errors.push(`line ${lineNo}: ${p}`);
    if (seen.has(row.interviewee)) {
      errors.push(`line ${lineNo}: "${row.interviewee}" is already on line ${seen.get(row.interviewee)}`);
    } else {
      seen.set(row.interviewee, lineNo);
    }
    rows.push(row);
  }
  return { errors, rows };
}

const pct = (n, total) => (total === 0 ? "n/a" : `${((100 * n) / total).toFixed(0)}%`);
const count = (rows, field, value) => rows.filter((r) => r[field] === value).length;
const line = (label, n, total) => `  ${label.padEnd(34)} ${String(n).padStart(3)}  (${pct(n, total)})`;
const mean = (rows) =>
  rows.length === 0 ? "n/a" : (rows.reduce((s, r) => s + Number(r.interest_1_to_5), 0) / rows.length).toFixed(2);

function report(rows) {
  const n = rows.length;
  const out = [];
  out.push(`Interviews logged: ${n}`);
  out.push(line("Moved in the last 12 months", count(rows, "moved_in_last_12mo", "yes"), n));
  out.push(line("Moving in the next 12 months", count(rows, "moving_next_12mo", "yes"), n));
  out.push(line("Had a fit problem last move", count(rows, "last_move_fit_problem", "yes"), n));
  out.push(line("Would join the early list", count(rows, "would_join_list", "yes"), n));
  out.push("Would pay $14.99 for one move:");
  for (const v of PAY) out.push(line(`  ${v}`, count(rows, "would_pay_14_99", v), n));
  out.push(`Mean interest (1 to 5): ${mean(rows)}`);
  out.push("");
  out.push("By segment:");
  for (const seg of SEGMENTS) {
    const sub = rows.filter((r) => r.segment === seg);
    const join = count(sub, "would_join_list", "yes");
    const pay = PAY.map((v) => `${v} ${count(sub, "would_pay_14_99", v)}`).join(", ");
    out.push(`  ${seg}: ${sub.length} interview${sub.length === 1 ? "" : "s"}, ${join} would join (${pct(join, sub.length)}), pay: ${pay}, mean interest ${mean(sub)}`);
  }
  out.push("");
  out.push("These are interview answers, not sign-ups. Count the landing page form separately.");
  return out.join("\n");
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const file = process.argv[2] ?? join(here, "tally.csv");
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    console.error(`Could not read ${file}: ${err.message}`);
    process.exit(2);
  }
  const { errors, rows } = parse(text);
  if (errors.length > 0) {
    console.error(`${file} has rows that cannot be counted. Fix these and run again:`);
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }
  if (rows.length === 0) {
    console.log("No interviews logged yet. Add one row per interview to interviews/tally.csv.");
    return;
  }
  console.log(report(rows));
}

main();
