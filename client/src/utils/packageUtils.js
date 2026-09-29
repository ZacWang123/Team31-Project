/**
 * Generates a unique key for a package item.
 */
export const getPkgKey = (pkg) => {
  if (!pkg) return '';
  return pkg.id || pkg._id || `${pkg.packageName || pkg.title || pkg.name}-${pkg.destination}`;
};

/**
 * Checks if two package objects represent the exact same package.
 */
export const arePackagesSame = (pkg1, pkg2) => {
  if (!pkg1 || !pkg2) return false;
  return getPkgKey(pkg1) === getPkgKey(pkg2);
};

/**
 * Extracts filter tag keywords (ski, cruise, all-inclusive, stopover, tour)
 * from a package's title, description, or tags array.
 */
export const getPackageTags = (pkg) => {
  if (!pkg) return [];

  // If package already has an explicit tags array
  if (Array.isArray(pkg.tags)) {
    return pkg.tags.map((t) => String(t).toLowerCase());
  }

  const textToSearch = [
    pkg.packageName,
    pkg.title,
    pkg.name,
    pkg.description,
    pkg.category,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const knownTags = ['ski', 'cruise', 'all-inclusive', 'stopover', 'tour'];
  return knownTags.filter((tag) => textToSearch.includes(tag));
};