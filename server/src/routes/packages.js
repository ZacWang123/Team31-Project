import { Router } from 'express';
import Package from '../models/Package.js';
import { runSync } from '../services/sync.js';
import { sheetSourceFromEnv } from '../services/googleSheets.js';

// This router handles package-related API endpoints, including fetching all packages and triggering a sync with the Google Sheet source. It uses the Package model to interact with the MongoDB database and the runSync function to update package data from the external source.

const router = Router();

router.get('/packages', async (req, res) => {
  try {
    const packages = await Package.find({}, { _id: 0, __v: 0 }).lean();
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load packages', detail: err.message });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const summary = await runSync(sheetSourceFromEnv());
    res.json(summary);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
