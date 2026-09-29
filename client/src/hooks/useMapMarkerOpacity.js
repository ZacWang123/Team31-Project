import { useEffect } from 'react';
import { EMPTY_COUNTRY_DIM_FILTER, buildCountryDimFilter } from '../constants/mapConstants';

/**
 * Custom hook to synchronize MapLibre marker visibility, opacity, CSS classes,
 * and background layer dimming filters when filters or package selections change.
 */
export const useMapMarkerOpacity = ({
  mapInstanceRef,
  markersRef,
  visiblePackagesRef,
  matchingPackages,
  selectedSearchPackage,
  activeCountry,
  activeFilters,
  normalizedSearch,
  mapLoaded,
  destinations,
}) => {
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded || !map.isStyleLoaded()) return;

    // 1. Synchronize marker opacity & interactive state
    markersRef.current.forEach(({ marker, element, destination }) => {
      const matches = destination.packages.some((pkg) => visiblePackagesRef.current?.has(pkg));

      if (marker && typeof marker.setOpacity === 'function') {
        marker.setOpacity(matches ? '1' : '0');
      }

      if (element) {
        element.style.pointerEvents = matches ? 'auto' : 'none';
        element.classList.toggle(
          'is-search-match',
          Boolean(selectedSearchPackage && destination.packages.includes(selectedSearchPackage))
        );
        element.style.display =
          !activeCountry || (selectedSearchPackage && destination.packages.includes(selectedSearchPackage))
            ? ''
            : 'none';
      }
    });

    // 2. Update country dimming layer overlay filter
    try {
      if (activeFilters.length === 0 && !normalizedSearch) {
        map.setFilter('country-dim-overlay', EMPTY_COUNTRY_DIM_FILTER);
        return;
      }

      const matchingIso3 = [...new Set(matchingPackages.map((pkg) => pkg.iso3).filter(Boolean))];
      map.setFilter('country-dim-overlay', buildCountryDimFilter(matchingIso3));
    } catch (err) {
      console.error('Failed to update map dim overlay filter:', err);
    }
  }, [
    matchingPackages,
    selectedSearchPackage,
    activeCountry,
    activeFilters,
    normalizedSearch,
    mapLoaded,
    destinations,
  ]);
};