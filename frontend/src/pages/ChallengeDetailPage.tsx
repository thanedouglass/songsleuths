import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { getChallenge } from '../lib/api';
import type { ChallengeDetail } from '../types';

export const ChallengeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getChallenge(id)
      .then(setChallenge)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const mono: React.CSSProperties = { fontFamily: '"Courier New", monospace' };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#121212' }}>
        <NavBar />
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '80px 16px', ...mono, color: '#B3B3B3', textAlign: 'center' }}>
          LOADING...
        </div>
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div style={{ minHeight: '100vh', background: '#121212' }}>
        <NavBar />
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '80px 16px', ...mono, color: '#B3B3B3', textAlign: 'center' }}>
          {error || 'Challenge not found.'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#121212', color: '#FFFFFF' }}>
      <NavBar />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 16px' }}>

        {/* Title */}
        <h1 style={{ ...mono, fontWeight: 'bold', fontSize: 32, color: '#FFFFFF', marginBottom: 8, wordBreak: 'break-word' }}>
          {challenge.title}
        </h1>

        {/* Meta */}
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#B3B3B3', marginBottom: 4 }}>
          by {challenge.creatorUid}
        </p>
        <p style={{ ...mono, fontSize: 12, color: '#B3B3B3', textTransform: 'uppercase', marginBottom: 8 }}>
          {challenge.songCount} SONGS · {challenge.playCount} PLAYS
        </p>

        {challenge.description && (
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#B3B3B3', marginBottom: 24 }}>
            {challenge.description}
          </p>
        )}

        {/* Play button */}
        <button
          onClick={() => navigate(`/play/${id}/0`)}
          style={{
            background: '#1DB954', color: '#FFFFFF', border: 'none',
            borderRadius: 500, padding: '14px 40px',
            ...mono, fontWeight: 'bold', fontSize: 15,
            textTransform: 'uppercase', cursor: 'pointer',
            letterSpacing: '0.05em', marginBottom: 48,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => ((e.target as HTMLButtonElement).style.background = '#1ED760')}
          onMouseLeave={e => ((e.target as HTMLButtonElement).style.background = '#1DB954')}
        >
          PLAY CHALLENGE
        </button>

        {/* Tracklist */}
        <h2 style={{ ...mono, fontWeight: 'bold', fontSize: 14, color: '#B3B3B3', textTransform: 'uppercase', marginBottom: 12 }}>
          TRACKS
        </h2>
        {challenge.songs.map((_, i) => (
          <div
            key={i}
            style={{
              ...mono, fontSize: 13, color: '#535353',
              textTransform: 'uppercase', padding: '10px 0',
              borderBottom: '1px solid #282828',
            }}
          >
            {i + 1}. TRACK {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
};
