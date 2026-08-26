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
  }, [savedPackages]);

  const destinations = useMemo(() => buildDestinations(), []);

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
      if (popupRef.current) popupRef.current.remove();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [destinations]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded || !map.isStyleLoaded()) return;

    // IMPORTANT: use marker.setOpacity(), not element.style.opacity directly -
    // MapLibre's Marker re-applies its own internal opacity on every map
    // render (including mid-flyTo/fitBounds), so a raw style write gets
    // silently clobbered back to 1 the moment the camera next moves.
    markersRef.current.forEach(({ marker, element, destination }) => {
      const matches =
        activeFilters.length === 0 ||
        activeFilters.some((filter) => destination.tags.includes(filter));
      if (marker && typeof marker.setOpacity === 'function') {
        marker.setOpacity(matches ? '1' : '0.25');
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
    <div className="world-map-layout">
      <div ref={mapContainerRef} className="map-full-container" />

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
          <div className="modal-content-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-container">
              <div>
                <div className="modal-title-row">
                  <h2 className="modal-title">Your Travel Profile</h2>
                  <button onClick={resetProfile} className="reset-profile-btn">Reset Profile</button>
                </div>
                <div className="modal-divider"></div>
                <div className="modal-tabs-container">
                  <button
                    onClick={() => setActiveProfileTab('viewed')}
                    className={`modal-tab-btn ${activeProfileTab === 'viewed' ? 'active' : ''}`}
                  >
                    Viewed packages ({viewedPackages.length})
                  </button>
                  <span className="tab-separator">|</span>
                  <button
                    onClick={() => setActiveProfileTab('saved')}
                    className={`modal-tab-btn ${activeProfileTab === 'saved' ? 'active' : ''}`}
                  >
                    Saved packages ({savedPackages.length})
                  </button>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setIsProfileOpen(false)}>✕</button>
            </div>

            <div className="modal-body-container">
              {activeProfileTab === 'saved' && topSavedFilters.length > 0 && (
                <div className="top-filters-banner">
                  <span className="top-filters-label">Your Top Filters:</span>
                  <div className="top-filters-chips">
                    {topSavedFilters.map((filterId) => {
                      const filterObj = FILTER_OPTIONS.find((f) => f.id === filterId);
                      const isFilterActive = activeFilters.includes(filterId);
                      return (
                        <button
                          key={filterId}
                          onClick={() => {
                            setIsProfileOpen(false);
                            toggleFilter(filterId);
                          }}
                          className={`top-filter-chip ${isFilterActive ? 'active' : ''}`}
                        >
                          {filterObj ? filterObj.label : filterId}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {displayedPackages.length === 0 ? (
                <div className="empty-state-container">
                  <p className="empty-state-emoji">{activeProfileTab === 'saved' ? '✈️' : '🔍'}</p>
                  <p className="empty-state-title">
                    {activeProfileTab === 'saved' ? 'No saved packages yet!' : 'No viewed packages yet!'}
                  </p>
                  <p className="empty-state-desc">
                    {activeProfileTab === 'saved'
                      ? 'Explore destinations on the map and click 🤍 Save on any package to add it to your travel profile.'
                      : 'Click on destination pins or browse packages on the map to see your viewed history here.'}
                  </p>
                </div>
              ) : (
                <div className="saved-packages-grid">
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
                        className="saved-card-item"
                      >
                        <div className="saved-card-img-wrapper">
                          <img src={imgSrc} alt={pkgTitle} className="saved-card-img" />
                          {price && <span className="saved-card-price-tag">From {price}</span>}
                        </div>
                        <div className="saved-card-body">
                          <span className="saved-card-dest">{pkg.destination}</span>
                          <h4 className="saved-card-title">{pkgTitle}</h4>
                          <div className="saved-card-actions">
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
        <div className="modal-backdrop-package" onClick={() => setSelectedPackage(null)}>
          <div className="modal-content-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-container">
              <div>
                <span className="modal-package-dest">{selectedPackage.destination}</span>
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