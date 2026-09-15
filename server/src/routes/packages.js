import { Router } from 'express';
import Package from '../models/Package.js';
import { runSync } from '../services/sync.js';

const router = Router();

// GET /api/packages - what the frontend actually consumes. Same shape as
// the old bundled packages.json array, so buildDestinations() and friends
// in WorldMap.jsx need no logic changes, only the data source.
router.get('/packages', async (req, res) => {
  try {
    const packages = await Package.find({}, { _id: 0, __v: 0 }).lean();
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load packages', detail: err.message });
  }
});

// POST /api/sync - manually re-pull the Google Sheet on demand (the server
// also does this on startup and on a timer - see index.js).
router.post('/sync', async (req, res) => {
  try {
    const summary = await runSync({
      sheetId: process.env.GOOGLE_SHEET_ID,
      apiKey: process.env.GOOGLE_SHEETS_API_KEY,
      range: process.env.GOOGLE_SHEET_RANGE || 'Sheet1',
    });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
