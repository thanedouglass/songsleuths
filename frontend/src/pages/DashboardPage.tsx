import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { ChallengeCard } from '../components/ChallengeCard';
import { getMyChallenges } from '../lib/api';
import type { Challenge } from '../types';

const SkeletonCard: React.FC = () => (
  <div
    style={{
      background: '#282828',
      borderRadius: '4px',
      height: '72px',
      marginBottom: '8px',
      opacity: 0.5,
    }}
  />
);

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyChallenges()
      .then(setChallenges)
      .catch((err) => setError(err.message ?? 'Failed to load challenges.'))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = (id: string) => {
    setChallenges((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div style={{ minHeight: '100vh', background: '#121212', color: '#FFFFFF' }}>
      <NavBar />

      <div
        style={{
          maxWidth: '640px',
          margin: '0 auto',
          padding: '48px 16px',
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
          }}
        >
          <h1
            style={{
              fontFamily: '"Courier New", monospace',
              fontWeight: 'bold',
              fontSize: '24px',
              color: '#FFFFFF',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            YOUR CHALLENGES
          </h1>
          <button
            onClick={() => navigate('/create')}
            style={{
              background: '#1DB954',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '500px',
              padding: '10px 20px',
              fontFamily: '"Courier New", monospace',
              fontWeight: 'bold',
              fontSize: '13px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'background 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.background = '#1ED760')}
            onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.background = '#1DB954')}
          >
            + CREATE CHALLENGE
          </button>
        </div>

        {/* Content */}
        {loading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {!loading && error && (
          <p
            style={{
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              fontSize: '16px',
              color: '#B3B3B3',
              textAlign: 'center',
              marginTop: '48px',
            }}
          >
            {error}
          </p>
        )}

        {!loading && !error && challenges.length === 0 && (
          <p
            style={{
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              fontSize: '16px',
              color: '#B3B3B3',
              textAlign: 'center',
              marginTop: '48px',
            }}
          >
            No challenges yet. Create your first one!
          </p>
        )}

        {!loading && !error && challenges.map((c) => (
          <ChallengeCard
            key={c.id}
            id={c.id}
            title={c.title}
            songCount={c.songCount}
            createdAt={c.createdAt}
            playCount={c.playCount}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
};
