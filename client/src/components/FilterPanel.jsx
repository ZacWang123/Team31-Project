// src/components/FilterPanel.jsx
import React from 'react';
import PackageSearch from './PackageSearch'; // Adjust this import if PackageSearch is in a different folder
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
  return (
    <div className="filter-panel">
      <div className="explore-heading">
        <i className="fi-br-map-marker" aria-hidden="true" />
        <span>Explore destinations</span>
      </div>
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
  );
}