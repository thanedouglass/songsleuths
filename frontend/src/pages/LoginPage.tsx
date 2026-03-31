import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { user, signIn } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // After login, redirect to where the user originally wanted to go
  const from: string = (location.state as any)?.from ?? '/dashboard';

  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleSignIn = async () => {
    try {
      setError(null);
      setLoading(true);
      await signIn();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const mono: React.CSSProperties = { fontFamily: '"Courier New", monospace' };

  return (
    <div style={{ minHeight: '100vh', background: '#121212', color: '#FFFFFF' }}>
      <NavBar />
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 'calc(100vh - 64px)', padding: 16,
      }}>
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <h1 style={{ ...mono, fontWeight: 'bold', fontSize: 32, color: '#1DB954', marginBottom: 8 }}>
            SONGSLEUTHS
          </h1>
          <p style={{ fontFamily: 'Georgia,serif', fontSize: 18, color: '#FFFFFF', marginBottom: 48 }}>
            Guess the song. Beat your friends.
          </p>

          <button
            onClick={handleSignIn}
            disabled={loading}
            style={{
              background: loading ? '#169C46' : '#1DB954',
              color: '#FFFFFF', border: 'none', borderRadius: 500,
              padding: '14px 32px', ...mono, fontWeight: 'bold',
              fontSize: 15, textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s', width: '100%', maxWidth: 280,
              minHeight: 44,
            }}
            onMouseEnter={e => { if (!loading) (e.target as HTMLButtonElement).style.background = '#1ED760'; }}
            onMouseLeave={e => { if (!loading) (e.target as HTMLButtonElement).style.background = '#1DB954'; }}
          >
            {loading ? 'SIGNING IN...' : 'SIGN IN WITH GOOGLE'}
          </button>

          {error && (
            <p style={{ fontFamily: 'Georgia,serif', fontSize: 14, color: '#B3B3B3', marginTop: 16 }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
