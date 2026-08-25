import { downloadFile } from "./download.js";
import { htmlToText } from "./coverLetter.js";
import {
  STATUS_LABELS,
  COMPANY_SIZE_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  PAY_PERIOD_LABELS,
} from "./labels.js";

/**
 * Building the CSV here rather than on the server keeps STATUS_LABELS and
 * COMPANY_SIZE_LABELS as the only place a value is spelled for a human. A
 * server-side exporter would need a second copy of both in Python — exactly
 * the duplication KAN-34 existed to remove.
 */

// The API sends decimals as strings ("106400.00"). Excel parses those, but the
// trailing zeros are noise in a column you mean to sum.
const number = (v) => (v === null || v === undefined || v === "" ? "" : Number(v));

// Excel is unreliable about the "T" in an ISO timestamp and will often leave it
// sitting as text; a space makes it parse as a date-time. Plain dates are
// already unambiguous, so they are left exactly as stored.
const datetime = (v) => (v ? String(v).replace("T", " ") : "");

// Column order follows REQUIREMENTS.md §2, which is the model's declaration
// order, so the file reads like the field table.
const APPLICATION_COLUMNS = [
  ["ID", (a) => a.id],
  ["Company", (a) => a.company],
  ["Role title", (a) => a.role_title],
  ["Job link", (a) => a.job_link],
  ["Source", (a) => a.source],
  ["Location", (a) => a.location],
  ["Company size", (a) => COMPANY_SIZE_LABELS[a.company_size]],
  ["Years experience (min)", (a) => a.years_experience_min],
  ["Employment type", (a) => EMPLOYMENT_TYPE_LABELS[a.employment_type]],
  ["Contract term (months)", (a) => a.contract_term_months],
  ["Hours per week (min)", (a) => a.hours_per_week_min],
  ["Hours per week (max)", (a) => a.hours_per_week_max],
  ["Status", (a) => STATUS_LABELS[a.status]],
  ["Salary min", (a) => number(a.salary_min)],
  ["Salary max", (a) => number(a.salary_max)],
  // Numeric above, readable here. Without this column the two figures are
  // ambiguous in the spreadsheet in exactly the way KAN-50 fixed in the app —
  // an 86 and a 120000 in the same column mean different things.
  ["Pay period", (a) => PAY_PERIOD_LABELS[a.pay_period]],
  ["Currency", (a) => a.salary_currency],
  ["Date applied", (a) => a.date_applied],
  ["Next action", (a) => a.next_action],
  ["Next action date", (a) => a.next_action_date],
  ["Notes", (a) => a.notes],
  ["Job description", (a) => a.job_description],
  // Prose, not markup — a cell full of <p> tags is noise in a spreadsheet.
  ["Cover letter", (a) => htmlToText(a.cover_letter)],
  ["Archived at", (a) => datetime(a.archived_at)],
  ["Created at", (a) => datetime(a.created_at)],
  ["Updated at", (a) => datetime(a.updated_at)],
];

const CONTACT_COLUMNS = [
  ["name", (c) => c.name],
  ["title", (c) => c.title],
  ["email", (c) => c.email],
  ["phone", (c) => c.phone],
  ["notes", (c) => c.notes],
];

// Excel executes a cell whose text starts with one of these, so a note pasted
// out of a job posting can become #NAME? — or, with a remote-data function, an
// outbound request. Prefixing with an apostrophe forces it to stay text.
//
// The apostrophe is visible in the cell, and that is the honest trade: a
// leading quote you can see beats a formula you cannot. Only string values are
// guarded, so a negative number still exports as a negative number.
const FORMULA_START = /^[=+\-@\t\r]/;

function escapeField(value) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;

  // RFC 4180: quote anything holding a delimiter, a quote or a newline, and
  // double the quotes within. Notes and job descriptions routinely have all
  // three, since they are pasted straight from postings.
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * One row per application, contacts flattened into numbered columns.
 *
 * A row per *contact* would repeat the application, so any sum over salary
 * would multiply-count it and the row count would stop meaning "applications".
 * The width is sized to the most contacts any exported application has, so a
 * search returning none of them costs no extra columns at all.
 */
export function toCsv(applications) {
  const maxContacts = applications.reduce(
    (most, a) => Math.max(most, (a.contacts || []).length),
    0
  );
  const contactSlots = Array.from({ length: maxContacts }, (_, i) => i);

  const header = [
    ...APPLICATION_COLUMNS.map(([label]) => label),
    ...contactSlots.flatMap((i) =>
      CONTACT_COLUMNS.map(([label]) => `Contact ${i + 1} ${label}`)
    ),
  ];

  const rows = applications.map((a) => [
    ...APPLICATION_COLUMNS.map(([, read]) => read(a)),
    ...contactSlots.flatMap((i) => {
      const contact = (a.contacts || [])[i];
      return CONTACT_COLUMNS.map(([, read]) => (contact ? read(contact) : ""));
    }),
  ]);

  // CRLF per RFC 4180. It matters here rather than being pedantry: notes and
  // job descriptions carry their own newlines inside quoted fields, and a
  // bare-LF file makes those ambiguous to some readers.
  return (
    [header, ...rows].map((row) => row.map(escapeField).join(",")).join("\r\n") +
    "\r\n"
  );
}

// Excel on Windows reads a BOM-less UTF-8 file as the system codepage, which
// mangles every en-dash — and COMPANY_SIZE_LABELS is full of them
// ("Mid-size (51–200 employees)").
export const CSV_BOM = "\uFEFF";

export const csvFilename = (today = new Date()) =>
  `job-tracker-${today.toISOString().slice(0, 10)}.csv`;

export function downloadCsv(text, filename) {
  downloadFile(CSV_BOM + text, filename, "text/csv;charset=utf-8");
}
