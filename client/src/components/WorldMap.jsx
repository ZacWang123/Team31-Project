import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import packagesData from '../data/packages.json';
import { useTravelProfile } from '../context/TravelProfileContext';
import './WorldMap.css';

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

function buildDestinations() {
  const byDestination = new Map();
  const safeData = Array.isArray(packagesData) ? packagesData : [];

  safeData.forEach((pkg) => {
    if (!pkg || !pkg.destination) return;
    if (!byDestination.has(pkg.destination)) {
      byDestination.set(pkg.destination, {
        destination: pkg.destination,
        lat: pkg.lat || 0,
        lon: pkg.lon || 0,
        iso3: pkg.iso3 || '',
        tags: new Set(),
        packages: [],
      });
    }
    const entry = byDestination.get(pkg.destination);
    entry.packages.push(pkg);

    const title = pkg.packageName || pkg.title || pkg.name || '';
    const haystack = `${title} ${pkg.wowFactor || ''}`;
    TAG_RULES.forEach(({ id, test }) => {
      if (test.test(haystack)) entry.tags.add(id);
    });
  });

  return Array.from(byDestination.values()).map((d) => ({
    ...d,
    tags: Array.from(d.tags),
  }));
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
        <div class="package-card" data-index="${index}" data-pkg-key="${pkgKey}" style="cursor: pointer;">
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
      <div class="popup-header">
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

  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState('saved'); // 'viewed' or 'saved'
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
  }, [savedPackages]);

  const destinations = useMemo(() => buildDestinations(), []);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
      .maplibregl-popup { max-width: 420px !important; z-index: 50; }
      .maplibregl-popup-content { background: rgba(15, 23, 42, 0.95) !important; backdrop-filter: blur(12px) !important; color: #f8fafc !important; padding: 20px !important; border-radius: 20px !important; border: 1px solid rgba(51, 65, 85, 0.8) !important; box-shadow: 0 20px 40px rgba(0,0,0,0.7) !important; }
      .maplibregl-popup-close-button { font-size: 24px !important; color: #94a3b8 !important; padding: 8px 12px !important; background: transparent !important; border: none !important; cursor: pointer !important; line-height: 1 !important; transition: color 0.2s; z-index: 10; }
      .maplibregl-popup-close-button:hover { color: #ffffff !important; background: rgba(255,255,255,0.1) !important; border-radius: 50% !important; }
      .maplibregl-popup-tip { border-top-color: #0f172a !important; }
      .popup-container { display: flex; flex-direction: column; gap: 14px; width: 340px; }
      .popup-header { display: flex; flex-direction: column; gap: 2px; border-bottom: 1px solid #334155; padding-bottom: 10px; }
      .popup-dest-name { font-size: 18px; font-weight: 700; color: #f8fafc; }
      .popup-dest-count { font-size: 12px; color: #94a3b8; }
      .package-list { display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto; padding-right: 4px; }
      .package-card { background: rgba(30, 41, 59, 0.7); border: 1px solid #334155; border-radius: 12px; overflow: hidden; transition: transform 0.2s, border-color 0.2s; display: flex; flex-direction: column; flex-shrink: 0; }
      .package-card:hover { border-color: #38bdf8; transform: translateY(-2px); }
      .thumbnail-wrapper { position: relative; width: 100%; height: 130px; overflow: hidden; flex-shrink: 0; }
      .thumbnail-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease; }
      .package-card:hover .thumbnail-img { transform: scale(1.04); }
      .price-tag { position: absolute; bottom: 8px; left: 8px; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px); color: #38bdf8; padding: 4px 8px; font-size: 11px; font-weight: 700; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.3); }
      
      .save-package-btn { position: absolute; top: 8px; right: 8px; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px); border: 1px solid #475569; color: #cbd5e1; padding: 5px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; z-index: 2; }
      .save-package-btn .btn-text-hover { display: none; }
      .save-package-btn:hover { background: #0f172a; color: #ffffff; border-color: #38bdf8; }
      
      .save-package-btn.saved { background: rgba(244, 63, 94, 0.2); border-color: #f43f5e; color: #f43f5e; }
      .save-package-btn.saved:hover { background: rgba(239, 68, 68, 0.35); border-color: #ef4444; color: #fca5a5; }
      .save-package-btn.saved:hover .btn-text-default { display: none; }
      .save-package-btn.saved:hover .btn-text-hover { display: inline; }

      .card-body { padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; }
      .package-title { font-size: 13px; font-weight: 600; color: #f1f5f9; line-height: 1.35; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .wow-factor { font-size: 11px; color: #94a3b8; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
      .browse-more-btn { background: #1e293b; border: 1px solid #475569; color: #38bdf8; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; text-align: center; transition: background 0.2s; font-size: 13px; }
      .browse-more-btn:hover { background: #334155; color: #ffffff; }
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

      destinations.forEach((dest) => {
        const el = document.createElement('div');
        el.className = 'country-pin';
        el.style.cssText = `
          background-color: #ff4757;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 12px rgba(255, 71, 87, 0.6);
          cursor: pointer;
          transform: translate(-50%, -50%);
          z-index: 10;
        `;

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
      if (popupRef.current) popupRef.current.remove();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      styleTag.remove();
    };
  }, [destinations]);

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

      map.setFilter('country-dim-overlay', [
        '!',
        [
          'in',
          ['coalesce', ['get', 'ISO_A3'], ['get', 'iso_a3'], ['get', 'ADM0_A3']],
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

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 1000 }}>
        <button
          onClick={() => {
            setSelectedPackage(null); // Close individual package page if open
            setIsProfileOpen(true);
          }}
          style={{ background: '#1e293b', border: '1px solid #475569', color: '#f8fafc', padding: '10px 16px', borderRadius: '12px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', backdropFilter: 'blur(8px)' }}
        >
          <span>View Travel Profile</span>
          <span style={{ fontSize: '16px' }}>👤</span>
        </button>
      </div>

      {isProfileOpen && (
        <div style={profileModalBackdropStyle} onClick={() => setIsProfileOpen(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#f8fafc' }}>Your Travel Profile</h2>
                  <button onClick={resetProfile} style={resetProfileBtnStyle}>Reset Profile</button>
                </div>
                <div style={modalSubHeaderDivider}></div>
                <div style={modalTabsContainerStyle}>
                  <button
                    onClick={() => setActiveProfileTab('viewed')}
                    style={{
                      ...modalTabBtnStyle,
                      color: activeProfileTab === 'viewed' ? '#38bdf8' : '#94a3b8',
                      borderBottomColor: activeProfileTab === 'viewed' ? '#38bdf8' : 'transparent',
                    }}
                  >
                    Viewed package ({viewedPackages.length})
                  </button>
                  <span style={{ color: '#475569' }}>|</span>
                  <button
                    onClick={() => setActiveProfileTab('saved')}
                    style={{
                      ...modalTabBtnStyle,
                      color: activeProfileTab === 'saved' ? '#38bdf8' : '#94a3b8',
                      borderBottomColor: activeProfileTab === 'saved' ? '#38bdf8' : 'transparent',
                    }}
                  >
                    Saved package ({savedPackages.length})
                  </button>
                </div>
              </div>
              <button style={modalCloseBtnStyle} onClick={() => setIsProfileOpen(false)}>✕</button>
            </div>

            <div style={modalBodyStyle}>
              {displayedPackages.length === 0 ? (
                <div style={emptyStateStyle}>
                  <p style={{ fontSize: '32px' }}>{activeProfileTab === 'saved' ? '✈️' : '🔍'}</p>
                  <p style={{ fontWeight: '600', color: '#f8fafc' }}>
                    {activeProfileTab === 'saved' ? 'No saved packages yet!' : 'No viewed packages yet!'}
                  </p>
                  <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>
                    {activeProfileTab === 'saved'
                      ? 'Explore destinations on the map and click 🤍 Save on any package to add it to your travel profile.'
                      : 'Click on destination pins or browse packages on the map to see your viewed history here.'}
                  </p>
                </div>
              ) : (
                <div style={savedPackagesGridStyle}>
                  {displayedPackages.map((pkg, idx) => {
                    const imgSrc =
                      pkg.imageUrl ||
                      pkg.image ||
                      'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80';
                    const price = pkg.fromPrice ? `$${pkg.fromPrice.toLocaleString('en-AU')}` : null;
                    const pkgTitle = pkg.packageName || pkg.title || pkg.name || 'Package';
                    const isSaved = savedPackages.some((s) => arePackagesSame(s, pkg));

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          trackPackageClick(pkg);
                          setSelectedPackage(pkg);
                        }}
                        style={savedCardClickableStyle}
                      >
                        <div style={{ position: 'relative', height: '130px' }}>
                          <img src={imgSrc} alt={pkgTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          {price && <span style={savedCardPriceStyle}>From {price}</span>}
                        </div>
                        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#38bdf8', textTransform: 'uppercase' }}>
                            {pkg.destination}
                          </span>
                          <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#f8fafc', margin: 0, lineHeight: '1.3' }}>
                            {pkgTitle}
                          </h4>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSavePackage(pkg);
                              }}
                              className={`profile-save-btn ${isSaved ? 'saved' : ''}`}
                            >
                              <span className="btn-text-default">{isSaved ? '❤️ Saved' : '🤍 Save'}</span>
                              <span className="btn-text-hover">Remove from saved</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedPackage && (
        <div style={packageModalBackdropStyle} onClick={() => setSelectedPackage(null)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#38bdf8', textTransform: 'uppercase' }}>
                  {selectedPackage.destination}
                </span>
                <h2 style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: '700', color: '#f8fafc' }}>
                  {selectedPkgTitle}
                </h2>
              </div>
              <button style={modalCloseBtnStyle} onClick={() => setSelectedPackage(null)}>✕</button>
            </div>

            <div style={modalBodyStyle}>
              <div style={{ position: 'relative', width: '100%', height: '220px', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                <img
                  src={selectedPackage.imageUrl || selectedPackage.image || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80'}
                  alt={selectedPkgTitle}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {selectedPackage.fromPrice && (
                  <span style={{ position: 'absolute', bottom: '12px', left: '12px', backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#38bdf8', padding: '6px 12px', fontSize: '14px', fontWeight: '700', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.4)' }}>
                    From ${selectedPackage.fromPrice.toLocaleString('en-AU')}
                  </span>
                )}
              </div>

              {selectedPackage.wowFactor && (
                <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#38bdf8', fontSize: '14px', fontWeight: '600' }}>
                  ✨ {selectedPackage.wowFactor}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#cbd5e1', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
                <h4 style={{ color: '#f8fafc', fontSize: '15px', margin: '0 0 4px 0' }}>Overview & Details</h4>
                <p style={{ margin: 0 }}>
                  {selectedPackage.description || selectedPackage.details || `Experience the ultimate journey to ${selectedPackage.destination}. This carefully curated package offers unforgettable sights, premium accommodations, and seamless travel arrangements tailored for explorers.`}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
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
        <button style={desktopBtnStyle} onClick={() => mapInstanceRef.current?.zoomIn()} title="Zoom In">+</button>
        <button style={desktopBtnStyle} onClick={() => mapInstanceRef.current?.zoomOut()} title="Zoom Out">−</button>
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

const profileModalBackdropStyle = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 };
const packageModalBackdropStyle = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000 };
const modalContentStyle = { backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '24px', width: '90%', maxWidth: '750px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)', overflow: 'hidden' };
const modalHeaderStyle = { padding: '24px 28px 16px 28px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', color: '#f8fafc' };
const resetProfileBtnStyle = { backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s' };
const modalSubHeaderDivider = { width: '100%', height: '1px', backgroundColor: '#334155', margin: '8px 0 12px 0' };
const modalTabsContainerStyle = { display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', fontWeight: '600' };
const modalTabBtnStyle = { background: 'transparent', border: 'none', borderBottom: '2px solid transparent', padding: '4px 2px', cursor: 'pointer', transition: 'color 0.2s, border-color 0.2s', fontSize: '14px', fontWeight: '600' };
const modalCloseBtnStyle = { background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '22px', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px' };
const modalBodyStyle = { padding: '24px 28px', overflowY: 'auto', flex: 1 };
const emptyStateStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: '12px' };
const savedPackagesGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' };
const savedCardClickableStyle = { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s' };
const savedCardPriceStyle = { position: 'absolute', bottom: '8px', left: '8px', backgroundColor: 'rgba(15, 23, 42, 0.85)', color: '#38bdf8', padding: '2px 8px', fontSize: '11px', fontWeight: '700', borderRadius: '4px' };
const filterPanelStyle = { position: 'absolute', bottom: '24px', left: '24px', backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', border: '1px solid #334155', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 10, minWidth: '200px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' };
const filterHeaderStyle = { color: '#f8fafc', fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' };
const chipContainerStyle = { display: 'flex', flexWrap: 'wrap', gap: '8px' };
const chipStyle = { border: '1px solid', borderRadius: '20px', padding: '8px 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '6px' };
const desktopControlsStyle = { position: 'absolute', bottom: '24px', right: '24px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 10 };
const desktopBtnStyle = { width: '36px', height: '36px', borderRadius: '6px', backgroundColor: '#1e293b', color: '#ffffff', border: '1px solid #475569', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' };
const resetBtnStyle = { height: '32px', padding: '0 12px', borderRadius: '6px', backgroundColor: '#1e293b', color: '#38bdf8', border: '1px solid #475569', fontSize: '13px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' };

// Additional injected CSS styles for profile and detail modal save buttons
const additionalStyles = `
  .profile-save-btn { flex: 1; background-color: #334155; border: 1px solid #475569; color: #f8fafc; padding: 6px; border-radius: 6px; fontSize: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .profile-save-btn .btn-text-hover { display: none; }
  .profile-save-btn.saved { background-color: rgba(244, 63, 94, 0.15); border-color: #f43f5e; color: #fca5a5; }
  .profile-save-btn.saved:hover { background-color: rgba(239, 68, 68, 0.35); border-color: #ef4444; color: #ffffff; }
  .profile-save-btn.saved:hover .btn-text-default { display: none; }
  .profile-save-btn.saved:hover .btn-text-hover { display: inline; }

  .modal-save-btn { flex: 1; background-color: #0284c7; border: 1px solid #38bdf8; color: #ffffff; padding: 12px; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .modal-save-btn .btn-text-hover { display: none; }
  .modal-save-btn.saved { background-color: rgba(244, 63, 94, 0.2); border-color: #f43f5e; color: #f43f5e; }
  .modal-save-btn.saved:hover { background-color: rgba(239, 68, 68, 0.35); border-color: #ef4444; color: #fca5a5; }
  .modal-save-btn.saved:hover .btn-text-default { display: none; }
  .modal-save-btn.saved:hover .btn-text-hover { display: inline; }
`;

if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.innerHTML = additionalStyles;
  document.head.appendChild(styleEl);
}