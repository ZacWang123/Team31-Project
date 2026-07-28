import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const MAPTILER_KEY = 'b2kWQSPaeDhJ5B2PDkVO';
const MAP_STYLE = `https://api.maptiler.com/maps/basic-v2/style.json?key=${MAPTILER_KEY}`;

// Reliable GeoJSON source for world country polygons
const WORLD_GEOJSON_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

// Database mapping ISO codes to tags for future expansion
const countryDataFromDB = [
  { iso: 'AUS', name: 'Australia', tags: ['warm'] },
];

const FILTER_OPTIONS = [
  { id: 'warm', label: '☀️ Warm / Hot' },
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

  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);

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
    });

    mapInstanceRef.current = map;

    map.on('load', () => {
      // Style MapTiler's built-in national boundary lines
      if (map.getLayer('admin_level_2')) {
        map.setPaintProperty('admin_level_2', 'line-color', '#1e293b');
        map.setPaintProperty('admin_level_2', 'line-width', 1.5);
      }

      // Add world country polygons source
      map.addSource('world-polygons', {
        type: 'geojson',
        data: WORLD_GEOJSON_URL,
      });

      // Layer to grey out non-matching countries
      map.addLayer({
        id: 'country-dim-overlay',
        type: 'fill',
        source: 'world-polygons',
        paint: {
          'fill-color': '#0f172a', // Dark blue-gray dimming color
          'fill-opacity': 0.75,     // Dim opacity
        },
        // Initially show no dimming
        filter: ['in', ['get', 'ISO_A3'], ['literal', []]],
      });

      setMapLoaded(true);
    });

    // Hover cursor for country labels
    map.on('mousemove', (e) => {
      const features = map.queryRenderedFeatures(e.point);
      const isOverCountry = features.some((f) => f.properties?.class === 'country');
      map.getCanvas().style.cursor = isOverCountry ? 'pointer' : '';
    });

    // Direct click on a country to zoom
    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point);
      const countryFeature = features.find((f) => f.properties?.class === 'country');

      if (!countryFeature) return;

      const props = countryFeature.properties;
      const countryName = props?.name_en || props?.name;

      if (countryName && customZoomViews[countryName]) {
        const { center, zoom } = customZoomViews[countryName];
        map.flyTo({ center, zoom, essential: true, duration: 1200 });
        return;
      }

      if (countryFeature.geometry?.type === 'Point') {
        map.flyTo({
          center: countryFeature.geometry.coordinates,
          zoom: 4.5,
          essential: true,
          duration: 1200,
        });
      }
    });

    return () => {
      map.remove();
    };
  }, []);

  // Update dimming filter whenever activeFilters change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;

    if (activeFilters.length === 0) {
      // No filter selected: show all countries normally
      map.setFilter('country-dim-overlay', ['in', ['get', 'ISO_A3'], ['literal', []]]);
      return;
    }

    // Find country ISO codes that match ALL active filters
    const matchingIsos = countryDataFromDB
      .filter((country) =>
        activeFilters.every((filter) => country.tags.includes(filter))
      )
      .map((c) => c.iso);

    // Grey out every country NOT in matchingIsos
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

      {/* Filter Panel (Bottom-Left) */}
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

      {/* Navigation Controls */}
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

// Styling
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