import React, { createContext, useContext, useState, useEffect } from 'react';

const TravelProfileContext = createContext(null);

export const TravelProfileProvider = ({ children }) => {
  // Single source of truth for saved packages, persisted to localStorage
  const [savedPackages, setSavedPackages] = useState(() => {
    try {
      const stored = localStorage.getItem('world_map_saved_packages');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load saved packages from localStorage', e);
      return [];
    }
  });

  // Viewed packages state, persisted to localStorage
  const [viewedPackages, setViewedPackages] = useState(() => {
    try {
      const stored = localStorage.getItem('world_map_viewed_packages');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load viewed packages from localStorage', e);
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('world_map_saved_packages', JSON.stringify(savedPackages));
    } catch (e) {
      console.error('Failed to save packages to localStorage', e);
    }
  }, [savedPackages]);

  useEffect(() => {
    try {
      localStorage.setItem('world_map_viewed_packages', JSON.stringify(viewedPackages));
    } catch (e) {
      console.error('Failed to save viewed packages to localStorage', e);
    }
  }, [viewedPackages]);

  const arePackagesSame = (pkgA, pkgB) => {
    if (!pkgA || !pkgB) return false;
    const idA = typeof pkgA === 'string' ? pkgA : (pkgA.id || pkgA.packageName);
    const idB = typeof pkgB === 'string' ? pkgB : (pkgB.id || pkgB.packageName);
    if (!idA || !idB) return false;
    return String(idA).trim() === String(idB).trim();
  };

  const toggleSavePackage = (targetPkg) => {
    setSavedPackages((prev) => {
      const exists = prev.some((p) => arePackagesSame(p, targetPkg));
      if (exists) {
        return prev.filter((p) => !arePackagesSame(p, targetPkg));
      } else {
        return [...prev, targetPkg];
      }
    });
  };

  const isPackageSaved = (targetPkg) => {
    return savedPackages.some((p) => arePackagesSame(p, targetPkg));
  };

  const trackFilterClick = (filterId) => {
    // Analytics/telemetry hook
  };

  const trackPackageClick = (pkg) => {
    if (!pkg) return;
    setViewedPackages((prev) => {
      const exists = prev.some((p) => arePackagesSame(p, pkg));
      if (exists) return prev; // Avoid duplicates, keep history clean
      return [pkg, ...prev]; // Add newest viewed to the top
    });
  };

  // ✅ Moved inside and fixed localStorage key names
  const resetProfile = () => {
    setSavedPackages([]);
    setViewedPackages([]);
    localStorage.removeItem('world_map_saved_packages');
    localStorage.removeItem('world_map_viewed_packages');
  };

  return (
    <TravelProfileContext.Provider
      value={{
        savedPackages,
        viewedPackages,
        toggleSavePackage,
        isPackageSaved,
        trackFilterClick,
        trackPackageClick,
        resetProfile, // ✅ Added here so WorldMap can access it
      }}
    >
      {children}
    </TravelProfileContext.Provider>
  );
};

export const useTravelProfile = () => {
  const context = useContext(TravelProfileContext);
  if (!context) {
    throw new Error('useTravelProfile must be used within a TravelProfileProvider');
  }
  return context;
};