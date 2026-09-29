/**
 * MapLibre default camera position and animation parameters.
 */
export const MAP_DEFAULTS = {
  CENTER: [0, 20],
  ZOOM: 2,
  DURATION: 1000,
};

/**
 * Filter expression that clears dimming (matches no countries for dimming).
 */
export const EMPTY_COUNTRY_DIM_FILTER = ['in', ['get', 'ISO_A3'], ['literal', []]];

/**
 * Builds a MapLibre filter expression to dim non-matching countries.
 * Handles dataset anomalies where ISO_A3 is "-99" (e.g. France and Norway)
 * by coalescing alternative ISO attributes in priority order.
 *
 * @param {Array<string>} matchingIso3Codes - List of ISO3 codes for active packages
 * @returns {Array} MapLibre GL expression
 */
export const buildCountryDimFilter = (matchingIso3Codes = []) => [
  '!',
  [
    'in',
    ['coalesce', ['get', 'ISO_A3_EH'], ['get', 'ADM0_A3'], ['get', 'ISO_A3'], ['get', 'iso_a3']],
    ['literal', matchingIso3Codes],
  ],
];