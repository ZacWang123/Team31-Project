// src/components/FilterPanel.jsx
import React, { useState } from 'react';
import PackageSearch from './PackageSearch'; 
import { FILTER_OPTIONS } from '../constants/mapConstants';


export default function FilterPanel({
  searchQuery,
  updateSearch,
  matchingPackages,
  searchLocation,
  selectSearchResult,
  packagesLoading,
  activeFilters,
  toggleFilter,
  trackFilterClick,
  setActiveFilters,
}) {
  // 1. Add state to track collapsed/minimized status
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <div className={`filter-panel ${isMinimized ? 'minimized' : ''}`}>
      {/* Header Row: Keeps the title and toggle button always visible */}
      <div className="filter-panel-header-row">
        <div className="explore-heading">
          <i className="fi-br-map-marker" aria-hidden="true" />
          <span>Explore destinations</span>
        </div>
        
        <button
          type="button"
          className="filter-collapse-btn"
          onClick={() => setIsMinimized(!isMinimized)}
          aria-label={isMinimized ? "Expand filters" : "Minimize filters"}
        >
          <i className={isMinimized ? "fi-rr-angle-down" : "fi-rr-angle-up"} aria-hidden="true" />
          <span>{isMinimized ? 'Show' : 'Minimize'}</span>
        </button>
      </div>

      {/* 2. Conditionally render search and filters only when not minimized */}
      {!isMinimized && (
        <div className="filter-panel-body">
          <PackageSearch
            query={searchQuery}
            onQueryChange={updateSearch}
            results={matchingPackages}
            getLocation={searchLocation}
            onSelect={selectSearchResult}
            loading={packagesLoading}
          />
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
                  <i className={filter.icon} aria-hidden="true" />
                  {filter.label}
                </button>
              );
            })}
          </div>
          <select
            className="filter-select-mobile"
            aria-label="Filter destinations"
            value={activeFilters[0] || ''}
            onChange={(e) => {
              const value = e.target.value;
              if (!value) {
                setActiveFilters([]);
                return;
              }
              if (!activeFilters.includes(value)) trackFilterClick(value);
              setActiveFilters([value]);
            }}
          >
            <option value="">All Destinations</option>
            {FILTER_OPTIONS.map((filter) => (
              <option key={filter.id} value={filter.id}>{filter.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}