import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import packagesRouter from './routes/packages.js';
import { runSync } from './services/sync.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, mongoConnected: mongoose.connection.readyState === 1 });
});

app.use('/api', packagesRouter);

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/team31';

async function syncIfConfigured(label) {
  if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SHEETS_API_KEY) {
    console.log(`[sync] skipped (${label}) - GOOGLE_SHEET_ID / GOOGLE_SHEETS_API_KEY not set yet`);
    return;
  }
  try {
    const summary = await runSync({
      sheetId: process.env.GOOGLE_SHEET_ID,
      apiKey: process.env.GOOGLE_SHEETS_API_KEY,
      range: process.env.GOOGLE_SHEET_RANGE || 'Sheet1',
    });
    console.log(
      `[sync] (${label}) read ${summary.rowsRead} rows, upserted ${summary.upserted}, skipped ${summary.skipped.length} in ${summary.tookMs}ms`
    );
    if (summary.skipped.length) {
      summary.skipped.forEach((s) => console.log(`  - skipped "${s.row}": ${s.reason}`));
    }
  } catch (err) {
    console.error(`[sync] (${label}) failed:`, err.message);
  }
}

async function start() {
  await mongoose.connect(MONGODB_URI);
  console.log(`[mongo] connected to ${MONGODB_URI}`);

  await syncIfConfigured('startup');

  const intervalMinutes = Number(process.env.SYNC_INTERVAL_MINUTES || 0);
  if (intervalMinutes > 0) {
    setInterval(() => syncIfConfigured('interval'), intervalMinutes * 60 * 1000);
    console.log(`[sync] will re-sync every ${intervalMinutes} minute(s)`);
  }

  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
