import React from 'react';

const WelcomeModal = ({ onClose }) => {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        cursor: 'pointer',
        padding: '20px',
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          maxWidth: '560px',
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
          textAlign: 'center'
        }}
      >
        <div style={{ width: '100%', backgroundColor: '#df1d22', overflow: 'hidden' }}>
          <img
            src="https://prod-ew-image-global-v2.s3.amazonaws.com/Live/ImageUploader/crop-ec47509e-9fbf-96d9-83c3-2bf2e96f484f-flightcentre.jpg"
            alt="Flight Centre Banner"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              objectFit: 'contain'
            }}
          />
        </div>

        <div style={{ padding: '28px 24px' }}>
          <h2
            style={{
              margin: '0 0 14px 0',
              color: '#1a202c',
              fontSize: '22px',
              fontWeight: '700',
              fontFamily: 'Arial, sans-serif'
            }}
          >
            Welcome to the Interactive Travel Experience
          </h2>

          <p
            style={{
              margin: '0 0 16px 0',
              color: '#4a5568',
              fontSize: '15px',
              lineHeight: '1.6',
              fontFamily: 'Arial, sans-serif'
            }}
          >
            Explore featured holiday destinations and curated travel packages across the globe using our interactive map.
          </p>

          <p
            style={{
              margin: '0 0 24px 0',
              color: '#4a5568',
              fontSize: '14px',
              lineHeight: '1.6',
              fontFamily: 'Arial, sans-serif'
            }}
          >
            Pan and zoom across different locations to discover itinerary details, compare package pricing, shortlist your favourite trips, and submit your custom travel profile directly to our store team.
          </p>

          <div
            style={{
              backgroundColor: '#edf2f7',
              padding: '12px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#4a5568',
              fontWeight: '600',
              fontFamily: 'Arial, sans-serif'
            }}
          >
            Click anywhere to begin exploring
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;