import React, { createContext, useContext, useState, useEffect } from 'react';

const TravelProfileContext = createContext();

export const TravelProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('user_travel_profile');
    return saved ? JSON.parse(saved) : {
      clickedFilters: {},
      viewedDestinations: {},
      likedPackages: {},
      searchQueries: []
    };
  });

  useEffect(() => {
    localStorage.setItem('user_travel_profile', JSON.stringify(profile));
  }, [profile]);

  // Track when a user clicks a filter (e.g., "cold", "beach", "luxury")
  const trackFilterClick = (filterName) => {
    setProfile(prev => ({
      ...prev,
      clickedFilters: {
        ...prev.clickedFilters,
        [filterName]: (prev.clickedFilters[filterName] || 0) + 1
      }
    }));
  };

  // Track when a user views or clicks a package/destination
  const trackPackageClick = (pkg) => {
    setProfile(prev => ({
      ...prev,
      viewedDestinations: {
        ...prev.viewedDestinations,
        [pkg.destination]: (prev.viewedDestinations[pkg.destination] || 0) + 1
      },
      likedPackages: {
        ...prev.likedPackages,
        [pkg.packageName]: (prev.likedPackages[pkg.packageName] || 0) + 1
      }
    }));
  };

  // Clear or reset profile if needed
  const resetProfile = () => {
    setProfile({
      clickedFilters: {},
      viewedDestinations: {},
      likedPackages: {},
      searchQueries: []
    });
    localStorage.removeItem('user_travel_profile');
  };

  return (
    <TravelProfileContext.Provider value={{ profile, trackFilterClick, trackPackageClick, resetProfile }}>
      {children}
    </TravelProfileContext.Provider>
  );
};

export const useTravelProfile = () => useContext(TravelProfileContext);