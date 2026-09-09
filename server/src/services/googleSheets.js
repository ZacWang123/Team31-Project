// Pulls raw rows from the live Google Sheet via the Sheets API v4 and turns
// them into plain objects keyed by the sheet's own header row - so the sheet
// can carry Flight Centre's real column names (Destination, Package Offer
// Name, etc.) and nothing here needs to change if columns get reordered.
//
// Requires the sheet to be shared as "Anyone with the link - Viewer" (an API
// key alone can't read a private sheet - that needs a service account
// instead, which is more setup than this project needs right now).

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export async function fetchSheetRows({ sheetId, apiKey, range = 'Sheet1' }) {
  if (!sheetId || !apiKey) {
    throw new Error(
      'GOOGLE_SHEET_ID and GOOGLE_SHEETS_API_KEY must both be set to sync from Google Sheets.'
    );
  }

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
  const values = data.values || [];
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
