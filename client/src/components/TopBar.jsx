// src/components/TopBar.jsx
import React from 'react';

export default function TopBar({ onViewProfile }) {
  return (
    <div className="top-bar">
      <div className="top-bar-logo">
        <i className="fi-br-map-marker" aria-hidden="true" />
        <span>FLIGHT CENTRE</span>
      </div>
      <button onClick={onViewProfile} className="view-profile-btn">
        <span>View Travel Profile</span>
        <i className="fi-rr-user profile-icon" aria-hidden="true" />
      </button>
    </div>
  );
}