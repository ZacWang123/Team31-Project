import React from 'react';

export default function MapControls({ onZoomIn, onZoomOut, onReset }) {
  return (
    <div className="desktop-controls">
      <button className="desktop-btn" onClick={onZoomIn} title="Zoom In">
        <i className="fi-rr-zoom-in" aria-hidden="true" />
      </button>
      <button className="desktop-btn" onClick={onZoomOut} title="Zoom Out">
        <i className="fi-rr-zoom-out" aria-hidden="true" />
      </button>
      <button className="reset-btn" onClick={onReset} title="Reset View">
        Reset
      </button>
    </div>
  );
}