// src/components/StatusBanner.jsx
import React from 'react';

export default function StatusBanner({ loading, error, apiBaseUrl }) {
  if (loading) {
    return (
      <div className="live-db-status live-db-loading">
        <span className="live-db-spinner" aria-hidden="true" />
        Loading live package data&hellip;
      </div>
    );
  }

  if (error) {
    return (
      <div className="live-db-status live-db-error">
        Couldn't reach the live database ({error}). Is the server running on {apiBaseUrl}?
      </div>
    );
  }

  return null;
}