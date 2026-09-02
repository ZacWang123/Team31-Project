import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import packagesData from '../data/packages.json';
import { useTravelProfile } from '../context/TravelProfileContext';
import './WorldMap.css';
import { generateConsultantReport } from '../utils/ProfileExport';

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