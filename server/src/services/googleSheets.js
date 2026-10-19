// Pulls raw rows from the live Google Sheet and turns them into plain objects
// keyed by the sheet's own header row - so the sheet can carry Flight Centre's
// real column names (Destination, Package Offer Name, etc.) and nothing here
// needs to change if columns get reordered.
//
// There are two ways to read the sheet:
//
//  1. Published CSV link (GOOGLE_SHEET_CSV_URL) - in Google Sheets use
//     File > Share > Publish to web, pick the tab, choose CSV. No API key
//     needed, and the link updates as the sheet changes (Google refreshes it
//     roughly every 5 minutes). Anyone with the link can read it, so only
//     publish a tab that holds data you're happy to be public.
//  2. Sheets API v4 (GOOGLE_SHEET_ID + GOOGLE_SHEETS_API_KEY) - needs the
//     sheet shared as "Anyone with the link - Viewer" plus an API key.
//
// If both are set, the published CSV link wins.

import { parseCsv } from './csv.js';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// The project's live sheet, published as CSV. Safe to keep in the repo: it's
// the "app_data" tab only, which holds just the 7 columns the app uses
// (destination, price, name, wow factor, description, inclusions, image) and
// none of the supplier / nett rate columns. That tab is the only thing
// published - the full sheet is not.
// This is what makes a fresh download work with no .env: with nothing else
// configured, the server reads this link.
const DEFAULT_SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTSGDKGOuCGeAVAeMcdWpxBHnRnk1cRC5w2XrMdo-Wz0s10k990ntRhm-zsiHIWBwS8k2zYZ0iQu4jC/pub?gid=1340070424&single=true&output=csv';

/** Reads the sheet settings from environment variables. */
export function sheetSourceFromEnv(env = process.env) {
  const hasApiCreds = Boolean(env.GOOGLE_SHEET_ID && env.GOOGLE_SHEETS_API_KEY);
  const envCsvUrl = (env.GOOGLE_SHEET_CSV_URL || '').trim();

  return {
    // an explicit link wins; otherwise use the default link, unless someone
    // has set up the API way (ID + key) on purpose
    csvUrl: envCsvUrl || (hasApiCreds ? '' : DEFAULT_SHEET_CSV_URL),
    sheetId: env.GOOGLE_SHEET_ID,
    apiKey: env.GOOGLE_SHEETS_API_KEY,
    range: env.GOOGLE_SHEET_RANGE || 'Sheet1',
  };
}

export function isSheetConfigured({ csvUrl, sheetId, apiKey }) {
  return Boolean(csvUrl || (sheetId && apiKey));
}

// header row + data rows -> array of objects keyed by column name
function rowsFromValues(values) {
  if (values.length < 2) return []; // header row only, or empty sheet

  const [header, ...rows] = values;
  return rows
    .filter((row) => row.some((cell) => String(cell || '').trim() !== '')) // skip fully blank rows
    .map((row) => {
      const obj = {};
      header.forEach((colName, i) => {
        obj[colName] = row[i] !== undefined ? row[i] : '';
      });
      return obj;
    });
}

async function fetchPublishedCsvRows(csvUrl) {
  const res = await fetch(csvUrl);
  if (!res.ok) {
    throw new Error(`Published sheet request failed (${res.status} ${res.statusText}) - is the tab still published to the web?`);
  }

  const text = await res.text();
  // If the sheet stops being published, Google can answer 200 with a web page
  // instead of CSV - catch that so we don't "sync" a pile of HTML.
  if (/^\s*<(!doctype|html)/i.test(text)) {
    throw new Error('Published sheet link returned a web page, not CSV - check the link ends with output=csv and the tab is published.');
  }

  return rowsFromValues(parseCsv(text));
}

async function fetchApiRows({ sheetId, apiKey, range }) {
  const url = `${SHEETS_API_BASE}/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(
    range
  )}?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Google Sheets API request failed (${res.status} ${res.statusText}): ${body.slice(0, 300)}`
    );
  }

  const data = await res.json();
  return rowsFromValues(data.values || []);
}

export async function fetchSheetRows(source) {
  if (source.csvUrl) return fetchPublishedCsvRows(source.csvUrl);

  if (!source.sheetId || !source.apiKey) {
    throw new Error(
      'Set GOOGLE_SHEET_CSV_URL (published link), or both GOOGLE_SHEET_ID and GOOGLE_SHEETS_API_KEY, to sync from Google Sheets.'
    );
  }
  return fetchApiRows(source);
}
