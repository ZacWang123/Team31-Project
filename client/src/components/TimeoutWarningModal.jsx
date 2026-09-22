import React from 'react';

const TimeoutWarningModal = ({ countdown, onKeepExploring }) => {
  return (
    <div
      onClick={onKeepExploring}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        cursor: 'pointer',
        padding: '20px',
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          maxWidth: '440px',
          width: '100%',
          padding: '32px 24px',
          textAlign: 'center',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
          boxSizing: 'border-box'
        }}
      >
        <div
          style={{
            fontSize: '52px',
            fontWeight: 'bold',
            color: '#df1d22',
            marginBottom: '12px',
            fontFamily: 'Arial, sans-serif'
          }}
        >
          {countdown}s
        </div>

        <h3
          style={{
            margin: '0 0 10px 0',
            fontSize: '20px',
            color: '#1a202c',
            fontFamily: 'Arial, sans-serif'
          }}
        >
          Are you still exploring?
        </h3>

        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '14px',
            color: '#4a5568',
            lineHeight: '1.5',
            fontFamily: 'Arial, sans-serif'
          }}
        >
          This screen and any saved packages will reset shortly. Touch anywhere to continue your session.
        </p>

        <button
          onClick={onKeepExploring}
          style={{
            backgroundColor: '#df1d22',
            color: '#ffffff',
            border: 'none',
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: 'bold',
            borderRadius: '6px',
            cursor: 'pointer',
            width: '100%',
            fontFamily: 'Arial, sans-serif'
          }}
        >
          Keep Exploring
        </button>
      </div>
    </div>
  );
};

export default TimeoutWarningModal;