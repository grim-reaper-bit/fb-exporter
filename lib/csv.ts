/**
 * lib/csv.ts — shared CSV export helper for the Reddit and YouTube tools.
 *
 * Guards against CSV/formula injection: a cell whose content comes from
 * untrusted external text (a Reddit/YouTube commenter's name or comment body)
 * could start with =, +, -, or @, which Excel/Sheets interprets as a formula
 * on open. We prefix those with a tab so the leading character can never be
 * read as a formula trigger, while keeping the visible text unchanged.
 *
 * Only applied to actual strings — numeric columns (likes, depth, ...) are
 * computed by this app, never attacker-controlled free text, and a leading
 * "-" on a legitimate negative value (e.g. a downvoted Reddit comment's
 * score) must stay a clean number, not get corrupted into a tab-prefixed
 * string.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

function escapeCsvCell(value: unknown): string {
  const raw = String(value == null ? '' : value);
  const s = typeof value === 'string' && FORMULA_TRIGGER.test(raw) ? '\t' + raw : raw;
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCSV<T>(rows: T[], columns: (keyof T)[]): string {
  const head = columns.join(',');
  const body = rows.map((r) => columns.map((c) => escapeCsvCell(r[c])).join(',')).join('\r\n');
  return '﻿' + head + '\r\n' + body;
}