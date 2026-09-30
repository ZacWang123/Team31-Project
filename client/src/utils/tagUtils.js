// src/utils/tagUtils.js

export const TAG_RULES = [
  { id: 'ski', label: 'Ski & Snow', icon: 'fi-rr-snowflake', test: /ski|snow/i },
  { id: 'cruise', label: 'Cruise', icon: 'fi-rr-ship', test: /cruise|sail/i },
  { id: 'all-inclusive', label: 'All-Inclusive', icon: 'fi-rr-umbrella-beach', test: /all-inclusive/i },
  { id: 'stopover', label: 'Stopover', icon: 'fi-rr-route', test: /stopover/i },
  { id: 'tour', label: 'Tours & Expeditions', icon: 'fi-rr-mountains', test: /tour|express|explorer|discovery|expedition/i },
];

export function getPackageTags(pkg) {
  const tags = [];
  const title = pkg.packageName || pkg.title || pkg.name || '';
  const haystack = `${title} ${pkg.wowFactor || ''} ${pkg.destination || ''}`;
  TAG_RULES.forEach(({ id }) => {
    const rule = TAG_RULES.find((r) => r.id === id);
    if (rule && rule.test.test(haystack)) {
      tags.push(id);
    }
  });
  return tags;
}

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
export function packageCountry(pkg) {
  if (pkg.country) return pkg.country;
  try {
    return pkg.iso2 ? countryNames.of(String(pkg.iso2).toUpperCase()) : '';
  } catch {
    return '';
  }
}

export function hasCoordinates(item) {
  return item && typeof item.lat === 'number' && typeof item.lon === 'number' && !Number.isNaN(item.lat) && !Number.isNaN(item.lon);
}

export function matchesPackage(pkg, query, filters) {
  const matchesFilter = !filters.length || filters.some((filter) => getPackageTags(pkg).includes(filter));
  const text = [pkg.packageName, pkg.title, pkg.name, pkg.city, pkg.destination, packageCountry(pkg)]
    .filter(Boolean).join(' ').toLocaleLowerCase();
  return matchesFilter && (!query || text.includes(query));
}