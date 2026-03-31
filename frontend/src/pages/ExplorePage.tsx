import React, { useEffect, useState } from 'react';
import { NavBar } from '../components/NavBar';
import { ChallengeCard } from '../components/ChallengeCard';
import { fetchApi } from '../lib/api';
import type { Challenge } from '../types';

const SkeletonCard: React.FC = () => (
  <div style={{ background: '#282828', borderRadius: 4, height: 72, marginBottom: 8, opacity: 0.5 }} />
);

export const ExplorePage: React.FC = () => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApi('/api/explore/')
      .then(setChallenges)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const mono: React.CSSProperties = { fontFamily: '"Courier New", monospace' };

  return (
    <div style={{ minHeight: '100vh', background: '#121212', color: '#FFFFFF' }}>
      <NavBar />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 16px' }}>
        <h1 style={{ ...mono, fontWeight: 'bold', fontSize: 24, textTransform: 'uppercase', marginBottom: 24 }}>
          EXPLORE CHALLENGES
        </h1>

        {loading && <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>}

        {!loading && error && (
          <p style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: 16, color: '#B3B3B3', textAlign: 'center' }}>
            {error}
          </p>
        )}

        {!loading && !error && challenges.length === 0 && (
          <p style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: 16, color: '#B3B3B3', textAlign: 'center' }}>
            No public challenges yet.
          </p>
        )}

        {!loading && !error && challenges.map(c => (
          <ChallengeCard
            key={c.id}
            id={c.id}
            title={c.title}
            songCount={c.songCount}
            createdAt={c.createdAt}
            playCount={c.playCount}
          />
        ))}
      </div>
    </div>
  );
};
