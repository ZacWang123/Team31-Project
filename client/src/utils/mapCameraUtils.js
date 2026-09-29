import { MAP_DEFAULTS } from '../constants/mapConstants';

/**
 * Flies the map camera back to the global default view [0, 20] at zoom 2.
 */
export const resetMapCamera = (mapInstance) => {
  if (!mapInstance) return;
  mapInstance.flyTo({
    center: MAP_DEFAULTS.CENTER,
    zoom: MAP_DEFAULTS.ZOOM,
    duration: MAP_DEFAULTS.DURATION,
  });
};

/**
 * Focuses the map camera on a specific destination coordinate.
 */
export const focusLocationCamera = (mapInstance, coordinates, zoomLevel = 5) => {
  if (!mapInstance || !coordinates || coordinates.length < 2) return;
  mapInstance.flyTo({
    center: coordinates,
    zoom: zoomLevel,
    duration: MAP_DEFAULTS.DURATION,
    essential: true,
  });
};

/**
 * Closes active popups cleanly.
 */
export const removeActivePopups = (popupRef, cityPopupRef) => {
  if (popupRef?.current) popupRef.current.remove();
  if (cityPopupRef?.current) cityPopupRef.current.remove();
};