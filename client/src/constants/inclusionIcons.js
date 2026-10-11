// Maps the icon names Flight Centre's sheet uses on inclusion items to
// Flaticon (regular-rounded) classes. Anything unknown falls back to a tick.
const INCLUSION_ICONS = {
  flight: 'fi-rr-plane',
  tour: 'fi-rr-map',
  daytour: 'fi-rr-hiking',
  transfer: 'fi-rr-bus',
  hotel: 'fi-rr-bed',
  stay: 'fi-rr-bed',
  cutlery: 'fi-rr-utensils',
  meals: 'fi-rr-utensils',
  drinks: 'fi-rr-cocktail',
  deal: 'fi-rr-tags',
  cruise: 'fi-rr-ship',
  credit: 'fi-rr-credit-card',
  dollar: 'fi-rr-dollar',
  entertainment: 'fi-rr-film',
  ticket: 'fi-rr-ticket',
  destination: 'fi-rr-map-marker',
  pin: 'fi-rr-map-marker',
  location: 'fi-rr-map-marker',
  wifi: 'fi-rr-wifi',
  holiday: 'fi-rr-umbrella-beach',
  car: 'fi-rr-car',
  carhire: 'fi-rr-car',
  motorhome: 'fi-rr-caravan',
  'road trips': 'fi-rr-road',
  rail: 'fi-rr-train',
  train: 'fi-rr-train',
  sports: 'fi-rr-basketball',
  winter: 'fi-rr-snowflake',
  family: 'fi-rr-users',
};

export function inclusionIconClass(name) {
  return INCLUSION_ICONS[(name || '').toLowerCase()] || 'fi-rr-check';
}
