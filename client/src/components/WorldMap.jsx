import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import packagesData from '../data/packages.json';
import './WorldMap.css';

const MAPTILER_KEY = 'b2kWQSPaeDhJ5B2PDkVO';
const MAP_STYLE = `https://api.maptiler.com/maps/basic-v2/style.json?key=${MAPTILER_KEY}`;

const WORLD_GEOJSON_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

// Keyword tags derived from package name / wow-factor text (no product-category
// codebook was supplied with FlightCentre_DB.csv, so these are inferred, not
// authoritative - swap in real category labels if/when a codebook is available).
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

// Group the flat CSV rows into one pin per destination, each carrying every
// package on offer there.
function buildDestinations() {
  const byDestination = new Map();

  packagesData.forEach((pkg) => {
    if (!byDestination.has(pkg.destination)) {
      byDestination.set(pkg.destination, {
        destination: pkg.destination,
        lat: pkg.lat,
        lon: pkg.lon,
        iso3: pkg.iso3,
        tags: new Set(),
        packages: [],
      });
    }
    const entry = byDestination.get(pkg.destination);
    entry.packages.push(pkg);

    const haystack = `${pkg.packageName || ''} ${pkg.wowFactor || ''}`;
    TAG_RULES.forEach(({ id, test }) => {
      if (test.test(haystack)) entry.tags.add(id);
    });
  });

  return Array.from(byDestination.values()).map((d) => ({
    ...d,
    tags: Array.from(d.tags),
  }));
}

function formatPrice(price) {
  if (price == null) return null;
  return price.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
}

function buildPopupHTML(dest) {
  const maxVisible = 3;
  const visiblePackages = dest.packages.slice(0, maxVisible);
  const remainingCount = dest.packages.length - maxVisible;

  const packagesHTML = visiblePackages
    .map((pkg) => {
      // Use package image URL or fallback placeholder image if missing
      const imgSrc =
        pkg.imageUrl ||
        pkg.image ||
        'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80';

      const price = pkg.fromPrice
        ? `$${pkg.fromPrice.toLocaleString('en-AU')}`
        : null;

      return `
        <div class="package-card">
          <div class="thumbnail-wrapper">
            <img src="${imgSrc}" alt="${pkg.packageName || 'Package'}" class="thumbnail-img" />
            ${price ? `<span class="price-tag">From ${price}</span>` : ''}
          </div>
          <div class="card-body">
            <div class="package-title">${pkg.packageName || 'Package'}</div>
            ${pkg.wowFactor ? `<div class="wow-factor">${pkg.wowFactor}</div>` : ''}
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="popup-container">
      <div class="popup-header">${dest.destination}</div>
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

  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);

  const destinations = useMemo(() => buildDestinations(), []);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Inject global styles to override MapLibre's default constrained width and align the popup background container correctly with text sizing.
    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
      .maplibregl-popup {
        max-width: 450px !important;
      }
      .maplibregl-popup-content {
        background: #0f172a !important;
        color: #f8fafc !important;
        padding: 24px 32px !important;
        border-radius: 16px !important;
        border: 1px solid #334155 !important;
        box-shadow: 0 12px 32px rgba(0,0,0,0.6) !important;
      }
      .maplibregl-popup-close-button {
        font-size: 28px !important;
        color: #94a3b8 !important;
        padding: 6px 14px !important;
        background: transparent !important;
        border: none !important;
        cursor: pointer !important;
        line-height: 1 !important;
      }
      .maplibregl-popup-close-button:hover {
        color: #ffffff !important;
        background: rgba(255,255,255,0.08) !important;
        border-radius: 50% !important;
      }
      .maplibregl-popup-tip {
        border-top-color: #0f172a !important;
      }
    `;
    document.head.appendChild(styleTag);

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
      if (map.getLayer('admin_level_2')) {
        map.setPaintProperty('admin_level_2', 'line-color', '#1e293b');
        map.setPaintProperty('admin_level_2', 'line-width', 1.5);
      }

      map.addSource('world-polygons', {
        type: 'geojson',
        data: WORLD_GEOJSON_URL,
      });

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

      map.addLayer({
        id: 'country-click-layer',
        type: 'fill',
        source: 'world-polygons',
        paint: {
          'fill-opacity': 0,
        },
      });

      // Real destination pins, sourced from FlightCentre_DB.csv (geocoded via
      // OpenStreetMap Nominatim - see client/src/data/packages.json).
      destinations.forEach((dest) => {
        const el = document.createElement('div');
        el.className = 'country-pin';
        el.style.cssText = `
          background-color: #ff4757;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 8px rgba(0,0,0,0.6);
          cursor: pointer;
        `;

        el.addEventListener('click', (e) => {
          e.stopPropagation();

          // Remember where the camera was before flying in, so closing the
          // popup can fly back out to it. Capture this BEFORE removing any
          // existing popup, so switching directly between pins doesn't
          // clobber it with the already-zoomed-in view.
          preZoomViewRef.current = { center: map.getCenter().toArray(), zoom: map.getZoom() };

          // Bump the session so the *old* popup's 'close' handler (fired by
          // the .remove() below) knows it's stale and skips the zoom-out -
          // otherwise switching pins would zoom out then immediately back in.
          popupSessionRef.current += 1;
          const session = popupSessionRef.current;

          if (popupRef.current) {
            popupRef.current.remove();
          }

          const popup = new maplibregl.Popup({ offset: 20, closeButton: true, maxWidth: 'none' })
            .setLngLat([dest.lon, dest.lat])
            .setHTML(buildPopupHTML(dest))
            .addTo(map);

          popup.on('close', () => {
            if (popupSessionRef.current !== session) return;
            const view = preZoomViewRef.current;
            if (view) {
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

    map.on('mousemove', 'country-click-layer', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'country-click-layer', () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('click', 'country-click-layer', (e) => {
      const feature = e.features?.[0];
      if (!feature) return;

      const props = feature.properties;
      const countryName = props?.NAME_LONG || props?.ADMIN || props?.name_en || props?.name;

      if (countryName && customZoomViews[countryName]) {
        const { center, zoom } = customZoomViews[countryName];
        map.flyTo({ center, zoom, essential: true, duration: 1200 });
        return;
      }

      const bounds = new maplibregl.LngLatBounds();
      const geometry = feature.geometry;

      if (geometry) {
        const processCoords = (arr) => {
          arr.forEach((item) => {
            if (typeof item[0] === 'number') {
              bounds.extend(item);
            } else {
              processCoords(item);
            }
          });
        };
        processCoords(geometry.coordinates);

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, {
            padding: 40,
            maxZoom: 6,
            duration: 1200,
            essential: true,
          });
        }
      }
    });

    return () => {
      map.remove();
      styleTag.remove();
    };
  }, [destinations]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;

    // Pins for destinations that don't match the active filters fade out;
    // everything else (including pins with no inferred tag) stays visible.
    // IMPORTANT: use marker.setOpacity(), not element.style.opacity directly -
    // MapLibre's Marker re-applies its own internal opacity on every map
    // render (including mid-flyTo/fitBounds), so a raw style write gets
    // silently clobbered back to 1 the moment the camera next moves.
    markersRef.current.forEach(({ marker, element, destination }) => {
      const matches =
        activeFilters.length === 0 ||
        activeFilters.some((filter) => destination.tags.includes(filter));
      marker.setOpacity(matches ? '1' : '0.25');
      element.style.pointerEvents = matches ? 'auto' : 'none';
    });

    if (activeFilters.length === 0) {
      map.setFilter('country-dim-overlay', ['in', ['get', 'ISO_A3'], ['literal', []]]);
      return;
    }

    const matchingIso3 = destinations
      .filter((d) => d.iso3 && activeFilters.some((filter) => d.tags.includes(filter)))
      .map((d) => d.iso3);

    map.setFilter('country-dim-overlay', [
      '!',
      [
        'in',
        ['coalesce', ['get', 'ISO_A3'], ['get', 'iso_a3'], ['get', 'ADM0_A3']],
        ['literal', matchingIso3],
      ],
    ]);
  }, [activeFilters, mapLoaded, destinations]);

  const toggleFilter = (filterId) => {
    setActiveFilters((prev) =>
      prev.includes(filterId)
        ? prev.filter((id) => id !== filterId)
        : [...prev, filterId]
    );
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      <div style={filterPanelStyle}>
        <div style={filterHeaderStyle}>Filter Destinations</div>
        <div style={chipContainerStyle}>
          {FILTER_OPTIONS.map((filter) => {
            const isActive = activeFilters.includes(filter.id);
            return (
              <button
                key={filter.id}
                onClick={() => toggleFilter(filter.id)}
                style={{
                  ...chipStyle,
                  backgroundColor: isActive ? '#0284c7' : '#1e293b',
                  borderColor: isActive ? '#38bdf8' : '#475569',
                  color: isActive ? '#ffffff' : '#cbd5e1',
                }}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={desktopControlsStyle}>
        <button
          style={desktopBtnStyle}
          onClick={() => mapInstanceRef.current?.zoomIn()}
          title="Zoom In"
        >
          +
        </button>
        <button
          style={desktopBtnStyle}
          onClick={() => mapInstanceRef.current?.zoomOut()}
          title="Zoom Out"
        >
          −
        </button>
        <button
          style={resetBtnStyle}
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

const filterPanelStyle = {
  position: 'absolute',
  bottom: '24px',
  left: '24px',
  backgroundColor: 'rgba(15, 23, 42, 0.85)',
  backdropFilter: 'blur(8px)',
  border: '1px solid #334155',
  borderRadius: '12px',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  zIndex: 10,
  minWidth: '200px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
};

const filterHeaderStyle = {
  color: '#f8fafc',
  fontSize: '13px',
  fontWeight: '600',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
};

const chipContainerStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
};

const chipStyle = {
  border: '1px solid',
  borderRadius: '20px',
  padding: '8px 14px',
  fontSize: '13px',
  fontWeight: '500',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const desktopControlsStyle = {
  position: 'absolute',
  bottom: '24px',
  right: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  zIndex: 10,
};

const desktopBtnStyle = {
  width: '36px',
  height: '36px',
  borderRadius: '6px',
  backgroundColor: '#1e293b',
  color: '#ffffff',
  border: '1px solid #475569',
  fontSize: '20px',
  fontWeight: 'bold',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
};

const resetBtnStyle = {
  height: '32px',
  padding: '0 12px',
  borderRadius: '6px',
  backgroundColor: '#1e293b',
  color: '#38bdf8',
  border: '1px solid #475569',
  fontSize: '13px',
  fontWeight: '600',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
};
