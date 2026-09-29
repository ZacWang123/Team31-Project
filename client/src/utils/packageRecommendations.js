import { arePackagesSame, getPkgKey, getPackageTags } from './packageUtils';

/**
 * FCIPT3-30: Calculates similar packages based on:
 * 1. Same destination (score +10)
 * 2. Shared tags (ski/cruise/all-inclusive/stopover/tour) (+1 per tag match)
 * Highest score first, capped at `limit` items.
 *
 * @param {Object} selectedPackage - Currently selected package
 * @param {Array} packagesData - Full list of available packages
 * @param {number} limit - Max recommendations to return (default: 4)
 * @returns {Array} List of up to `limit` recommended packages
 */
export const getSimilarPackages = (selectedPackage, packagesData = [], limit = 4) => {
  if (!selectedPackage) return [];
  
  const currentTags = getPackageTags(selectedPackage);
  const safeData = Array.isArray(packagesData) ? packagesData : [];

  const scored = safeData
    .filter((pkg) => pkg && !arePackagesSame(pkg, selectedPackage))
    .map((pkg) => {
      const sameDestination = pkg.destination === selectedPackage.destination;
      const sharedTagCount = getPackageTags(pkg).filter((t) => currentTags.includes(t)).length;
      const score = (sameDestination ? 10 : 0) + sharedTagCount;
      return { pkg, score };
    })
    .sort((a, b) => b.score - a.score);

  const seen = new Set();
  const result = [];
  
  for (const { pkg } of scored) {
    const key = getPkgKey(pkg);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(pkg);
      if (result.length >= limit) break;
    }
  }

  return result;
};