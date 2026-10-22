// src/components/FilterPanel.jsx
import React, { useState } from 'react';
import PackageSearch from './PackageSearch'; 
import { FILTER_OPTIONS } from '../constants/mapConstants';
import pinIcon from '../assets/location-pin.png';

// This component renders the filter panel for the Explore page, including search functionality and filter options.

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
  maxDuration,
  setMaxDuration,
  maxPrice,
  setMaxPrice,
}) {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <div className={`filter-panel ${isMinimized ? 'minimized' : ''}`}>
      <div className="filter-panel-header-row">
        <div className="explore-heading">
          <img src={pinIcon} alt="" aria-hidden="true" draggable="false" />
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


          <div className="numeric-filters" style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="filter-slider-group">
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#334155', display: 'flex', justifyContent: 'space-between' }}>
                <span>Max Duration:</span>
                <span>{maxDuration !== null ? `${maxDuration} Days/Nights` : 'Any'}</span>
              </label>
              <input 
                type="range" 
                min="1" 
                max="30" 
                step="1"
                value={maxDuration === null ? 30 : maxDuration} 
                onChange={(e) => {
                  const val = Number(e.target.value);
                  // If dragged all the way to 30, set to null ("Any")
                  setMaxDuration(val >= 30 ? null : val);
                }}
                style={{ width: '100%' }}
              />
            </div>

            <div className="filter-slider-group">
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#334155', display: 'flex', justifyContent: 'space-between' }}>
                <span>Max Price:</span>
                <span>{maxPrice !== null ? `$${maxPrice.toLocaleString('en-AU')}` : 'Any'}</span>
              </label>
              <input 
                type="range" 
                min="500" 
                max="15000" 
                step="250"
                value={maxPrice === null ? 15000 : maxPrice} 
                onChange={(e) => {
                  const val = Number(e.target.value);
                  // If dragged all the way to 15000, set to null ("Any")
                  setMaxPrice(val >= 15000 ? null : val);
                }}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          {/* ------------------------------------------- */}

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