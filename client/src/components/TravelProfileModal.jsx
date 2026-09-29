import React, { useState } from 'react';

export default function TravelProfileModal({
  isOpen,
  onClose,
  viewedPackages = [],
  savedPackages = [],
  topSavedFilters = [],
  filterOptions = [],
  formatLocationPath,
  toggleSavePackage,
  onSaveProfile,
  nominatedStoreEmail = '',
}) {
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [sendToSelf, setSendToSelf] = useState(true);
  const [sendToStore, setSendToStore] = useState(false);
  const [saveProfileLocal, setSaveProfileLocal] = useState(true);
  const [receiveDeals, setReceiveDeals] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (typeof onSaveProfile === 'function') {
      onSaveProfile({
        name: profileName,
        email: profileEmail,
        phone: profilePhone,
        sendToSelf,
        sendToStore,
        saveProfileLocal,
        receiveDeals,
      });
    }
  };

  return (
    <div className="modal-backdrop-profile" onClick={onClose}>
      <div className="modal-content-box profile-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-container flight-centre-red-header">
          <div className="profile-brand-title">
            <span className="fc-logo-text">FLIGHT CENTRE</span>
            <span className="fc-sub-title">TRAVEL GROUP</span>
            <h2>Travel Profile</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
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
                    const filterObj = filterOptions.find((f) => f.id === tagId);
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
                        <span className="shortlist-dest-label">
                          {typeof formatLocationPath === 'function' ? formatLocationPath(pkg) : ''}
                        </span>
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
              Enter your details below to receive a copy of your travel profile or connect with a Flight Centre travel expert.
            </p>

            <form onSubmit={handleSubmit}>
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
                  Send my profile to Flight Centre Store ({nominatedStoreEmail})
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