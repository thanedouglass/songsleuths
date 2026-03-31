import React from 'react';
import { useNavigate } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '100vh', background: '#121212',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 16, textAlign: 'center',
    }}>
      <h1 style={{
        fontFamily: '"Courier New", monospace', fontWeight: 'bold',
        fontSize: 'clamp(32px, 10vw, 48px)', color: '#1DB954',
        textTransform: 'uppercase', marginBottom: 24,
      }}>
        PAGE NOT FOUND
      </h1>
      <button
        onClick={() => navigate('/')}
        style={{
          background: '#1DB954', color: '#FFFFFF', border: 'none',
          borderRadius: 500, padding: '14px 32px',
          fontFamily: '"Courier New", monospace', fontWeight: 'bold',
          fontSize: 15, textTransform: 'uppercase', cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => ((e.target as HTMLButtonElement).style.background = '#1ED760')}
        onMouseLeave={e => ((e.target as HTMLButtonElement).style.background = '#1DB954')}
      >
        GO HOME
      </button>
    </div>
  );
};
