import { arePackagesSame, getPkgKey, getPackageTags } from './packageUtils';

/**
 * Normalizes input package data into a flat array,
 * handling Arrays, nested Objects (like cityPackagesData), or null/undefined.
 */
const flattenPackageData = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') {
    return Object.values(data).flatMap((val) => (Array.isArray(val) ? val : [val]));
  }
  return [];
};

/**
 * FCIPT3-30: Calculates similar packages based on:
 * 1. Same destination (score +10)
 * 2. Shared tags (ski/cruise/all-inclusive/stopover/tour) (+1 per tag match)
 */
export const getSimilarPackages = (selectedPackage, packagesData = [], limit = 4) => {
  if (!selectedPackage) return [];

  const safeData = flattenPackageData(packagesData);

  if (safeData.length === 0) {
    return [];
  }

  const currentTags = getPackageTags(selectedPackage);

  const scored = safeData
    .filter((pkg) => pkg && typeof pkg === 'object' && !arePackagesSame(pkg, selectedPackage))
    .map((pkg) => {
      const sameDestination =
        pkg.destination && selectedPackage.destination
          ? pkg.destination.toLowerCase() === selectedPackage.destination.toLowerCase()
          : false;

      const sharedTagCount = getPackageTags(pkg).filter((t) => currentTags.includes(t)).length;
      const score = (sameDestination ? 10 : 0) + sharedTagCount;
      return { pkg, score };
    })
    .sort((a, b) => b.score - a.score);

  const seen = new Set();
  const result = [];

  for (const { pkg } of scored) {
    const key = getPkgKey(pkg);
    const uniqueKey = key || pkg.packageName || pkg.title || JSON.stringify(pkg);
    if (!seen.has(uniqueKey)) {
      seen.add(uniqueKey);
      result.push(pkg);
      if (result.length >= limit) break;
    }
  }

  return result;
};