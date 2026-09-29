/**
 * Generates a unique key for a package item across diverse datasets.
 */
export const getPkgKey = (pkg) => {
  if (!pkg) return '';
  if (pkg.id) return String(pkg.id);
  if (pkg._id) return String(pkg._id);
  if (pkg.packageId) return String(pkg.packageId);
  if (pkg.code) return String(pkg.code);

  const title = pkg.packageName || pkg.title || pkg.name || '';
  const dest = pkg.destination || pkg.city || pkg.country || '';

  if (title || dest) return `${title}-${dest}`;
  return '';
};

/**
 * Checks if two package objects represent the exact same package.
 */
export const arePackagesSame = (pkg1, pkg2) => {
  if (!pkg1 || !pkg2) return false;
  if (pkg1 === pkg2) return true;

  const key1 = getPkgKey(pkg1);
  const key2 = getPkgKey(pkg2);

  if (key1 && key2) {
    return key1 === key2;
  }

  return false;
};

/**
 * Extracts filter tag keywords (ski, cruise, all-inclusive, stopover, tour).
 */
export const getPackageTags = (pkg) => {
  if (!pkg) return [];

  let rawTags = [];
  if (Array.isArray(pkg.tags)) {
    rawTags = pkg.tags.map((t) => String(t).toLowerCase());
  } else if (typeof pkg.tags === 'string') {
    rawTags = pkg.tags.toLowerCase().split(',').map((t) => t.trim());
  }

  const textToSearch = [
    pkg.packageName,
    pkg.title,
    pkg.name,
    pkg.description,
    pkg.category,
    ...rawTags,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const knownTags = ['ski', 'cruise', 'all-inclusive', 'stopover', 'tour'];
  const matched = knownTags.filter((tag) => textToSearch.includes(tag));

  return [...new Set([...rawTags, ...matched])];
};