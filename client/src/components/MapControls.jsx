import React from 'react';

/**
 * MapControls
 * Renders map overlay navigation controls (Zoom In/Out, Reset View, Back to World View).
 */
export default function MapControls({
  activeCountry,
  onBackToWorld,
  onZoomIn,
  onZoomOut,
  onReset,
}) {
  return (
    <>
      {activeCountry && (
        <button className="back-to-world-btn" onClick={onBackToWorld}>
          <span>&larr;</span>
          <span>Back to world view</span>
        </button>
      )}

      <div className="desktop-controls">
        <button className="desktop-btn" onClick={onZoomIn} title="Zoom In">+</button>
        <button className="desktop-btn" onClick={onZoomOut} title="Zoom Out">−</button>
        <button className="reset-btn" onClick={onReset} title="Reset View">
          Reset
        </button>
      </div>
    </>
  );
}