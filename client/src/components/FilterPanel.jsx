import React from 'react';
import PackageSearch from './PackageSearch';

/**
 * FilterPanel
 * Wraps the search bar and destination filter chips in the map sidebar/overlay.
 */
export default function FilterPanel({
  searchQuery,
  onQueryChange,
  matchingPackages,
  searchLocation,
  onSelectSearchResult,
  packagesLoading,
  filterOptions = [],
  activeFilters = [],
  onToggleFilter,
}) {
  return (
    <div className="filter-panel">
      <div className="filter-header">Find your trip</div>
      <PackageSearch
        query={searchQuery}
        onQueryChange={onQueryChange}
        results={matchingPackages}
        getLocation={searchLocation}
        onSelect={onSelectSearchResult}
        loading={packagesLoading}
      />

      <div className="filter-header">Filter Destinations</div>
      <div className="chip-container">
        {filterOptions.map((filter) => {
          const isActive = activeFilters.includes(filter.id);
          return (
            <button
              key={filter.id}
              onClick={() => onToggleFilter(filter.id)}
              className={`filter-chip ${isActive ? 'active' : ''}`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}