import { useEffect, useRef, useState } from 'react';

export default function PackageSearch({ query, onQueryChange, results, onSelect, loading, getLocation }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const shownResults = results.slice(0, 6);
  const showList = open && query.trim() && !loading;

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, []);

  const choose = (pkg) => {
    onSelect(pkg);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!shownResults.length || !query.trim()) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => event.key === 'ArrowDown'
        ? (index + 1) % shownResults.length
        : (index - 1 + shownResults.length) % shownResults.length);
    }
    if (event.key === 'Enter' && showList && shownResults.length) {
      event.preventDefault();
      choose(shownResults[activeIndex >= 0 ? activeIndex : 0]);
    }
  };

  return (
    <div className="package-search" ref={rootRef}>
      <div className="package-search-field">
        <i aria-hidden="true" className="fi-rr-search package-search-icon" />
        <input
          id="package-search-input"
          className="package-search-input"
          type="text"
          role="combobox"
          aria-label="Search travel packages"
          aria-autocomplete="list"
          aria-controls="package-search-results"
          aria-expanded={Boolean(showList)}
          aria-activedescendant={showList && activeIndex >= 0 ? `package-search-option-${activeIndex}` : undefined}
          placeholder="Search packages, cities, destinations or countries"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        {query && <button type="button" className="package-search-clear" aria-label="Clear search" onClick={() => {
          onQueryChange('');
          setActiveIndex(-1);
          setOpen(false);
          rootRef.current?.querySelector('input')?.focus();
        }}><i className="fi-rr-cross-small" aria-hidden="true" /></button>}
      </div>
      {showList && (
        <div id="package-search-results" className="package-search-results" role="listbox" aria-label="Package search results">
          {shownResults.length ? shownResults.map((pkg, index) => (
            <div
              id={`package-search-option-${index}`}
              key={`${pkg.packageName || pkg.title || pkg.name}-${pkg.destination}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={`package-search-result ${index === activeIndex ? 'is-active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(pkg)}
            >
              <strong>{pkg.packageName || pkg.title || pkg.name || 'Package'}</strong>
              <span>{getLocation(pkg)}</span>
            </div>
          )) : <p className="package-search-empty">No matching packages found</p>}
        </div>
      )}
    </div>
  );
}
