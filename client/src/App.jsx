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

      {/* Floating button to view live travel profile insights */}
      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 1000 }}>
        <button 
          onClick={() => setShowProfileModal(!showProfileModal)}
          style={{ background: '#fff', border: '1px solid #ccc', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
        >
          {showProfileModal ? 'Close Profile 👤' : 'View Travel Profile 👤'}
        </button>
      </div>

      {/* Live Profile Inspector Panel */}
      {showProfileModal && (
        <div style={{ position: 'absolute', top: '70px', right: '20px', width: '320px', background: '#fff', border: '1px solid #ccc', borderRadius: '8px', padding: '15px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>Live Travel Profile</h3>
            <button 
              onClick={resetProfile} 
              style={{ fontSize: '11px', background: '#ff4d4f', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
            >
              Reset
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
            Actions on the map (like clicking packages or destinations) update this profile instantly:
          </p>
          <pre style={{ fontSize: '11px', background: '#f5f5f5', padding: '10px', borderRadius: '4px', maxHeight: '300px', overflowY: 'auto' }}>
            {JSON.stringify(profile, null, 2)}
          </pre>
        </div>
      )}
    </main>
  );
}

export default App;