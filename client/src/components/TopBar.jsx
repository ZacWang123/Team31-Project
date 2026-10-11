// src/components/TopBar.jsx
import React from 'react';
import pinIcon from '../assets/location-pin.png';

export default function TopBar({ onViewProfile }) {
  return (
    <div className="top-bar">
      <div className="top-bar-logo">
        <img src={pinIcon} alt="" aria-hidden="true" draggable="false" />
        <span>FLIGHT CENTRE</span>
      </div>
      <button onClick={onViewProfile} className="view-profile-btn">
        <span>View Travel Profile</span>
        <i className="fi-rr-user profile-icon" aria-hidden="true" />
      </button>
    </div>
  );
}