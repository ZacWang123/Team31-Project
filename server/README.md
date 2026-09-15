# Team31 server (FCIPT3-25: live database)

A small Express + MongoDB backend that keeps the app's package data in sync
with a Google Sheet - the sheet is meant to hold the same columns as Flight
Centre's real Excel export, so editing it (add/change/remove a row, re-sync)
updates the live site with no code changes or redeploy.

## How it works

```
Google Sheet  --(Sheets API v4)-->  sync job  --(upsert)-->  MongoDB  --(REST)-->  frontend
```

- `src/services/googleSheets.js` - pulls raw rows from the sheet
- `src/services/transform.js` - turns a raw row into the enriched shape the
  frontend expects (geocoded lat/lon, a working image URL built from Flight
  Centre's own supplier image path, country/city/place breaddown)
- `src/services/sync.js` - runs both of the above and upserts into Mongo,
  keyed by `packageName`
- `src/routes/packages.js` - `GET /api/packages` (what the frontend reads),
  `POST /api/sync` (trigger a re-pull on demand)
- Sync also runs once on server startup, and on a timer (`SYNC_INTERVAL_MINUTES`)

## One-time setup

1. **MongoDB.** Point `MONGODB_URI` at a real database - a local `mongod`
   for dev, or a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   cluster for something actually "live" outside your own machine.

2. **The Google Sheet.**
   - Create a new Google Sheet and import `FlightCentre_DB.csv` (or Flight
     Centre's real export, once we have it) into it - keep it in the same
     column format, since the sync reads columns by name (`Destination`,
     `Package Offer Name`, `Short Description (WOW Factor)`,
     `Advertised From Price(FCL May Adjust)`, `Supplier Product Image (URL or File Ref)`).
   - Share it: **Anyone with the link → Viewer**. The sync only ever reads,
     never writes, but it does need at least public-read access since we're
     using a plain API key rather than a service account.
   - Copy the Sheet ID out of its URL (the long string between `/d/` and
     `/edit`).

3. **A Google Sheets API key.**
   - [console.cloud.google.com](https://console.cloud.google.com) → create/select a project
   - APIs & Services → Library → enable **Google Sheets API**
   - APIs & Services → Credentials → Create Credentials → **API key**

4. **Configure.**
   ```bash
   cp .env.example .env
   # then fill in MONGODB_URI, GOOGLE_SHEET_ID, GOOGLE_SHEETS_API_KEY
   ```

5. **Run.**
   ```bash
   npm install
   npm run dev
   ```
   Watch the console - on startup it logs how many rows it read, how many
   it upserted, and *why* it skipped any row it couldn't place (usually a
   destination that isn't in `src/data/destinationCoords.json` yet).

## Adding a destination that doesn't exist yet

The sync needs to know a destination's coordinates and country to place it
on the map - it can't geocode on the fly. If you add a row for a brand new
destination and it shows up as "skipped" in the sync log, add an entry for
it to `src/data/destinationCoords.json` (lat/lon/country_code), then
re-sync (`POST /api/sync`, or wait for the timer).

## Known limitation

City-level packages (Sydney, Melbourne, etc. - `client/src/data/cityPackages.json`)
are a separate, still-static dataset built on top of the Google Sheet data
for FCIPT3-10. They are **not** part of this sync - that's a reasonable
follow-up if the team wants the whole app on one live source, but it's a
distinct set of packages Flight Centre didn't provide, so it wasn't in
scope here.
