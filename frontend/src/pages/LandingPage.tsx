import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { ChallengeCard } from '../components/ChallengeCard';
import { getPublicChallenges } from '../lib/api';
import { useAuth } from '../context/AuthContext';
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

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicChallenges()
      .then(setChallenges)
      .catch(() => setChallenges([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#121212', color: '#FFFFFF' }}>
      <NavBar />

      {/* Hero */}
      <div
        style={{
          maxWidth: '640px',
          margin: '0 auto',
          padding: '80px 16px 0',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontFamily: '"Courier New", monospace',
            fontWeight: 'bold',
            fontSize: '48px',
            color: '#FFFFFF',
            lineHeight: 1.1,
            marginBottom: '16px',
            textTransform: 'uppercase',
          }}
        >
          GUESS THE SONG.
        </h1>
        <p
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: '18px',
            color: '#B3B3B3',
            marginBottom: '48px',
            lineHeight: 1.6,
          }}
        >
          Build a challenge from any Spotify playlist. Share it. Compete.
        </p>

        <button
          onClick={() => navigate(user ? '/create' : '/login')}
          style={{
            background: '#1DB954',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '500px',
            padding: '14px 32px',
            fontFamily: '"Courier New", monospace',
            fontWeight: 'bold',
            fontSize: '15px',
            textTransform: 'uppercase',
            cursor: 'pointer',
            letterSpacing: '0.05em',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.background = '#1ED760')}
          onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.background = '#1DB954')}
        >
          {user ? 'CREATE A CHALLENGE' : 'GET STARTED'}
        </button>
      </div>

      {/* Recent Challenges */}
      <div
        style={{
          maxWidth: '640px',
          margin: '80px auto 0',
          padding: '0 16px 80px',
        }}
      >
        <h2
          style={{
            fontFamily: '"Courier New", monospace',
            fontWeight: 'bold',
            fontSize: '18px',
            color: '#FFFFFF',
            textTransform: 'uppercase',
            marginBottom: '24px',
          }}
        >
          RECENT CHALLENGES
        </h2>

        {loading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {!loading && challenges.length === 0 && (
          <p
            style={{
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              fontSize: '16px',
              color: '#B3B3B3',
              textAlign: 'center',
            }}
          >
            No challenges yet. Be the first to create one!
          </p>
        )}

        {!loading &&
          challenges.map((c) => (
            <ChallengeCard
              key={c.id}
              id={c.id}
              title={c.title}
              songCount={c.songCount}
              createdAt={c.createdAt}
              playCount={c.playCount}
              // no onDelete — guests cannot delete
            />
          ))}
      </div>
    </div>
  );
};
