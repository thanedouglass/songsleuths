import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { submitChallengeScore } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface SongResult {
  songId: string;
  score: number;
  status: 'won' | 'lost' | 'revealed';
  incorrectCount: number;
  hintsUsed: number;
}

export const ResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const songResults: SongResult[] = (location.state as any)?.songResults ?? [];
  const startTime: number = (location.state as any)?.startTime ?? Date.now();
  const completionTimeMs = Date.now() - startTime;

  const totalScore = songResults.reduce((sum, r) => sum + r.score, 0);

  // Count-up animation
  const [displayScore, setDisplayScore] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const duration = 600;
    const animate = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      setDisplayScore(Math.round(totalScore * p));
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [totalScore]);

  // Submit score if logged in
  const submitted = useRef(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [scoreId, setScoreId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rank, setRank] = useState<number | null>(null);

  useEffect(() => {
    if (!user || submitted.current || !id || songResults.length === 0) return;
    submitted.current = true;
    setSubmitting(true);
    submitChallengeScore(id, {
      totalScore,
      completionTimeMs,
      songResults: songResults.map(r => ({
        songId: r.songId,
        score: r.score,
        status: r.status,
        incorrectCount: r.incorrectCount,
        hintsUsed: r.hintsUsed,
        displayName: user.displayName || user.email || 'Anonymous',
      })),
    })
      .then(res => {
        setScoreId(res.scoreId);
        if (res.rank) setRank(res.rank);
      })
      .catch(e => setScoreError(e.message))
      .finally(() => setSubmitting(false));
  }, [user, id]);

  const mono: React.CSSProperties = { fontFamily: '"Courier New", monospace' };
  const statusColor = (s: string) =>
    s === 'won' ? '#1DB954' : s === 'revealed' ? '#B3B3B3' : '#535353';

  return (
    <div style={{ minHeight: '100vh', background: '#121212', color: '#FFFFFF' }}>
      <NavBar />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 16px' }}>

        {/* Headline */}
        <h1 style={{ ...mono, fontWeight: 'bold', fontSize: 32, color: '#1DB954', textTransform: 'uppercase', marginBottom: 8 }}>
          CHALLENGE COMPLETE
        </h1>

        {/* Total score count-up */}
        <div style={{ ...mono, fontWeight: 'bold', fontSize: 56, color: '#FFFFFF', marginBottom: 32 }}>
          {displayScore}
          <span style={{ fontSize: 18, color: '#B3B3B3', marginLeft: 8 }}>PTS</span>
        </div>

        {/* Submission status */}
        {submitting && (
          <p style={{ ...mono, fontSize: 12, color: '#B3B3B3', textTransform: 'uppercase', marginBottom: 16 }}>
            SAVING SCORE...
          </p>
        )}
        {scoreId && (
          <p style={{ ...mono, fontSize: 12, color: '#1DB954', textTransform: 'uppercase', marginBottom: 8 }}>
            ✓ SCORE SAVED
          </p>
        )}
        {rank && (
          <div style={{ ...mono, fontWeight: 'bold', fontSize: 24, color: '#1DB954', marginBottom: 16 }}>
            YOU RANKED #{rank}
          </div>
        )}
        {scoreError && (
          <p style={{ fontFamily: 'Georgia,serif', fontSize: 12, color: '#B3B3B3', marginBottom: 16 }}>
            Could not save score: {scoreError}
          </p>
        )}

        {/* Song results table */}
        <div style={{ marginBottom: 48 }}>
          {songResults.map((r, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0', borderBottom: '1px solid #282828',
              }}
            >
              <span style={{ ...mono, fontSize: 13, color: '#B3B3B3', textTransform: 'uppercase' }}>
                TRACK {i + 1}
              </span>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                <span style={{ ...mono, fontWeight: 'bold', fontSize: 16, color: '#FFFFFF' }}>
                  {r.score} PTS
                </span>
                <span style={{ ...mono, fontSize: 11, color: statusColor(r.status), textTransform: 'uppercase', minWidth: 60 }}>
                  {r.status === 'won' ? 'SOLVED' : r.status === 'revealed' ? 'REVEALED' : 'FAILED'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate(`/challenge/${id}`)}
            style={{
              background: '#1DB954', color: '#FFFFFF', border: 'none', borderRadius: 500,
              padding: '12px 28px', ...mono, fontWeight: 'bold', fontSize: 14,
              textTransform: 'uppercase', cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => ((e.target as HTMLButtonElement).style.background = '#1ED760')}
            onMouseLeave={e => ((e.target as HTMLButtonElement).style.background = '#1DB954')}
          >
            PLAY AGAIN
          </button>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none', color: '#B3B3B3', border: '1px solid #535353', borderRadius: 500,
              padding: '12px 28px', ...mono, fontWeight: 'bold', fontSize: 14,
              textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            BACK TO HOME
          </button>
        </div>
      </div>
    </div>
  );
};
