// src/components/PackageDetailModal.jsx
import React from 'react';
import { formatLocationName } from '../utils/locationUtils';

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
                From ${selectedPackage.fromPrice.toLocaleString('en-AU')}
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