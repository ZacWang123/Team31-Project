import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const destinationCoords = JSON.parse(
  readFileSync(path.join(__dirname, '..', 'data', 'destinationCoords.json'), 'utf-8')
);
const locationEnrichment = JSON.parse(
  readFileSync(path.join(__dirname, '..', 'data', 'locationEnrichment.json'), 'utf-8')
);

const ISO2_TO_ISO3 = {
  au: 'AUS', us: 'USA', nz: 'NZL', qa: 'QAT', in: 'IND',
  th: 'THA', ca: 'CAN', cn: 'CHN', sg: 'SGP', gb: 'GBR',
  vn: 'VNM', jp: 'JPN', mv: 'MDV', fj: 'FJI', aq: 'ATA',
};

const ISO2_TO_COUNTRY = {
  au: 'Australia', us: 'United States', nz: 'New Zealand', qa: 'Qatar', in: 'India',
  th: 'Thailand', ca: 'Canada', cn: 'China', sg: 'Singapore', gb: 'United Kingdom',
  vn: 'Vietnam', jp: 'Japan', mv: 'Maldives', fj: 'Fiji', aq: 'Antarctica',
};

const IMAGE_BASE = 'https://www.flightcentre.com.au';
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80';

// Same site, same rule as the working Python version: decode any existing
// percent-encoding first, then re-encode everything except '/' and '+' -
// several real filenames contain a literal '+' (e.g. HX+Antarctica.jpg) and
// percent-encoding it to %2B 403s against Flight Centre's CDN.
function buildImageUrl(rawPath) {
  if (!rawPath || !rawPath.trim()) return null;
  const decoded = decodeURIComponent(rawPath.trim());
  return IMAGE_BASE + encodePathPreservingPlus(decoded);
}

function encodePathPreservingPlus(decoded) {
  return decoded
    .split('/')
    .map((segment) => segment.split('+').map((part) => encodeURIComponent(part)).join('+'))
    .join('/');
}

function cleanPrice(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * Turns one raw Google Sheet row (keyed by Flight Centre's own column
 * names) into the enriched shape the frontend expects. Returns null for
 * rows we can't place on the map (destination not in our geocoded set) -
 * the sync logs these so a new destination added to the sheet is visible
 * as "skipped", not silently dropped.
 */
export function transformRow(row) {
  const destination = (row['Destination'] || '').trim();
  const packageName = (row['Package Offer Name'] || '').trim();
  if (!destination || !packageName) return { skipped: true, reason: 'missing destination or package name' };

  const coord = destinationCoords[destination];
  if (!coord || coord.lat == null) {
    return { skipped: true, reason: `no known coordinates for destination "${destination}" - add it to destinationCoords.json` };
  }

  const iso2 = (coord.country_code || '').toLowerCase();
  const rawImagePath = row['Supplier Product Image (URL or File Ref)'] || '';
  const location = locationEnrichment[packageName] || { city: '', place: '' };

  return {
    skipped: false,
    doc: {
      packageName,
      destination,
      country: ISO2_TO_COUNTRY[iso2] || (destination === 'Antarctica' ? 'Antarctica' : destination),
      city: location.city || '',
      place: location.place || '',
      lat: coord.lat,
      lon: coord.lon,
      iso2,
      iso3: ISO2_TO_ISO3[iso2] || (destination === 'Antarctica' ? 'ATA' : ''),
      wowFactor: (row['Short Description (WOW Factor)'] || '').trim(),
      fromPrice: cleanPrice(row['Advertised From Price(FCL May Adjust)']),
      image: buildImageUrl(rawImagePath) || FALLBACK_IMAGE,
    },
  };
}
