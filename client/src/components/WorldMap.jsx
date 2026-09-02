import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import packagesData from '../data/packages.json';
import cityPackagesData from '../data/cityPackages.json';
import { useTravelProfile } from '../context/TravelProfileContext';
import './WorldMap.css';
import { generateConsultantReport } from '../utils/ProfileExport';

/* FCIPT3-10: how many packages a city pin shows before "browse more" appears */
const CITY_PREVIEW_LIMIT = 3;

/* Above this zoom we consider the user to be looking at a single country */
const COUNTRY_ZOOM_THRESHOLD = 3.5;

const MAPTILER_KEY = 'b2kWQSPaeDhJ5B2PDkVO';
const MAP_STYLE = `https://api.maptiler.com/maps/basic-v2/style.json?key=${MAPTILER_KEY}`;

const WORLD_GEOJSON_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

const TAG_RULES = [
  { id: 'ski', label: 'Ski & Snow', test: /ski|snow/i },
  { id: 'cruise', label: 'Cruise', test: /cruise|sail/i },
  { id: 'all-inclusive', label: 'All-Inclusive', test: /all-inclusive/i },
  { id: 'stopover', label: 'Stopover', test: /stopover/i },
  { id: 'tour', label: 'Tours & Expeditions', test: /tour|express|explorer|discovery|expedition/i },
];

const FILTER_OPTIONS = TAG_RULES.map(({ id, label }) => ({ id, label }));

const customZoomViews = {
  Australia: { center: [133.7751, -25.2744], zoom: 4.6 },
  'United States': { center: [-95.7129, 37.0902], zoom: 4.6 },
  Canada: { center: [-106.3468, 56.1304], zoom: 4.6 },
  'New Zealand': { center: [174.886, -40.9006], zoom: 4.6 },
};

const arePackagesSame = (pkgA, pkgB) => {
  if (!pkgA || !pkgB) return false;
  const idA = typeof pkgA === 'string' ? pkgA : (pkgA.id || pkgA.packageName || pkgA.title);
  const idB = typeof pkgB === 'string' ? pkgB : (pkgB.id || pkgB.packageName || pkgB.title);
  if (!idA || !idB) return false;
  return String(idA).trim() === String(idB).trim();
};

const getPkgKey = (pkg) => {
  if (!pkg) return '';
  if (typeof pkg === 'string') return pkg.trim();
  return String(pkg.id || pkg.packageName || pkg.title || '').trim();
};

// Country/city/place, extracted from Flight Centre's own supplier image
// paths and package titles in FlightCentre_DB.csv (not guessed) - see
// client/src/data/packages.json. Falls back to whatever level of detail
// actually exists rather than repeating a level or inventing one.
function formatLocationPath(pkg) {
  if (!pkg) return '';
  const parts = [];
  if (pkg.country) parts.push(pkg.country);
  if (pkg.city && pkg.city !== pkg.country) parts.push(pkg.city);
  if (pkg.place) parts.push(pkg.place);
  return parts.length > 0 ? parts.join(' › ') : (pkg.destination || '');
}

function getPackageTags(pkg) {
  const tags = [];
  const title = pkg.packageName || pkg.title || pkg.name || '';
  const haystack = `${title} ${pkg.wowFactor || ''} ${pkg.destination || ''}`;
  TAG_RULES.forEach(({ id }) => {
    const rule = TAG_RULES.find((r) => r.id === id);
    if (rule && rule.test.test(haystack)) {
      tags.push(id);
    }
  });
  return tags;
}

function buildDestinations() {
  const byDestination = new Map();
  const safeData = Array.isArray(packagesData) ? packagesData : [];

  safeData.forEach((pkg) => {
    if (!pkg || !pkg.destination) return;
    if (!byDestination.has(pkg.destination)) {
      byDestination.set(pkg.destination, {
        destination: pkg.destination,
        country: pkg.country || '',
        lat: pkg.lat || 0,
        lon: pkg.lon || 0,
        iso3: pkg.iso3 || '',
        tags: new Set(),
        packages: [],
      });
    }
    const entry = byDestination.get(pkg.destination);
    entry.packages.push(pkg);

    const tags = getPackageTags(pkg);
    tags.forEach((t) => entry.tags.add(t));
  });

  return Array.from(byDestination.values()).map((d) => ({
    ...d,
    tags: Array.from(d.tags),
  }));
}

/*
 * FCIPT3-10
 * Groups the flat cityPackages.json array into { ISO3: [city, city, ...] }.
 * Cities are ordered by package count, so "popular as per the associated
 * travel packages" is what decides which pins read as most prominent.
 */
function buildCityIndex() {
  const byCountry = new Map();
  const safeData = Array.isArray(cityPackagesData) ? cityPackagesData : [];

  safeData.forEach((pkg) => {
    if (!pkg || !pkg.iso3 || !pkg.city) return;

    const iso3 = String(pkg.iso3).toUpperCase();
    if (!byCountry.has(iso3)) byCountry.set(iso3, new Map());
    const cities = byCountry.get(iso3);

    if (!cities.has(pkg.city)) {
      cities.set(pkg.city, {
        name: pkg.city,
        lat: pkg.lat || 0,
        lon: pkg.lon || 0,
        iso2: pkg.iso2 || '',
        iso3,
        tags: new Set(),
        packages: [],
      });
    }

    const entry = cities.get(pkg.city);
    entry.packages.push(pkg);
    getPackageTags(pkg).forEach((t) => entry.tags.add(t));
  });

  const index = {};
  byCountry.forEach((cities, iso3) => {
    index[iso3] = Array.from(cities.values())
      .map((c) => ({ ...c, tags: Array.from(c.tags) }))
      .sort((a, b) => b.packages.length - a.packages.length);
  });
  return index;
}

/*
 * Natural Earth sets ISO_A3 to "-99" for some countries (France, Norway).
 * ISO_A3_EH and ADM0_A3 carry the real code, so try those first.
 */
function resolveIso3(props) {
  if (!props) return null;
  const candidates = [
    props.ISO_A3_EH,
    props.ADM0_A3,
    props.ISO_A3,
    props.iso_a3,
    props.adm0_a3,
  ];
  for (const candidate of candidates) {
    const value = candidate ? String(candidate).trim().toUpperCase() : '';
    if (value && value !== '-99' && value.length === 3) return value;
  }
  return null;
}

/* Bounding box around a country's cities, with a little breathing room. */
function boundsForCities(cities) {
  if (!cities || cities.length === 0) return null;

  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;

  cities.forEach(({ lon, lat }) => {
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  });

  const padLon = Math.max((east - west) * 0.25, 1.5);
  const padLat = Math.max((north - south) * 0.25, 1.5);

  return [
    [Math.max(west - padLon, -179), Math.max(south - padLat, -85)],
    [Math.min(east + padLon, 179), Math.min(north + padLat, 85)],
  ];
}

/*
 * FCIPT3-10 city popup.
 * Shows at most CITY_PREVIEW_LIMIT packages, with a button to reveal the rest.
 * Reuses the existing .package-card / .browse-more-btn styles so city and
 * country popups stay visually consistent.
 */
function buildCityPopupHTML(city, savedPackages = [], expanded = false) {
  const total = city.packages.length;
  const visiblePackages = expanded ? city.packages : city.packages.slice(0, CITY_PREVIEW_LIMIT);
  const remainingCount = total - visiblePackages.length;

  const packagesHTML = visiblePackages
    .map((pkg, index) => {
      const imgSrc =
        pkg.imageUrl ||
        pkg.image ||
        'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80';

      const price = pkg.fromPrice ? `$${pkg.fromPrice.toLocaleString('en-AU')}` : null;
      const title = pkg.packageName || pkg.title || pkg.name || 'Package';
      const isSaved = savedPackages.some((saved) => arePackagesSame(saved, pkg));
      const pkgKey = getPkgKey(pkg);

      return `
        <div class="package-card" data-index="${index}" data-pkg-key="${pkgKey}">
          <div class="thumbnail-wrapper">
            <img src="${imgSrc}" alt="${title}" class="thumbnail-img" />
            ${price ? `<span class="price-tag">From ${price}</span>` : ''}
            <button class="save-package-btn ${isSaved ? 'saved' : ''}" data-index="${index}" data-pkg-key="${pkgKey}">
              <span class="btn-text-default">${isSaved ? '❤️ Saved' : '🤍 Save'}</span>
              <span class="btn-text-hover">Remove from saved</span>
            </button>
          </div>
          <div class="card-body">
            <div class="package-title">${title}</div>
            ${pkg.wowFactor ? `<div class="wow-factor">${pkg.wowFactor}</div>` : ''}
          </div>
        </div>
      `;
    })
    .join('');

  const showingLabel = expanded
    ? `Showing all ${total} package${total > 1 ? 's' : ''}`
    : `Showing ${visiblePackages.length} of ${total} package${total > 1 ? 's' : ''}`;

  return `
    <div class="popup-container">
      <div class="popup-header-wrapper">
        <span class="popup-dest-region">City</span>
        <span class="popup-dest-name">${city.name}</span>
        <span class="popup-dest-count">${showingLabel}</span>
      </div>
      <div class="package-list">${packagesHTML}</div>
      ${
        remainingCount > 0
          ? `<button class="browse-more-btn" data-action="expand">Browse ${remainingCount} more package${remainingCount > 1 ? 's' : ''} in ${city.name}</button>`
          : ''
      }
      ${
        expanded && total > CITY_PREVIEW_LIMIT
          ? `<button class="browse-more-btn" data-action="collapse">Show fewer</button>`
          : ''
      }
    </div>
  `;
}

function buildPopupHTML(dest, savedPackages = []) {
  const maxVisible = 4;
  const visiblePackages = dest.packages.slice(0, maxVisible);
  const remainingCount = dest.packages.length - maxVisible;

  const packagesHTML = visiblePackages
    .map((pkg, index) => {
      const imgSrc =
        pkg.imageUrl ||
        pkg.image ||
        'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80';

      const price = pkg.fromPrice
        ? `$${pkg.fromPrice.toLocaleString('en-AU')}`
        : null;

      const title = pkg.packageName || pkg.title || pkg.name || 'Package';
      const isSaved = savedPackages.some((saved) => arePackagesSame(saved, pkg));
      const pkgKey = getPkgKey(pkg);

      return `
        <div class="package-card" data-index="${index}" data-pkg-key="${pkgKey}">
          <div class="thumbnail-wrapper">
            <img src="${imgSrc}" alt="${title}" class="thumbnail-img" />
            ${price ? `<span class="price-tag">From ${price}</span>` : ''}
            <button class="save-package-btn ${isSaved ? 'saved' : ''}" data-index="${index}" data-pkg-key="${pkgKey}">
              <span class="btn-text-default">${isSaved ? '❤️ Saved' : '🤍 Save'}</span>
              <span class="btn-text-hover">Remove from saved</span>
            </button>
          </div>
          <div class="card-body">
            <div class="package-title">${title}</div>
            ${pkg.wowFactor ? `<div class="wow-factor">${pkg.wowFactor}</div>` : ''}
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="popup-container">
      <div class="popup-header-wrapper">
        ${dest.country && dest.country !== dest.destination ? `<span class="popup-dest-country">${dest.country}</span>` : ''}
        <span class="popup-dest-name">${dest.destination}</span>
        <span class="popup-dest-count">${dest.packages.length} package${dest.packages.length > 1 ? 's' : ''} available</span>
      </div>
      <div class="package-list">${packagesHTML}</div>
      ${
        remainingCount > 0
          ? `<button class="browse-more-btn">Browse ${remainingCount} more package${remainingCount > 1 ? 's' : ''}</button>`
          : ''
      }
    </div>
  `;
}

export default function WorldMap() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const popupRef = useRef(null);
  const preZoomViewRef = useRef(null);
  const popupSessionRef = useRef(0);
  const activeDestRef = useRef(null);

  /* FCIPT3-10 */
  const cityMarkersRef = useRef([]);
  const cityPopupRef = useRef(null);
  const cityExpandedRef = useRef(false);
  const activeCityRef = useRef(null);
  const activeCountryRef = useRef(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeCountry, setActiveCountry] = useState(null);
  const [activeFilters, setActiveFilters] = useState([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState('saved');
  const [selectedPackage, setSelectedPackage] = useState(null);

  const travelContext = useTravelProfile() || {};
  const {
    savedPackages = [],
    viewedPackages = [],
    toggleSavePackage = () => {},
    trackFilterClick = () => {},
    trackPackageClick = () => {},
    resetProfile = () => {},
  } = travelContext;

  const savedPackagesRef = useRef(savedPackages);
  useEffect(() => {
    savedPackagesRef.current = savedPackages;

    if (popupRef.current && activeDestRef.current) {
      popupRef.current.setHTML(buildPopupHTML(activeDestRef.current, savedPackages));
    }

    if (cityPopupRef.current && activeCityRef.current) {
      cityPopupRef.current.setHTML(
        buildCityPopupHTML(activeCityRef.current, savedPackages, cityExpandedRef.current)
      );
    }
  }, [savedPackages]);

  const destinations = useMemo(() => buildDestinations(), []);
  const cityIndex = useMemo(() => buildCityIndex(), []);

  const cityIndexRef = useRef(cityIndex);
  useEffect(() => {
    cityIndexRef.current = cityIndex;
  }, [cityIndex]);

  useEffect(() => {
    activeCountryRef.current = activeCountry;
  }, [activeCountry]);

  const topSavedFilters = useMemo(() => {
    const counts = {};
    savedPackages.forEach((pkg) => {
      const tags = getPackageTags(pkg);
      tags.forEach((tagId) => {
        counts[tagId] = (counts[tagId] || 0) + 1;
      });
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tagId]) => {
        const found = FILTER_OPTIONS.find((f) => f.id === tagId);
        return found ? found.id : null;
      })
      .filter(Boolean);
  }, [savedPackages]);

  const handleSaveProfile = (e) => {
    e.preventDefault();
    const formElements = e.target.elements;

    const formData = {
      fullName: formElements[0].value,
      email: formElements[1].value,
      mobile: formElements[2].value
    };

    generateConsultantReport(
      formData, 
      savedPackages, 
      viewedPackages, 
      topSavedFilters, 
      FILTER_OPTIONS, 
      formatLocationPath
    );

    setIsProfileOpen(false);
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [0, 20],
      zoom: 2,
      minZoom: 1.8,
      maxZoom: 10,
      renderWorldCopies: false,
      pitchWithRotate: false,
      dragRotate: false,
    });

    mapInstanceRef.current = map;

    map.on('load', () => {
      if (!mapInstanceRef.current) return;

      if (map.getLayer('admin_level_2')) {
        map.setPaintProperty('admin_level_2', 'line-color', '#1e293b');
        map.setPaintProperty('admin_level_2', 'line-width', 1.5);
      }

      if (!map.getSource('world-polygons')) {
        map.addSource('world-polygons', {
          type: 'geojson',
          data: WORLD_GEOJSON_URL,
        });
      }

      if (!map.getLayer('country-dim-overlay')) {
        map.addLayer({
          id: 'country-dim-overlay',
          type: 'fill',
          source: 'world-polygons',
          paint: {
            'fill-color': '#0f172a',
            'fill-opacity': 0.75,
          },
          filter: ['in', ['get', 'ISO_A3'], ['literal', []]],
        });
      }

      if (!map.getLayer('country-click-layer')) {
        map.addLayer({
          id: 'country-click-layer',
          type: 'fill',
          source: 'world-polygons',
          paint: {
            'fill-opacity': 0,
          },
        });
      }

      /* ------------------------------------------------------------------
         FCIPT3-10: tapping a country flies to it; the moveend/zoomend
         handler below then decides whether we are at "country level" and
         switches the pins over.
         ------------------------------------------------------------------ */
      map.on('click', 'country-click-layer', (e) => {
        const feature = e.features && e.features[0];
        if (!feature) return;

        const iso3 = resolveIso3(feature.properties);
        const cities = iso3 ? cityIndexRef.current[iso3] : null;
        if (!cities || cities.length === 0) return;

        if (popupRef.current) popupRef.current.remove();
        if (cityPopupRef.current) cityPopupRef.current.remove();

        const preset = customZoomViews[feature.properties?.NAME || feature.properties?.ADMIN];
        if (preset) {
          map.flyTo({ ...preset, essential: true, duration: 1200 });
          return;
        }

        const bounds = boundsForCities(cities);
        if (bounds) {
          map.fitBounds(bounds, { padding: 90, maxZoom: 7, duration: 1200, essential: true });
        }
      });

      map.on('mouseenter', 'country-click-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'country-click-layer', () => {
        map.getCanvas().style.cursor = '';
      });

      /* Work out which country (if any) fills the view, and remember it. */
      const syncCountryView = () => {
        if (!mapInstanceRef.current) return;

        if (map.getZoom() < COUNTRY_ZOOM_THRESHOLD) {
          setActiveCountry(null);
          return;
        }

        let iso3 = null;
        try {
          const centrePoint = map.project(map.getCenter());
          const hits = map.queryRenderedFeatures(centrePoint, {
            layers: ['country-click-layer'],
          });
          if (hits && hits[0]) iso3 = resolveIso3(hits[0].properties);
        } catch (err) {
          console.error('Could not identify country under map centre:', err);
        }

        setActiveCountry((prev) => {
          if (iso3 && cityIndexRef.current[iso3]) return iso3;
          /*
           * Nothing usable under the centre - usually ocean after panning to
           * a coastal city. Hold the current country rather than tearing the
           * city pins down mid-interaction.
           */
          return prev;
        });
      };

      map.on('moveend', syncCountryView);
      map.on('zoomend', syncCountryView);

      destinations.forEach((dest) => {
        const el = document.createElement('div');
        el.className = 'country-pin';

        el.addEventListener('click', (e) => {
          e.stopPropagation();

          preZoomViewRef.current = { center: map.getCenter().toArray(), zoom: map.getZoom() };
          activeDestRef.current = dest;

          popupSessionRef.current += 1;
          const session = popupSessionRef.current;

          if (popupRef.current) {
            popupRef.current.remove();
          }

          const popup = new maplibregl.Popup({ offset: 20, closeButton: true, maxWidth: 'none' })
            .setLngLat([dest.lon, dest.lat])
            .setHTML(buildPopupHTML(dest, savedPackagesRef.current))
            .addTo(map);

          const popupElem = popup.getElement();
          if (popupElem) {
            popupElem.addEventListener('click', (ev) => {
              const saveBtn = ev.target.closest('.save-package-btn');
              if (saveBtn) {
                ev.stopPropagation();
                const indexAttr = saveBtn.getAttribute('data-index');
                const targetPkg = dest.packages[parseInt(indexAttr, 10)];
                if (targetPkg) {
                  toggleSavePackage(targetPkg);
                }
                return;
              }

              const cardEl = ev.target.closest('.package-card');
              if (cardEl) {
                const indexAttr = cardEl.getAttribute('data-index');
                const targetPkg = dest.packages[parseInt(indexAttr, 10)];
                if (targetPkg) {
                  trackPackageClick(targetPkg);
                  setSelectedPackage(targetPkg);
                }
              }
            });
          }

          popup.on('close', () => {
            if (popupSessionRef.current !== session) return;
            activeDestRef.current = null;
            const view = preZoomViewRef.current;
            if (view && mapInstanceRef.current) {
              map.flyTo({ center: view.center, zoom: view.zoom, essential: true, duration: 1000 });
            }
          });

          popupRef.current = popup;

          const zoomView = customZoomViews[dest.destination];
          if (zoomView) {
            map.flyTo({ ...zoomView, essential: true, duration: 1200 });
          } else {
            map.flyTo({ center: [dest.lon, dest.lat], zoom: Math.max(map.getZoom(), 5), essential: true, duration: 1200 });
          }
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([dest.lon, dest.lat])
          .addTo(map);

        markersRef.current.push({ marker, element: el, destination: dest });
      });

      setMapLoaded(true);
    });

    return () => {
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current = [];
      cityMarkersRef.current.forEach(({ marker }) => marker.remove());
      cityMarkersRef.current = [];
      if (cityPopupRef.current) cityPopupRef.current.remove();
      if (popupRef.current) popupRef.current.remove();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [destinations]);

  /* ----------------------------------------------------------------------
     FCIPT3-10: city pins
     When a country fills the view, swap the world-level pins out for
     labelled city pins built from cityPackages.json.
     ---------------------------------------------------------------------- */
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;

    cityMarkersRef.current.forEach(({ marker }) => marker.remove());
    cityMarkersRef.current = [];

    if (cityPopupRef.current) {
      cityPopupRef.current.remove();
      cityPopupRef.current = null;
    }
    activeCityRef.current = null;
    cityExpandedRef.current = false;

    /* World view: put the country pins back. */
    if (!activeCountry) {
      markersRef.current.forEach(({ element }) => {
        if (element) element.style.display = '';
      });
      return;
    }

    /* Country view: country pins would only clutter, so hide them. */
    markersRef.current.forEach(({ element }) => {
      if (element) element.style.display = 'none';
    });

    const cities = cityIndexRef.current[activeCountry] || [];

    cities.forEach((city) => {
      const el = document.createElement('div');
      el.className = 'city-pin';
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', `${city.name}, ${city.packages.length} packages`);
      el.innerHTML = `
        <span class="city-pin-marker"></span>
        <span class="city-pin-label">
          <span class="city-pin-name"></span>
          <span class="city-pin-count"></span>
        </span>
      `;
      el.querySelector('.city-pin-name').textContent = city.name;
      el.querySelector('.city-pin-count').textContent = String(city.packages.length);

      const openCityPopup = () => {
        if (cityPopupRef.current) cityPopupRef.current.remove();
        if (popupRef.current) popupRef.current.remove();

        cityExpandedRef.current = false;
        activeCityRef.current = city;

        cityMarkersRef.current.forEach(({ element }) => element.classList.remove('is-active'));
        el.classList.add('is-active');

        const popup = new maplibregl.Popup({
          offset: 22,
          closeButton: true,
          maxWidth: 'none',
          className: 'city-popup',
        })
          .setLngLat([city.lon, city.lat])
          .setHTML(buildCityPopupHTML(city, savedPackagesRef.current, false))
          .addTo(map);

        /*
         * No map pan here. main now renders popups fixed and centred on
         * screen (see .maplibregl-popup-content), so nudging the map to make
         * room below the pin has no effect other than a jarring shift.
         */

        const popupElem = popup.getElement();
        if (popupElem) {
          popupElem.addEventListener('click', (ev) => {
            /* Browse more / show fewer */
            const browseBtn = ev.target.closest('.browse-more-btn');
            if (browseBtn) {
              ev.stopPropagation();
              cityExpandedRef.current = browseBtn.getAttribute('data-action') === 'expand';
              popup.setHTML(
                buildCityPopupHTML(city, savedPackagesRef.current, cityExpandedRef.current)
              );
              return;
            }

            /* Save / unsave */
            const saveBtn = ev.target.closest('.save-package-btn');
            if (saveBtn) {
              ev.stopPropagation();
              const list = cityExpandedRef.current
                ? city.packages
                : city.packages.slice(0, CITY_PREVIEW_LIMIT);
              const targetPkg = list[parseInt(saveBtn.getAttribute('data-index'), 10)];
              if (targetPkg) toggleSavePackage(targetPkg);
              return;
            }

            /* Open the full package detail modal */
            const cardEl = ev.target.closest('.package-card');
            if (cardEl) {
              const list = cityExpandedRef.current
                ? city.packages
                : city.packages.slice(0, CITY_PREVIEW_LIMIT);
              const targetPkg = list[parseInt(cardEl.getAttribute('data-index'), 10)];
              if (targetPkg) {
                trackPackageClick(targetPkg);
                setSelectedPackage(targetPkg);
              }
            }
          });
        }

        popup.on('close', () => {
          activeCityRef.current = null;
          cityExpandedRef.current = false;
          el.classList.remove('is-active');
        });

        cityPopupRef.current = popup;
      };

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        openCityPopup();
      });

      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openCityPopup();
        }
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([city.lon, city.lat])
        .addTo(map);

      cityMarkersRef.current.push({ marker, element: el, city });
    });
  }, [activeCountry, mapLoaded]);

  /* Dim city pins that do not match the active filters. */
  useEffect(() => {
    cityMarkersRef.current.forEach(({ element, city }) => {
      if (!element) return;
      const matches =
        activeFilters.length === 0 || activeFilters.some((f) => city.tags.includes(f));
      element.classList.toggle('is-dimmed', !matches);
    });
  }, [activeFilters, activeCountry, mapLoaded]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded || !map.isStyleLoaded()) return;

    markersRef.current.forEach(({ marker, element, destination }) => {
      const matches =
        activeFilters.length === 0 ||
        activeFilters.some((filter) => destination.tags.includes(filter));
      if (marker && marker.getElement()) {
        marker.getElement().style.opacity = matches ? '1' : '0.25';
      }
      if (element) {
        element.style.pointerEvents = matches ? 'auto' : 'none';
      }
    });

    try {
      if (activeFilters.length === 0) {
        map.setFilter('country-dim-overlay', ['in', ['get', 'ISO_A3'], ['literal', []]]);
        return;
      }

      const matchingIso3 = destinations
        .filter((d) => d.iso3 && activeFilters.some((filter) => d.tags.includes(filter)))
        .map((d) => d.iso3);

      /*
       * ISO_A3 is "-99" for France and Norway in this dataset, and coalesce
       * treats "-99" as a real value, so ISO_A3_EH / ADM0_A3 have to come first.
       */
      map.setFilter('country-dim-overlay', [
        '!',
        [
          'in',
          ['coalesce', ['get', 'ISO_A3_EH'], ['get', 'ADM0_A3'], ['get', 'ISO_A3'], ['get', 'iso_a3']],
          ['literal', matchingIso3],
        ],
      ]);
    } catch (err) {
      console.error('Failed to update map filter:', err);
    }
  }, [activeFilters, mapLoaded, destinations]);

  const toggleFilter = (filterId) => {
    if (!activeFilters.includes(filterId)) {
      trackFilterClick(filterId);
    }

    setActiveFilters((prev) =>
      prev.includes(filterId)
        ? prev.filter((id) => id !== filterId)
        : [...prev, filterId]
    );
  };

  const displayedPackages = activeProfileTab === 'saved' ? savedPackages : viewedPackages;
  const isPackageSaved = selectedPackage ? savedPackages.some((s) => arePackagesSame(s, selectedPackage)) : false;
  const selectedPkgTitle = selectedPackage ? (selectedPackage.packageName || selectedPackage.title || selectedPackage.name || 'Package') : '';

  // FCIPT3-30: "similar" = same destination first (score 10), then any shared
  // filter tag (ski/cruise/all-inclusive/stopover/tour), highest score first,
  // capped at 4 so the modal doesn't grow unbounded on well-tagged packages.
  const similarPackages = useMemo(() => {
    if (!selectedPackage) return [];
    const currentTags = getPackageTags(selectedPackage);
    const safeData = Array.isArray(packagesData) ? packagesData : [];

    // No score-floor filter here on purpose: a package with no shared
    // destination/tags (e.g. UK's only package, which doesn't match any of
    // the Ski/Cruise/All-Inclusive/Stopover/Tour keywords) would otherwise
    // score 0 against everything and the section would just vanish - which
    // reads as broken, not as "nothing relevant". Real matches (score > 0)
    // still always sort ahead of these fallback ones.
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
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(pkg);
      if (result.length >= 4) break;
    }
    return result;
  }, [selectedPackage]);

  return (
    <div className="world-map-layout">
      <div ref={mapContainerRef} className="map-full-container" />

      {activeCountry && (
        <button
          className="back-to-world-btn"
          onClick={() => {
            if (cityPopupRef.current) cityPopupRef.current.remove();
            setActiveCountry(null);
            mapInstanceRef.current?.flyTo({ center: [0, 20], zoom: 2, duration: 1000 });
          }}
        >
          <span>&larr;</span>
          <span>Back to world view</span>
        </button>
      )}

      <div className="view-profile-btn-container">
        <button
          onClick={() => {
            setSelectedPackage(null);
            setIsProfileOpen(true);
          }}
          className="view-profile-btn"
        >
          <span>View Travel Profile</span>
          <span className="profile-icon">👤</span>
        </button>
      </div>

    {isProfileOpen && (
      <div className="modal-backdrop-profile" onClick={() => setIsProfileOpen(false)}>
        <div className="modal-content-box profile-modal-wide" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header-container flight-centre-red-header">
            <div className="profile-brand-title">
              <span className="fc-logo-text">FLIGHT CENTRE</span>
              <span className="fc-sub-title">TRAVEL GROUP</span>
              <h2>Travel Profile</h2>
            </div>
            <button className="modal-close-btn" onClick={() => setIsProfileOpen(false)}>✕</button>
          </div>

          <div className="modal-body-container three-column-layout">
            {/* COLUMN 1: Preferences, Recently Viewed & Activities */}
            <div className="profile-col-left">
              <div className="profile-section-block">
                <div className="profile-section-header">Your Travel Preferences <span>▼</span></div>
                <div className="profile-section-content">
                  <p>Climate: <span className="placeholder-text">Not specified</span></p>
                  <p>Price Range: <span className="placeholder-text">Not specified</span></p>
                  <p>Travel Style: <span className="placeholder-text">Not specified</span></p>
                </div>
              </div>

              <div className="profile-section-block">
                <div className="profile-section-header">Your Recently Viewed <span>▼</span></div>
                <div className="profile-section-content">
                  {viewedPackages.slice(0, 3).map((pkg, i) => (
                    <div key={i} className="mini-list-item">{pkg.packageName || pkg.title}</div>
                  ))}
                  {viewedPackages.length === 0 && <p className="placeholder-text">No recently viewed packages</p>}
                </div>
              </div>

              <div className="profile-section-block">
                <div className="profile-section-header">Your Favourite Activities <span>▼</span></div>
                <div className="profile-section-content">
                  {topSavedFilters.length > 0 ? (
                    topSavedFilters.map((tagId) => {
                      const filterObj = FILTER_OPTIONS.find((f) => f.id === tagId);
                      return <div key={tagId} className="mini-list-item">{filterObj ? filterObj.label : tagId}</div>;
                    })
                  ) : (
                    <p className="placeholder-text">Save packages to see favourite activities</p>
                  )}
                </div>
              </div>
            </div>

            {/* COLUMN 2: Destination Shortlist */}
            <div className="profile-col-middle">
              <h3>Your Destination Shortlist</h3>
              <div className="shortlist-scroll-area">
                {savedPackages.length === 0 ? (
                  <p className="empty-shortlist">Your shortlist is empty. Save packages from the map to see them here.</p>
                ) : (
                  savedPackages.map((pkg, idx) => {
                    const imgSrc = pkg.imageUrl || pkg.image || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80';
                    const pkgTitle = pkg.packageName || pkg.title || pkg.name || 'Package';
                    return (
                      <div key={idx} className="shortlist-card">
                        <img src={imgSrc} alt={pkgTitle} className="shortlist-img" />
                        <div className="shortlist-info">
                          <span className="shortlist-dest-label">{formatLocationPath(pkg)}</span>
                          <h4>{pkgTitle}</h4>
                        </div>
                        <button 
                          className="shortlist-remove-btn" 
                          onClick={() => toggleSavePackage(pkg)}
                          title="Remove package"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* COLUMN 3: Save Your Profile Form */}
            <div className="profile-col-right">
              <h3>Save Your Profile</h3>
              <p className="save-form-instruction">
                You may enter your details here if you wish to save your profile for next time or continue with one of our travel experts.
              </p>

              <form onSubmit={handleSaveProfile}>
                <input type="text" placeholder="Full Name..." className="profile-form-input" required />
                <input type="email" placeholder="Email Address..." className="profile-form-input" />
                <div className="form-separator">OR</div>
                <input type="tel" placeholder="Mobile Number..." className="profile-form-input" />

                <div className="profile-checkbox-group">
                  <label><input type="checkbox" defaultChecked /> Save my personalised travel profile</label>
                  <label><input type="checkbox" defaultChecked /> Send my profile to Flight Centre</label>
                  <label><input type="checkbox" /> Send me personalised travel deals</label>
                </div>

                <button type="submit" className="finish-session-btn">
                  Finish & Clear Session
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    )}

      {selectedPackage && (
        <div className="modal-backdrop-package" onClick={() => setSelectedPackage(null)}>
          <div className="modal-content-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-container">
              <div>
                <span className="modal-package-dest">{formatLocationPath(selectedPackage)}</span>
                <h2 className="modal-package-title">{selectedPkgTitle}</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedPackage(null)}>✕</button>
            </div>

            <div className="modal-body-container">
              <div className="modal-hero-wrapper">
                <img
                  src={selectedPackage.imageUrl || selectedPackage.image || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80'}
                  alt={selectedPkgTitle}
                  className="modal-hero-img"
                />
                {selectedPackage.fromPrice && (
                  <span className="modal-hero-price">
                    From ${selectedPackage.fromPrice.toLocaleString('en-AU')}
                  </span>
                )}
              </div>

              {selectedPackage.wowFactor && (
                <div className="modal-wow-banner">
                  ✨ {selectedPackage.wowFactor}
                </div>
              )}

              <div className="modal-overview-section">
                <h4 className="modal-overview-heading">Overview & Details</h4>
                <p className="modal-overview-text">
                  {selectedPackage.description || selectedPackage.details || `Experience the ultimate journey to ${selectedPackage.destination}. This carefully curated package offers unforgettable sights, premium accommodations, and seamless travel arrangements tailored for explorers.`}
                </p>
              </div>

              {similarPackages.length > 0 && (
                <div className="modal-overview-section">
                  <h4 className="modal-overview-heading">You Might Also Like</h4>
                  <div className="saved-packages-grid">
                    {similarPackages.map((pkg, idx) => {
                      const imgSrc =
                        pkg.imageUrl ||
                        pkg.image ||
                        'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80';
                      const price = pkg.fromPrice ? `$${pkg.fromPrice.toLocaleString('en-AU')}` : null;
                      const title = pkg.packageName || pkg.title || pkg.name || 'Package';

                      return (
                        <div
                          key={idx}
                          className="saved-card-item"
                          onClick={() => {
                            trackPackageClick(pkg);
                            setSelectedPackage(pkg);
                          }}
                        >
                          <div className="saved-card-img-wrapper">
                            <img src={imgSrc} alt={title} className="saved-card-img" />
                            {price && <span className="saved-card-price-tag">From {price}</span>}
                          </div>
                          <div className="saved-card-body">
                            <span className="saved-card-dest">{formatLocationPath(pkg)}</span>
                            <h4 className="saved-card-title">{title}</h4>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="modal-footer-actions">
                <button
                  onClick={() => toggleSavePackage(selectedPackage)}
                  className={`modal-save-btn ${isPackageSaved ? 'saved' : ''}`}
                >
                  <span className="btn-text-default">{isPackageSaved ? '❤️ Saved' : '🤍 Save Package'}</span>
                  <span className="btn-text-hover">Remove from saved</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="filter-panel">
        <div className="filter-header">Filter Destinations</div>
        <div className="chip-container">
          {FILTER_OPTIONS.map((filter) => {
            const isActive = activeFilters.includes(filter.id);
            return (
              <button
                key={filter.id}
                onClick={() => toggleFilter(filter.id)}
                className={`filter-chip ${isActive ? 'active' : ''}`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="desktop-controls">
        <button className="desktop-btn" onClick={() => mapInstanceRef.current?.zoomIn()} title="Zoom In">+</button>
        <button className="desktop-btn" onClick={() => mapInstanceRef.current?.zoomOut()} title="Zoom Out">−</button>
        <button
          className="reset-btn"
          onClick={() => {
            setActiveFilters([]);
            mapInstanceRef.current?.flyTo({ center: [0, 20], zoom: 2, duration: 1000 });
          }}
          title="Reset View"
        >
          Reset
        </button>
      </div>
    </div>
  );
}