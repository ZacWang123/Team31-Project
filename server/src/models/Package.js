import mongoose from 'mongoose';

// One day of a package's itinerary (from the "Product Description" column).
const itineraryDaySchema = new mongoose.Schema(
  { day: { type: String, default: '' }, title: { type: String, default: '' }, body: { type: String, default: '' } },
  { _id: false }
);

// One highlighted inclusion line (from the "Product Inclusions" column).
const inclusionItemSchema = new mongoose.Schema(
  { icon: { type: String, default: '' }, title: { type: String, default: '' }, subtitle: { type: String, default: '' } },
  { _id: false }
);

// Mirrors the shape client/src/data/packages.json has always used, so the
// frontend's existing filtering/grouping/tagging logic (buildDestinations,
// getPackageTags, formatLocationPath, etc.) works unchanged against data
// that now comes from this live database instead of a bundled JSON file.
const packageSchema = new mongoose.Schema(
  {
    // packageName is the natural key - Flight Centre's sheet doesn't carry a
    // stable numeric ID, and it's what titles are keyed on everywhere else
    // in the app already (getPkgKey, arePackagesSame).
    packageName: { type: String, required: true, unique: true, index: true },
    destination: { type: String, required: true, index: true },
    country: { type: String, default: '' },
    city: { type: String, default: '' },
    place: { type: String, default: '' },
    lat: { type: Number, default: 0 },
    lon: { type: Number, default: 0 },
    iso2: { type: String, default: '' },
    iso3: { type: String, default: '' },
    wowFactor: { type: String, default: '' },
    fromPrice: { type: Number, default: null },
    image: { type: String, default: '' },
    // Package detail content, parsed out of the sheet's "Product Description"
    // and "Product Inclusions" JSON columns. Empty when a row has none (or
    // its JSON is malformed) - the frontend hides those sections then.
    summary: { type: String, default: '' },
    itinerary: { type: [itineraryDaySchema], default: [] },
    inclusions: {
      featured: { type: [inclusionItemSchema], default: [] },
      top: { type: [inclusionItemSchema], default: [] },
      included: { type: [String], default: [] },
      excluded: { type: [String], default: [] },
    },
    // Set/refreshed on every sync run - lets /api/packages report how fresh
    // the data is, and lets a future "remove rows no longer in the sheet"
    // pass find anything that didn't get touched by the latest sync.
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model('Package', packageSchema);
