// src/components/TravelProfileModal.jsx
import React, { useState, useMemo } from 'react';
import { FILTER_OPTIONS } from '../constants/mapConstants';
import { formatLocationName } from '../utils/locationUtils';
import { getPackageTags } from '../utils/tagUtils';
import pinIcon from '../assets/location-pin.png';

// Helper parsers for price and duration extraction
function parseDuration(pkg) {
  if (!pkg) return null;
  const rawText = String(pkg.duration || pkg.packageName || pkg.summary || '');
  const match = rawText.match(/(\d+)\s*(?:night|day|n|d)/i);
  if (match) return parseInt(match[1], 10);
  if (Array.isArray(pkg.itinerary) && pkg.itinerary.length > 0) {
    return pkg.itinerary.length;
  }
  return null;
}

function parsePrice(pkg) {
  if (!pkg) return null;
  if (typeof pkg.fromPrice === 'number') return pkg.fromPrice;
  const rawPrice = pkg.fromPrice ?? pkg.price;
  if (rawPrice === undefined || rawPrice === null || rawPrice === '') return null;
  const cleaned = String(rawPrice).replace(/[^0-9.]/g, '');
  return cleaned ? parseFloat(cleaned) : null;
}

export default function TravelProfileModal({
  isOpen,
  onClose,
  viewedPackages = [],
  savedPackages = [],
  topSavedFilters = [],
  toggleSavePackage,
  profileName,
  setProfileName,
  profileEmail,
  setProfileEmail,
  profilePhone,
  setProfilePhone,
  sendToSelf,
  setSendToSelf,
  sendToStore,
  setSendToStore,
  saveProfileLocal,
  setSaveProfileLocal,
  receiveDeals,
  setReceiveDeals,
  handleSaveProfile,
  NOMINATED_STORE_EMAIL = 'store@flightcentre.com.au',
}) {
  const [openSections, setOpenSections] = useState({ prefs: true, viewed: true, favs: true });
  const toggleSection = (key) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Calculate Price Range from saved packages
  const { priceRangeText, isPriceSpecified } = useMemo(() => {
    const prices = savedPackages.map(parsePrice).filter((p) => typeof p === 'number' && !isNaN(p));
    if (prices.length === 0) return { priceRangeText: 'Not specified', isPriceSpecified: false };
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const text = min === max ? `$${min.toLocaleString('en-AU')}` : `$${min.toLocaleString('en-AU')} - $${max.toLocaleString('en-AU')}`;
    return { priceRangeText: text, isPriceSpecified: true };
  }, [savedPackages]);

  // Calculate Duration Range from saved packages
  const { durationRangeText, isDurationSpecified } = useMemo(() => {
    const durations = savedPackages.map(parseDuration).filter((d) => typeof d === 'number' && !isNaN(d));
    if (durations.length === 0) return { durationRangeText: 'Not specified', isDurationSpecified: false };
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    const text = min === max ? `${min} Days/Nights` : `${min} - ${max} Days/Nights`;
    return { durationRangeText: text, isDurationSpecified: true };
  }, [savedPackages]);

  // Extract activity tags directly from saved packages (e.g. skiing, adventure, etc.)
  const packageActivities = useMemo(() => {
    const tagSet = new Set();
    savedPackages.forEach((pkg) => {
      const tags = getPackageTags(pkg);
      tags.forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet).map((tagId) => {
      const found = FILTER_OPTIONS.find((f) => f.id === tagId);
      return found ? found.label : tagId;
    });
  }, [savedPackages]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop-profile" onClick={onClose}>
      <div className="modal-content-box profile-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-container profile-header-light">
          <i className="fi-rr-plane profile-header-decoration" aria-hidden="true" />
          <div className="profile-brand-title">
            <span className="fc-logo-text">FLIGHT CENTRE</span>
            <span className="fc-sub-title">TRAVEL GROUP</span>
            <h2>Travel Profile</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <i className="fi-rr-cross" aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body-container three-column-layout">
          {/* COLUMN 1: Preferences, Recently Viewed & Activities */}
          <div className="profile-col-left">
            <div className="profile-section-block">
              <button type="button" className="profile-section-header" aria-expanded={openSections.prefs} onClick={() => toggleSection('prefs')}>
                <span className="profile-section-icon icon-navy"><i className="fi-rr-settings-sliders" aria-hidden="true" /></span>
                <span className="profile-section-title">Your Travel Preferences</span>
                <i className={`fi-rr-angle-down profile-section-chevron ${openSections.prefs ? '' : 'is-collapsed'}`} aria-hidden="true" />
              </button>
              {openSections.prefs && <div className="profile-section-content">
                <div className="pref-row">
                  <i className="fi-rr-coins" aria-hidden="true" />
                  <span><strong>Price Range:</strong> <span className={isPriceSpecified ? '' : 'placeholder-text'}>{priceRangeText}</span></span>
                  <i className="fi-rr-angle-right" aria-hidden="true" />
                </div>
                <div className="pref-row">
                  <i className="fi-rr-calendar" aria-hidden="true" />
                  <span><strong>Duration:</strong> <span className={isDurationSpecified ? '' : 'placeholder-text'}>{durationRangeText}</span></span>
                  <i className="fi-rr-angle-right" aria-hidden="true" />
                </div>
              </div>}
            </div>

            <div className="profile-section-block">
              <button type="button" className="profile-section-header" aria-expanded={openSections.viewed} onClick={() => toggleSection('viewed')}>
                <span className="profile-section-icon icon-rose"><i className="fi-rr-heart" aria-hidden="true" /></span>
                <span className="profile-section-title">Your Recently Viewed</span>
                <i className={`fi-rr-angle-down profile-section-chevron ${openSections.viewed ? '' : 'is-collapsed'}`} aria-hidden="true" />
              </button>
              {openSections.viewed && <div className="profile-section-content">
                {viewedPackages.slice(0, 3).map((pkg, i) => (
                  <div key={i} className="mini-list-item">{pkg.packageName || pkg.title}</div>
                ))}
                {viewedPackages.length === 0 && <p className="placeholder-text">No recently viewed packages</p>}
              </div>}
            </div>

            <div className="profile-section-block">
              <button type="button" className="profile-section-header" aria-expanded={openSections.favs} onClick={() => toggleSection('favs')}>
                <span className="profile-section-icon icon-rose"><i className="fi-rr-heart" aria-hidden="true" /></span>
                <span className="profile-section-title">Your Favourite Activities</span>
                <i className={`fi-rr-angle-down profile-section-chevron ${openSections.favs ? '' : 'is-collapsed'}`} aria-hidden="true" />
              </button>
              {openSections.favs && <div className="profile-section-content">
                {packageActivities.length > 0 ? (
                  packageActivities.map((label, idx) => (
                    <div key={idx} className="mini-list-item">{label}</div>
                  ))
                ) : (
                  <p className="placeholder-text">Save packages to see favourite activities</p>
                )}
              </div>}
            </div>
          </div>

          {/* COLUMN 2: Destination Shortlist */}
          <div className="profile-col-middle">
            <h3 className="profile-col-heading"><img src={pinIcon} alt="" aria-hidden="true" draggable="false" /> Your Destination Shortlist</h3>
            <div className="shortlist-scroll-area">
              {savedPackages.length === 0 ? (
                <div className="empty-shortlist-state">
                  <span className="empty-shortlist-icon"><i className="fi-rr-map-marker" aria-hidden="true" /></span>
                  <p className="empty-shortlist">Your shortlist is empty. Save packages from the map to see them here.</p>
                </div>
              ) : (
                savedPackages.map((pkg, idx) => {
                  const imgSrc = pkg.imageUrl || pkg.image || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80';
                  const pkgTitle = pkg.packageName || pkg.title || pkg.name || 'Package';
                  return (
                    <div key={idx} className="shortlist-card">
                      <img src={imgSrc} alt={pkgTitle} className="shortlist-img" />
                      <div className="shortlist-info">
                        <span className="shortlist-dest-label">
                          {pkg.locationPath || formatLocationName(pkg.city, pkg.country)}
                        </span>
                        <h4>{pkgTitle}</h4>
                      </div>
                      <button 
                        className="shortlist-remove-btn" 
                        onClick={() => toggleSavePackage(pkg)}
                        title="Remove package"
                      >
                        <i className="fi-rr-cross-small" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMN 3: Save Your Profile Form */}
          <div className="profile-col-right">
            <h3 className="profile-col-heading"><i className="fi-rr-user" aria-hidden="true" /> Save Your Profile</h3>
            <p className="save-form-instruction">
              Enter your details below to receive a copy of your travel profile or connect with a Flight Centre travel expert.
            </p>

            <form onSubmit={handleSaveProfile}>
              <input 
                type="text" 
                placeholder="Full Name *" 
                className="profile-form-input" 
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                required 
              />

              <input 
                type="email" 
                placeholder="Email Address (Required to send copy)..." 
                className="profile-form-input" 
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                required={sendToSelf}
              />

              <div className="form-separator">OR</div>

              <input 
                type="tel" 
                placeholder="Mobile Number..." 
                className="profile-form-input" 
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
              />

              <div className="profile-checkbox-group">
                <label>
                  <input 
                    type="checkbox" 
                    checked={sendToSelf} 
                    onChange={(e) => setSendToSelf(e.target.checked)} 
                  /> 
                  Send a copy to my email
                </label>

                <label>
                  <input 
                    type="checkbox" 
                    checked={sendToStore} 
                    onChange={(e) => setSendToStore(e.target.checked)} 
                  /> 
                  Send my profile to Flight Centre Store ({NOMINATED_STORE_EMAIL})
                </label>

                <label>
                  <input 
                    type="checkbox" 
                    checked={saveProfileLocal} 
                    onChange={(e) => setSaveProfileLocal(e.target.checked)} 
                  /> 
                  Save my personalised travel profile locally
                </label>

                <label>
                  <input 
                    type="checkbox" 
                    checked={receiveDeals} 
                    onChange={(e) => setReceiveDeals(e.target.checked)} 
                  /> 
                  Send me personalised travel deals
                </label>
              </div>

              <button type="submit" className="finish-session-btn">
                Finish & Submit Profile
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}