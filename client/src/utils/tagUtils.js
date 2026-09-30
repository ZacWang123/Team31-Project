// src/utils/tagUtils.js



export const TAG_RULES = [

  // --- Category Filters (matches FILTER_OPTIONS in mapConstants) ---

  {

    id: 'beach',

    label: 'Beach & Coastal',

    icon: 'fi-br-umbrella-beach',

    test: /beach|coastal|cruise|sail|island|resort|ocean/i,

  },

  {

    id: 'adventure',

    label: 'Adventure',

    icon: 'fi-br-hiking',

    test: /hiking|trek|safari|expedition|climb|mountains|wildlife/i,

  },

  {

    id: 'culture',

    label: 'Culture & History',

    icon: 'fi-br-landmark',

    test: /history|temple|tour|heritage|castle|museum|explorer|discovery/i,

  },

  {

    id: 'luxury',

    label: 'Luxury & Leisure',

    icon: 'fi-br-gem',

    test: /resort|credit|luxury|suite|villa|5-star|all-inclusive/i,

  },



  // --- Specific Travel Types ---

  { id: 'ski', label: 'Ski & Snow', icon: 'fi-rr-snowflake', test: /ski|snow/i },

  { id: 'stopover', label: 'Stopover', icon: 'fi-rr-route', test: /stopover/i },

];



export function getPackageTags(pkg) {

  const tags = [];

  const title = pkg.packageName || pkg.title || pkg.name || '';

  const haystack = `${title} ${pkg.wowFactor || ''} ${pkg.destination || ''} ${pkg.city || ''}`;



  TAG_RULES.forEach((rule) => {

    if (rule.test.test(haystack)) {

      tags.push(rule.id);

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

  return (

    item &&

    typeof item.lat === 'number' &&

    typeof item.lon === 'number' &&

    !Number.isNaN(item.lat) &&

    !Number.isNaN(item.lon)

  );

}



export function matchesPackage(pkg, query, filters = []) {

  // Check active category/tag filters

  const matchesFilter =

    !filters.length ||

    filters.some((filter) => getPackageTags(pkg).includes(filter));



  // Check search text query

  const text = [

    pkg.packageName,

    pkg.title,

    pkg.name,

    pkg.city,

    pkg.destination,

    pkg.wowFactor,

    packageCountry(pkg),

  ]

    .filter(Boolean)

    .join(' ')

    .toLocaleLowerCase();



  const matchesQuery = !query || text.includes(query.toLocaleLowerCase());



  return matchesFilter && matchesQuery;

}