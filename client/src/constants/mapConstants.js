// src/constants/mapConstants.js

export const FILTER_OPTIONS = [
  { id: 'beach', label: 'Beach & Coastal', icon: 'fi-br-umbrella-beach' },
  { id: 'adventure', label: 'Adventure', icon: 'fi-br-hiking' },
  { id: 'culture', label: 'Culture & History', icon: 'fi-br-book' },
  { id: 'luxury', label: 'Luxury & Leisure', icon: 'fi-br-gem' },
  { id: 'ski', label: 'Ski & Snow', icon: 'fi-rr-snowflake'},
  { id: 'stopover', label: 'Stopover', icon: 'fi-rr-route'},
];


export const TIMEOUT_CONFIG = {
  WARNING_TIME_MS: 25 * 60 * 1000, // 25 minutes
  LOGOUT_TIME_MS: 30 * 60 * 1000,  // 30 minutes
};