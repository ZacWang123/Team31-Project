// src/components/PackageDetailModal.jsx
import React, { useState } from 'react';
import { formatLocationName } from '../utils/locationUtils';
import { inclusionIconClass } from '../constants/inclusionIcons';

// Day-by-day itinerary. Rendered with key={package name} by the parent so
// the open/closed state resets when you jump to a different package.
function ItineraryList({ days, duration }) {
  const [openDays, setOpenDays] = useState(() => new Set([0]));
  const allOpen = openDays.size === days.length;

  const toggleDay = (index) =>
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  // Use the package duration if available, otherwise fallback to counting days array
  const durationLabel = duration || `${days.length} ${days.length === 1 ? 'day' : 'days'}`;

  return (
    <div className="modal-overview-section modal-itinerary">
      <div className="modal-section-title-row">
        <h4 className="modal-overview-heading">
          Itinerary <span className="modal-section-count">{durationLabel}</span>
        </h4>
        {days.length > 1 && (
          <button
            type="button"
            className="modal-section-toggle-all"
            onClick={() => setOpenDays(allOpen ? new Set() : new Set(days.map((_, i) => i)))}
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>
      <ol className="itinerary-list">
        {days.map((d, i) => {
          const isOpen = openDays.has(i);
          return (
            <li key={i} className={`itinerary-day ${isOpen ? 'is-open' : ''}`}>
              <button type="button" className="itinerary-day-header" aria-expanded={isOpen} onClick={() => toggleDay(i)}>
                <span className="itinerary-day-badge">{d.day ? `Day ${d.day}` : `#${i + 1}`}</span>
                <span className="itinerary-day-title">{d.title}</span>
                <i className={`fi-rr-angle-down itinerary-day-chevron ${isOpen ? '' : 'is-collapsed'}`} aria-hidden="true" />
              </button>
              {isOpen && d.body && <p className="itinerary-day-body">{d.body}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// "What's included" / "Not included". Headline items (featured + top) get
// icons; the longer marketing-style lines go in a bullet list below.
function InclusionsSection({ inclusions }) {
  const featured = inclusions?.featured || [];
  const top = inclusions?.top || [];
  const seen = new Set();
  const headline = [...featured, ...top].filter((item) => {
    const key = item.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const included = inclusions?.included || [];
  const excluded = inclusions?.excluded || [];

  if (!headline.length && !included.length && !excluded.length) return null;

  return (
    <>
      {(headline.length > 0 || included.length > 0) && (
        <div className="modal-overview-section modal-inclusions">
          <h4 className="modal-overview-heading">What&apos;s included</h4>
          {headline.length > 0 && (
            <ul className="inclusion-grid">
              {headline.map((item, i) => (
                <li key={i} className="inclusion-item">
                  <span className="inclusion-icon"><i className={inclusionIconClass(item.icon)} aria-hidden="true" /></span>
                  <span className="inclusion-text">
                    <strong>{item.title}</strong>
                    {item.subtitle && <span className="inclusion-subtitle">{item.subtitle}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {included.length > 0 && (
            <ul className="inclusion-bullets">
              {included.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          )}
        </div>
      )}
      {excluded.length > 0 && (
        <div className="modal-overview-section modal-exclusions">
          <h4 className="modal-overview-heading">Not included</h4>
          <ul className="exclusion-list">
            {excluded.map((line, i) => (
              <li key={i}><i className="fi-rr-cross-small" aria-hidden="true" /><span>{line}</span></li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export default function PackageDetailModal({
  selectedPackage,
  onClose,
  selectedPkgTitle,
  similarPackages = [],
  trackPackageClick,
  setSelectedPackage,
  toggleSavePackage,
  isPackageSaved,
}) {
  if (!selectedPackage) return null;

  return (
    <div className="modal-backdrop-package" onClick={onClose}>
      <div className="modal-content-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-container">
          <div>
            <span className="modal-package-dest">
              {selectedPackage.locationPath || formatLocationName(selectedPackage.city, selectedPackage.country)}
            </span>
            <h2 className="modal-package-title">{selectedPkgTitle}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <i className="fi-rr-cross" aria-hidden="true" />
          </button>
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
                From \${selectedPackage.fromPrice.toLocaleString('en-AU')}
              </span>
            )}
          </div>

          {selectedPackage.wowFactor && (
            <div className="modal-wow-banner">
              <i className="fi-rr-sparkles" aria-hidden="true" /> {selectedPackage.wowFactor}
            </div>
          )}

          <div className="modal-overview-section">
            <h4 className="modal-overview-heading">Overview & Details</h4>
            {selectedPackage.summary ? (
              selectedPackage.summary.split('\n\n').map((para, i) => (
                <p key={i} className="modal-overview-text">{para}</p>
              ))
            ) : (
              <p className="modal-overview-text">
                {selectedPackage.description || selectedPackage.details || `Experience the ultimate journey to ${selectedPackage.destination}. This carefully curated package offers unforgettable sights, premium accommodations, and seamless travel arrangements tailored for explorers.`}
              </p>
            )}
          </div>

          {selectedPackage.itinerary?.length > 0 && (
            <ItineraryList 
              key={selectedPackage.packageName} 
              days={selectedPackage.itinerary} 
              duration={selectedPackage.duration} 
            />
          )}

          <InclusionsSection key={`inc-${selectedPackage.packageName}`} inclusions={selectedPackage.inclusions} />

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
                        <span className="saved-card-dest">
                          {pkg.locationPath || formatLocationName(pkg.city, pkg.country)}
                        </span>
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
              <span className="btn-text-default">
                <i className={isPackageSaved ? 'fi-br-heart' : 'fi-rr-heart'} aria-hidden="true" /> {isPackageSaved ? 'Saved' : 'Save Package'}
              </span>
              <span className="btn-text-hover">Remove from saved</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}