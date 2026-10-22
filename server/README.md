# Team31 server (FCIPT3-25: live database)

A small Express + MongoDB backend that keeps the app's package data in sync
with a Google Sheet - the sheet is meant to hold the same columns as Flight
Centre's real Excel export, so editing it (add/change/remove a row, re-sync)
updates the live site with no code changes or redeploy.

## How it works

```
Google Sheet (published tab)  --(csv link)-->  sync job  --(upsert)-->  MongoDB  --(REST)-->  frontend
```

- `src/services/googleSheets.js` - pulls raw rows from the sheet (reads the
  published csv link, or the Sheets API if you set an API key instead)
- `src/services/csv.js` - small csv reader (the description cells have line
  breaks and quotes in them so we can't just split on commas)
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

2. **The Google Sheet.** Nothing to do for our project - by default the
   server reads the published `app_data` tab of our sheet (the link is in
   `googleSheets.js`), no API key needed. That tab only has the 7 columns the
   app uses (`Destination`, `Package Offer Name`, `Short Description (WOW Factor)`,
   `Advertised From Price(FCL May Adjust)`, `Product Description`,
   `Product Inclusions`, `Supplier Product Image (URL or File Ref)`), it's built
   from the full sheet with a formula so it stays live. The full sheet has
   supplier / nett rate columns, so it is **not** published.

   To use a different sheet: make a tab with those columns, then
   File → Share → Publish to web → pick **that tab** (not "Entire document")
   → CSV, and put the link in `GOOGLE_SHEET_CSV_URL` in `.env`.

   (Old way, still works: share the sheet as "Anyone with the link → Viewer",
   get a Google Sheets API key, and fill in `GOOGLE_SHEET_ID` and
   `GOOGLE_SHEETS_API_KEY` in `.env`.)

3. **Configure.**
   ```bash
   cp .env.example .env
   # the defaults are fine for local dev if you have mongod running locally
   ```

4. **Run.**
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
