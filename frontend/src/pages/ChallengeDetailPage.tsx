import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { getChallenge } from '../lib/api';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import type { ChallengeDetail } from '../types';

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  totalScore: number;
  completionTimeMs: number;
  completedAt: string | null;
}

const SkeletonRow: React.FC = () => (
  <div style={{ height: 40, background: '#282828', borderRadius: 4, marginBottom: 4, opacity: 0.5 }} />
);

const formatMs = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
};

export const ChallengeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getChallenge(id)
      .then(setChallenge)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Real-time Firestore leaderboard via onSnapshot
  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, 'scores'),
      where('challengeId', '==', id),
      orderBy('totalScore', 'desc'),
      orderBy('completionTimeMs', 'asc'),
      limit(10),
    );
    const unsub = onSnapshot(q, snapshot => {
      const entries: LeaderboardEntry[] = snapshot.docs.map((doc, i) => {
        const d = doc.data();
        return {
          rank: i + 1,
          displayName: d.displayName || `Player ${i + 1}`,
          totalScore: d.totalScore ?? 0,
          completionTimeMs: d.completionTimeMs ?? 0,
          completedAt: d.completedAt?.toDate?.()?.toISOString() ?? null,
        };
      });
      setLeaderboard(entries);
      setLbLoading(false);
    }, () => setLbLoading(false));
    return () => unsub();
  }, [id]);

  const mono: React.CSSProperties = { fontFamily: '"Courier New", monospace' };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#121212' }}>
      <NavBar />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '80px 16px', ...mono, color: '#B3B3B3', textAlign: 'center' }}>LOADING...</div>
    </div>
  );

  if (error || !challenge) return (
    <div style={{ minHeight: '100vh', background: '#121212' }}>
      <NavBar />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '80px 16px', ...mono, color: '#B3B3B3', textAlign: 'center' }}>{error || 'Challenge not found.'}</div>
    </div>
  );

  const isCurrentUser = (entry: LeaderboardEntry) =>
    user?.displayName && entry.displayName === user.displayName;

  return (
    <div style={{ minHeight: '100vh', background: '#121212', color: '#FFFFFF' }}>
      <NavBar />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 16px' }}>

        <h1 style={{ ...mono, fontWeight: 'bold', fontSize: 'clamp(22px, 5vw, 32px)', marginBottom: 8, wordBreak: 'break-word' }}>
          {challenge.title}
        </h1>
        <p style={{ fontFamily: 'Georgia,serif', fontSize: 14, color: '#B3B3B3', marginBottom: 4 }}>by {challenge.creatorUid}</p>
        <p style={{ ...mono, fontSize: 12, color: '#B3B3B3', textTransform: 'uppercase', marginBottom: 8 }}>
          {challenge.songCount} SONGS · {challenge.playCount} PLAYS
        </p>
        {challenge.description && (
          <p style={{ fontFamily: 'Georgia,serif', fontSize: 15, color: '#B3B3B3', marginBottom: 24 }}>{challenge.description}</p>
        )}

        {/* Play button */}
        <button
          onClick={() => navigate(`/play/${id}/0`)}
          style={{
            background: '#1DB954', color: '#FFFFFF', border: 'none', borderRadius: 500,
            padding: '14px 40px', ...mono, fontWeight: 'bold', fontSize: 15,
            textTransform: 'uppercase', cursor: 'pointer', marginBottom: 48,
            transition: 'background 0.15s', minHeight: 44,
          }}
          onMouseEnter={e => ((e.target as HTMLButtonElement).style.background = '#1ED760')}
          onMouseLeave={e => ((e.target as HTMLButtonElement).style.background = '#1DB954')}
        >
          PLAY CHALLENGE
        </button>

        {/* Leaderboard */}
        <h2 style={{ ...mono, fontWeight: 'bold', fontSize: 18, textTransform: 'uppercase', marginBottom: 16 }}>LEADERBOARD</h2>

        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 80px 70px', gap: 8, padding: '0 8px 8px', ...mono, fontSize: 11, color: '#B3B3B3', fontWeight: 'bold', textTransform: 'uppercase' }}>
          <span>#</span><span>PLAYER</span><span style={{ textAlign: 'right' }}>SCORE</span><span style={{ textAlign: 'right' }}>TIME</span>
        </div>

        {lbLoading && <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>}

        {!lbLoading && leaderboard.length === 0 && (
          <p style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: 15, color: '#B3B3B3', textAlign: 'center', padding: '24px 0' }}>
            No scores yet. Be the first to play!
          </p>
        )}

        {leaderboard.map(entry => {
          const mine = isCurrentUser(entry);
          return (
            <div
              key={entry.rank}
              style={{
                display: 'grid', gridTemplateColumns: '36px 1fr 80px 70px', gap: 8,
                padding: '10px 8px', marginBottom: 2, borderRadius: 4,
                background: mine ? '#282828' : 'transparent',
                borderLeft: mine ? '3px solid #1DB954' : '3px solid transparent',
                ...mono, fontSize: 13, color: '#FFFFFF',
                alignItems: 'center',
              }}
            >
              <span style={{ color: '#B3B3B3' }}>{entry.rank}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.displayName}</span>
              <span style={{ textAlign: 'right', color: '#1DB954', fontWeight: 'bold' }}>{entry.totalScore}</span>
              <span style={{ textAlign: 'right', color: '#B3B3B3' }}>{formatMs(entry.completionTimeMs)}</span>
            </div>
          );
        })}

        {/* Tracklist */}
        <h2 style={{ ...mono, fontWeight: 'bold', fontSize: 14, color: '#B3B3B3', textTransform: 'uppercase', marginBottom: 12, marginTop: 48 }}>TRACKS</h2>
        {challenge.songs.map((_, i) => (
          <div key={i} style={{ ...mono, fontSize: 13, color: '#535353', textTransform: 'uppercase', padding: '10px 0', borderBottom: '1px solid #282828' }}>
            {i + 1}. TRACK {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
};
