  import React, { useState } from 'react';
  import WorldMap from './components/WorldMap';
  import { useTravelProfile } from './context/TravelProfileContext';

  function App() {
    const { profile, resetProfile } = useTravelProfile();
    const [showProfileModal, setShowProfileModal] = useState(false);

    return (
      <main style={{ margin: 0, padding: 0, width: '100vw', height: '100vh', position: 'relative' }}>
        {/* World Map takes up full screen */}
        <WorldMap />
      </main>
    );
  }

  export default App;