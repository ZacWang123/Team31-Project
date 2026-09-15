import Package from '../models/Package.js';
import { fetchSheetRows } from './googleSheets.js';
import { transformRow } from './transform.js';

/**
 * Pulls the live Google Sheet, transforms every row, and upserts into
 * MongoDB by packageName. Returns a summary so callers (the sync route, the
 * startup log, the interval timer) can all report the same shape.
 */
export async function runSync({ sheetId, apiKey, range }) {
  const startedAt = Date.now();
  const rawRows = await fetchSheetRows({ sheetId, apiKey, range });

  const skipped = [];
  let upserted = 0;

  for (const row of rawRows) {
    const result = transformRow(row);
    if (result.skipped) {
      skipped.push({ row: row['Package Offer Name'] || row['Destination'] || '(unnamed row)', reason: result.reason });
      continue;
    }

    await Package.findOneAndUpdate(
      { packageName: result.doc.packageName },
      { ...result.doc, lastSyncedAt: new Date() },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    upserted += 1;
  }

  return {
    ok: true,
    rowsRead: rawRows.length,
    upserted,
    skipped,
    tookMs: Date.now() - startedAt,
    syncedAt: new Date().toISOString(),
  };
}
