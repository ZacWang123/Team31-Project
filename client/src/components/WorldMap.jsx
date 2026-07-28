import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const MAPTILER_KEY = 'b2kWQSPaeDhJ5B2PDkVO';
const MAP_STYLE = `https://api.maptiler.com/maps/basic-v2/style.json?key=${MAPTILER_KEY}`;

const WORLD_GEOJSON_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

const countryDataFromDB = [
  { iso: 'AUS', name: 'Australia', tags: ['warm'] },
];

const FILTER_OPTIONS = [
  { id: 'warm', label: 'Warm / Hot' },
];

const customZoomViews = {
  Australia: { center: [133.7751, -25.2744], zoom: 3.8 },
  'United States': { center: [-95.7129, 37.0902], zoom: 3.5 },
  Russia: { center: [105.3188, 61.524], zoom: 3 },
  Brazil: { center: [-51.9253, -14.235], zoom: 3.5 },
  Canada: { center: [-106.3468, 56.1304], zoom: 3 },
  Argentina: { center: [-63.6167, -38.4161], zoom: 3.5 },
  'New Zealand': { center: [174.886, -40.9006], zoom: 4.5 },
};

export default function WorldMap() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const popupRef = useRef(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);

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

    const updateMarkersVisibility = () => {
      const SHOW_PINS_AT_ZOOM = 4.5;
      const currentZoom = map.getZoom();
      
      markersRef.current.forEach(({ element }) => {
        if (currentZoom < SHOW_PINS_AT_ZOOM) {
          element.style.display = 'none';
        } else {
          element.style.display = 'block';
        }
      });
    };

    map.on('zoom', updateMarkersVisibility);
    map.on('zoomend', updateMarkersVisibility);

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

      fetch(WORLD_GEOJSON_URL)
        .then((res) => res.json())
        .then((data) => {
          data.features.forEach((feature) => {
            const props = feature.properties;
            const countryName = props.NAME_LONG || props.ADMIN || props.name;

            if (!feature.geometry || !feature.geometry.coordinates) return;

            const extractCoordinates = (coords) => {
              let points = [];
              coords.forEach((item) => {
                if (typeof item[0] === 'number') {
                  points.push(item);
                } else {
                  points = points.concat(extractCoordinates(item));
                }
              });
              return points;
            };

            const allPoints = extractCoordinates(feature.geometry.coordinates);
            if (allPoints.length === 0) return;

            const randomPoint = allPoints[Math.floor(Math.random() * allPoints.length)];

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

              if (popupRef.current) {
                popupRef.current.remove();
              }

              const popupContent = document.createElement('div');
              popupContent.style.cssText = `
                font-family: sans-serif;
                width: 320px;
                padding-right: 16px;
                display: flex;
                flex-direction: column;
                gap: 10px;
              `;
              popupContent.innerHTML = `
                <div style="font-weight: 700; font-size: 24px; color: #38bdf8; line-height: 1.2;">${countryName || 'Destination'}</div>
                <div style="font-size: 16px; color: #cbd5e1; line-height: 1.5;">Package Placeholder details and descriptions go here for the selected destination.</div>
              `;

              const popup = new maplibregl.Popup({ offset: 35, closeButton: true, maxWidth: 'none' })
                .setLngLat(randomPoint)
                .setDOMContent(popupContent)
                .addTo(map);

              popupRef.current = popup;

              if (countryName && customZoomViews[countryName]) {
                const { center, zoom } = customZoomViews[countryName];
                map.flyTo({ center, zoom, essential: true, duration: 1200 });
              }
            });

            const marker = new maplibregl.Marker({ element: el })
              .setLngLat(randomPoint)
              .addTo(map);

            markersRef.current.push({ marker, element: el });
          });

          updateMarkersVisibility();
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
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;

    if (activeFilters.length === 0) {
      map.setFilter('country-dim-overlay', ['in', ['get', 'ISO_A3'], ['literal', []]]);
      return;
    }

    const matchingIsos = countryDataFromDB
      .filter((country) =>
        activeFilters.every((filter) => country.tags.includes(filter))
      )
      .map((c) => c.iso);

    map.setFilter('country-dim-overlay', [
      '!',
      [
        'in',
        ['coalesce', ['get', 'ISO_A3'], ['get', 'iso_a3'], ['get', 'ADM0_A3']],
        ['literal', matchingIsos],
      ],
    ]);
  }, [activeFilters, mapLoaded]);

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