import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const MAPTILER_KEY = 'b2kWQSPaeDhJ5B2PDkVO';
const MAP_STYLE = `https://api.maptiler.com/maps/basic-v2/style.json?key=${MAPTILER_KEY}`;

// Custom views to properly frame larger or awkwardly placed countries
const customZoomViews = {
  Australia: { center: [133.7751, -25.2744], zoom: 3.8 },
  'United States': { center: [-95.7129, 37.0902], zoom: 3.5 },
  'United States of America': { center: [-95.7129, 37.0902], zoom: 3.5 },
  Russia: { center: [105.3188, 61.524], zoom: 3 },
  Brazil: { center: [-51.9253, -14.235], zoom: 3.5 },
  Canada: { center: [-106.3468, 56.1304], zoom: 3 },
  Argentina: { center: [-63.6167, -38.4161], zoom: 3.5 },
  Chile: { center: [-71.543, -35.6751], zoom: 3.5 },
  'New Zealand': { center: [174.886, -40.9006], zoom: 4.5 },
};

export default function WorldMap() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

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
    });

    // Pointer cursor when hovering over country labels
    map.on('mousemove', (e) => {
      const features = map.queryRenderedFeatures(e.point);
      const isOverCountry = features.some((f) => f.properties?.class === 'country');
      map.getCanvas().style.cursor = isOverCountry ? 'pointer' : '';
    });

    // Click handler to zoom into the clicked country
    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point);
      const countryFeature = features.find((f) => f.properties?.class === 'country');

      if (!countryFeature) return;

      const props = countryFeature.properties;
      const countryName = props?.name_en || props?.name;

      // 1. If custom preset view exists, use it
      if (countryName && customZoomViews[countryName]) {
        const { center, zoom } = customZoomViews[countryName];
        map.flyTo({ center, zoom, essential: true, duration: 1200 });
        return;
      }

      // 2. Otherwise fly directly to feature coordinates
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

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

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
          onClick={() =>
            mapInstanceRef.current?.flyTo({ center: [0, 20], zoom: 2, duration: 1000 })
          }
          title="Reset View"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// Styling
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