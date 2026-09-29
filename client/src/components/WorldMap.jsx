import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import cityPackagesData from '../data/cityPackages.json';
import PackageSearch from './PackageSearch';
import { useTravelProfile } from '../context/TravelProfileContext';
import './WorldMap.css';
import { generateConsultantReport } from '../utils/ProfileExport';
import MapControls from './MapControls';
import FilterPanel from './FilterPanel';
import PackageDetailModal from './PackageDetailModal';
import TravelProfileModal from './TravelProfileModal';
import { getSimilarPackages } from '../utils/packageRecommendations';
import { arePackagesSame, getPkgKey, getPackageTags } from '../utils/packageUtils';

// FCIPT3-25: packages now come from the live database (synced from Flight
// Centre's Google Sheet) instead of the bundled packages.json. City-level
// pins (cityPackagesData, above) are a separate, still-static dataset -
// out of scope for this ticket.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

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

// Country/city/place, extracted from Flight Centre's own supplier image
// paths and package titles (not guessed) - see server/src/services/
// transform.js, which enriches each row on sync from the live database.
// Falls back to whatever level of detail actually exists rather than
// repeating a level or inventing one.
function formatLocationPath(pkg) {
  if (!pkg) return '';
  const parts = [];
  if (pkg.country) parts.push(pkg.country);
  if (pkg.city && pkg.city !== pkg.country) parts.push(pkg.city);
  if (pkg.place) parts.push(pkg.place);
  return parts.length > 0 ? parts.join(' › ') : (pkg.destination || '');
}

function hasCoordinates(pkg) {
  const lat = Number(pkg?.lat);
  const lon = Number(pkg?.lon);
  return pkg?.lat != null && pkg?.lon != null && Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && !(lat === 0 && lon === 0);
}

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
function packageCountry(pkg) {
  if (pkg.country) return pkg.country;
  try {
    return pkg.iso2 ? countryNames.of(String(pkg.iso2).toUpperCase()) : '';
  } catch {
    return '';
  }
}

function searchLocation(pkg) {
  return [pkg.city, pkg.destination, packageCountry(pkg)]
    .filter((part, index, parts) => part && parts.indexOf(part) === index).join(' · ');
}

function matchesPackage(pkg, query, filters) {
  const matchesFilter = !filters.length || filters.some((filter) => getPackageTags(pkg).includes(filter));
  const text = [pkg.packageName, pkg.title, pkg.name, pkg.city, pkg.destination, packageCountry(pkg)]
    .filter(Boolean).join(' ').toLocaleLowerCase();
  return matchesFilter && (!query || text.includes(query));
}

function buildDestinations(packagesData) {
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
    if (!hasCoordinates(entry) && hasCoordinates(pkg)) {
      entry.lat = Number(pkg.lat);
      entry.lon = Number(pkg.lon);
    }

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
    if (!hasCoordinates(entry) && hasCoordinates(pkg)) {
      entry.lat = Number(pkg.lat);
      entry.lon = Number(pkg.lon);
    }
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSearchPackage, setSelectedSearchPackage] = useState(null);

const NOMINATED_STORE_EMAIL = "team31qut736@gmail.com";
const [profileName, setProfileName] = useState("");
const [profileEmail, setProfileEmail] = useState("");
const [profilePhone, setProfilePhone] = useState("");
const [sendToSelf, setSendToSelf] = useState(true);
const [sendToStore, setSendToStore] = useState(true);
const [saveProfileLocal, setSaveProfileLocal] = useState(true);
const [receiveDeals, setReceiveDeals] = useState(false);

  // FCIPT3-25: live database instead of a bundled JSON import. Editing the
  // Google Sheet and re-syncing changes what shows here with no rebuild.
  const [packagesData, setPackagesData] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packagesError, setPackagesError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE_URL}/api/packages`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setPackagesData(Array.isArray(data) ? data : []);
        setPackagesLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load packages from the live database:', err);
        setPackagesError(err.message);
        setPackagesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const destinations = useMemo(() => buildDestinations(packagesData), [packagesData]);
  const cityIndex = useMemo(() => buildCityIndex(), []);
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const matchingPackages = useMemo(() =>
    [...packagesData, ...cityPackagesData].filter((pkg) => matchesPackage(pkg, normalizedSearch, activeFilters)),
  [packagesData, normalizedSearch, activeFilters]);
  const visiblePackagesRef = useRef(new Set());
  visiblePackagesRef.current = new Set(matchingPackages);

  const updateSearch = (value) => {
    setSearchQuery(value);
    setSelectedSearchPackage(null);
  };

  const selectSearchResult = (pkg) => {
    setSelectedSearchPackage(pkg);
    if (popupRef.current) popupRef.current.remove();
    if (cityPopupRef.current) cityPopupRef.current.remove();
    if (hasCoordinates(pkg)) {
      mapInstanceRef.current?.flyTo({
        center: [Number(pkg.lon), Number(pkg.lat)],
        zoom: Math.max(mapInstanceRef.current.getZoom(), 5),
        duration: 1200,
        essential: true,
      });
    }
    trackPackageClick(pkg);
    setSelectedPackage(pkg);
  };

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

  const handleSaveProfile = async (profileData) => {
    console.log('Saving profile data:', profileData);

    const {
      name: profileName,
      email: profileEmail,
      phone: profilePhone,
      sendToSelf,
      sendToStore,
      saveProfileLocal,
      receiveDeals,
    } = profileData;

    if (sendToSelf && !profileEmail) {
      alert("Please enter an email address.");
      return;
    }

    const payload = {
      user: {
        name: profileName,
        email: profileEmail,
        phone: profilePhone,
        receiveDeals,
      },
      savedPackages,
      viewedPackages,
      favouriteActivities: topSavedFilters,
      timestamp: new Date().toISOString(),
    };

    if (saveProfileLocal) {
      localStorage.setItem('user_travel_profile', JSON.stringify(payload));
    }

    try {
      if (sendToSelf) {
        await fetch(`${API_BASE_URL}/api/send-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: profileEmail,
            type: 'CUSTOMER_COPY',
            data: payload,
          }),
        });
      }

      if (sendToStore) {
        await fetch(`${API_BASE_URL}/api/send-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: NOMINATED_STORE_EMAIL,
            type: 'STORE_LEAD',
            data: payload,
          }),
        });
      }

      alert("Email sent successfully!");
      setIsProfileOpen(false);
    } catch (err) {
      console.error("Failed to send email:", err);
      alert("Could not reach backend server on http://localhost:4000");
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (packagesLoading) return;

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
        if (!hasCoordinates(dest)) return;
        const el = document.createElement('div');
        el.className = 'country-pin';

        el.addEventListener('click', (e) => {
          e.stopPropagation();

          const shownPackages = dest.packages.filter((pkg) => visiblePackagesRef.current.has(pkg));
          if (!shownPackages.length) return;
          const shownDest = { ...dest, packages: shownPackages };

          preZoomViewRef.current = { center: map.getCenter().toArray(), zoom: map.getZoom() };
          activeDestRef.current = shownDest;

          popupSessionRef.current += 1;
          const session = popupSessionRef.current;

          if (popupRef.current) {
            popupRef.current.remove();
          }

          const popup = new maplibregl.Popup({ offset: 20, closeButton: true, maxWidth: 'none' })
            .setLngLat([dest.lon, dest.lat])
            .setHTML(buildPopupHTML(shownDest, savedPackagesRef.current))
            .addTo(map);

          const popupElem = popup.getElement();
          if (popupElem) {
            popupElem.addEventListener('click', (ev) => {
              const saveBtn = ev.target.closest('.save-package-btn');
              if (saveBtn) {
                ev.stopPropagation();
                const indexAttr = saveBtn.getAttribute('data-index');
                const targetPkg = shownPackages[parseInt(indexAttr, 10)];
                if (targetPkg) {
                  toggleSavePackage(targetPkg);
                }
                return;
              }

              const cardEl = ev.target.closest('.package-card');
              if (cardEl) {
                const indexAttr = cardEl.getAttribute('data-index');
                const targetPkg = shownPackages[parseInt(indexAttr, 10)];
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
  }, [destinations, packagesLoading]);

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

    /* World view: keep country pins; matching city pins can also show during search. */
    if (!activeCountry) {
      markersRef.current.forEach(({ element }) => {
        if (element) element.style.display = '';
      });
    } else {
      markersRef.current.forEach(({ element }) => {
        if (element) element.style.display = 'none';
      });
    }

    const cities = activeCountry
      ? cityIndexRef.current[activeCountry] || []
      : normalizedSearch
        ? Object.values(cityIndexRef.current).flat().filter((city) =>
            city.packages.some((pkg) => visiblePackagesRef.current.has(pkg)))
        : [];

    cities.forEach((city) => {
      if (!hasCoordinates(city)) return;
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
        const shownPackages = city.packages.filter((pkg) => visiblePackagesRef.current.has(pkg));
        if (!shownPackages.length) return;
        const shownCity = { ...city, packages: shownPackages };
        if (cityPopupRef.current) cityPopupRef.current.remove();
        if (popupRef.current) popupRef.current.remove();

        cityExpandedRef.current = false;
        activeCityRef.current = shownCity;

        cityMarkersRef.current.forEach(({ element }) => element.classList.remove('is-active'));
        el.classList.add('is-active');

        const popup = new maplibregl.Popup({
          offset: 22,
          closeButton: true,
          maxWidth: 'none',
          className: 'city-popup',
        })
          .setLngLat([city.lon, city.lat])
          .setHTML(buildCityPopupHTML(shownCity, savedPackagesRef.current, false))
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
              popup.setHTML(buildCityPopupHTML(shownCity, savedPackagesRef.current, cityExpandedRef.current));
              return;
            }

            /* Save / unsave */
            const saveBtn = ev.target.closest('.save-package-btn');
            if (saveBtn) {
              ev.stopPropagation();
              const list = cityExpandedRef.current
                ? shownPackages
                : shownPackages.slice(0, CITY_PREVIEW_LIMIT);
              const targetPkg = list[parseInt(saveBtn.getAttribute('data-index'), 10)];
              if (targetPkg) toggleSavePackage(targetPkg);
              return;
            }

            /* Open the full package detail modal */
            const cardEl = ev.target.closest('.package-card');
            if (cardEl) {
              const list = cityExpandedRef.current
                ? shownPackages
                : shownPackages.slice(0, CITY_PREVIEW_LIMIT);
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
  }, [activeCountry, normalizedSearch, matchingPackages, mapLoaded]);

  /* Keep search, filters, and marker highlighting in sync. */
  useEffect(() => {
    cityMarkersRef.current.forEach(({ element, city }) => {
      if (!element) return;
      const matches = city.packages.some((pkg) => visiblePackagesRef.current.has(pkg));
      element.classList.toggle('is-dimmed', !matches);
      element.classList.toggle('is-search-match', Boolean(selectedSearchPackage && city.packages.includes(selectedSearchPackage)));
    });
  }, [matchingPackages, selectedSearchPackage, activeCountry, mapLoaded]);

  useEffect(() => {
    if (popupRef.current) popupRef.current.remove();
    if (cityPopupRef.current) cityPopupRef.current.remove();
  }, [searchQuery, activeFilters]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded || !map.isStyleLoaded()) return;

    // IMPORTANT: use marker.setOpacity(), not element.style.opacity directly -
    // MapLibre's Marker re-applies its own internal opacity on every map
    // render (including mid-flyTo/fitBounds), so a raw style write gets
    // silently clobbered back to 1 the moment the camera next moves. (This
    // exact regression has landed on main three times now via merges that
    // reintroduce the old pattern - if you're resolving a merge conflict
    // here, keep this version.)
    markersRef.current.forEach(({ marker, element, destination }) => {
      const matches = destination.packages.some((pkg) => visiblePackagesRef.current.has(pkg));
      if (marker && typeof marker.setOpacity === 'function') {
        marker.setOpacity(matches ? '1' : '0');
      }
      if (element) {
        element.style.pointerEvents = matches ? 'auto' : 'none';
        element.classList.toggle('is-search-match', Boolean(selectedSearchPackage && destination.packages.includes(selectedSearchPackage)));
        element.style.display = !activeCountry || (selectedSearchPackage && destination.packages.includes(selectedSearchPackage)) ? '' : 'none';
      }
    });

    try {
      if (activeFilters.length === 0 && !normalizedSearch) {
        map.setFilter('country-dim-overlay', ['in', ['get', 'ISO_A3'], ['literal', []]]);
        return;
      }

      const matchingIso3 = [...new Set(matchingPackages.map((pkg) => pkg.iso3).filter(Boolean))];

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
  }, [matchingPackages, selectedSearchPackage, activeCountry, activeFilters, normalizedSearch, mapLoaded, destinations]);

  const toggleFilter = (filterId) => {
    setSelectedSearchPackage(null);
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
    const allPackages = packagesData || cityPackagesData || [];
    return getSimilarPackages(selectedPackage, allPackages, 4);
  }, [selectedPackage, packagesData]);

  const handleResetMap = () => {
    // Clear active filters if the state setter exists
    if (typeof setActiveFilters === 'function') {
      setActiveFilters([]);
    }

    // Clear package selections if state setters exist
    if (typeof setSelectedSearchPackage === 'function') setSelectedSearchPackage(null);
    if (typeof setSelectedPackage === 'function') setSelectedPackage(null);

    // Close open popups
    if (popupRef.current) popupRef.current.remove();
    if (cityPopupRef.current) cityPopupRef.current.remove();

    // Reset country view and camera
    if (typeof setActiveCountry === 'function') setActiveCountry(null);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo({ center: [0, 20], zoom: 2, duration: 1000 });
    }
  };

  const handleBackToWorld = () => {
    if (cityPopupRef.current) cityPopupRef.current.remove();
    if (typeof setActiveCountry === 'function') setActiveCountry(null);
    mapInstanceRef.current?.flyTo({ center: [0, 20], zoom: 2, duration: 1000 });
  };

  return (
    <div className="world-map-layout">
      <div ref={mapContainerRef} className="map-full-container" />

      {packagesLoading && (
        <div className="live-db-status live-db-loading">
          <span className="live-db-spinner" aria-hidden="true" />
          Loading live package data&hellip;
        </div>
      )}

      {!packagesLoading && packagesError && (
        <div className="live-db-status live-db-error">
          Couldn't reach the live database ({packagesError}). Is the server running on {API_BASE_URL}?
        </div>
      )}

      <MapControls
        activeCountry={activeCountry}
        onBackToWorld={handleBackToWorld}
        onZoomIn={() => mapInstanceRef.current?.zoomIn()}
        onZoomOut={() => mapInstanceRef.current?.zoomOut()}
        onReset={handleResetMap}
      />

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

    <TravelProfileModal
      isOpen={isProfileOpen}
      onClose={() => setIsProfileOpen(false)}
      viewedPackages={viewedPackages}
      savedPackages={savedPackages}
      topSavedFilters={topSavedFilters}
      filterOptions={FILTER_OPTIONS}
      formatLocationPath={formatLocationPath}
      toggleSavePackage={toggleSavePackage}
      onSaveProfile={handleSaveProfile}
      nominatedStoreEmail={NOMINATED_STORE_EMAIL}
    />

      <PackageDetailModal
        selectedPackage={selectedPackage}
        onClose={() => setSelectedPackage(null)}
        formatLocationPath={formatLocationPath}
        selectedPkgTitle={selectedPkgTitle}
        similarPackages={similarPackages}
        trackPackageClick={trackPackageClick}
        onSelectPackage={setSelectedPackage}
        toggleSavePackage={toggleSavePackage}
        isPackageSaved={isPackageSaved}
      />

      <FilterPanel
        searchQuery={searchQuery}
        onQueryChange={updateSearch}
        matchingPackages={matchingPackages}
        searchLocation={searchLocation}
        onSelectSearchResult={selectSearchResult}
        packagesLoading={packagesLoading}
        filterOptions={FILTER_OPTIONS}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
      />
    </div>
  );
}
 