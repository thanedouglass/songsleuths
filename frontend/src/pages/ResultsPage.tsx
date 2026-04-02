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

const formatMs = (ms: number) => {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const ResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const songResults: SongResult[] = (location.state as any)?.songResults ?? [];
  const startTime: number = (location.state as any)?.startTime ?? Date.now();
  const completionTimeMs = Date.now() - startTime;

  const totalScore = songResults.reduce((sum, r) => sum + r.score, 0);
  const solvedCount = songResults.filter(r => r.status === 'won').length;
  const revealedCount = songResults.filter(r => r.status === 'revealed').length;

  // Score count-up animation
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

  // Submit score
  const submitted = useRef(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
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
      .then(res => { if (res.rank) setRank(res.rank); })
      .catch(e => setScoreError(e.message))
      .finally(() => setSubmitting(false));
  }, [user, id]);

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface font-body selection:bg-primary selection:text-on-primary">
      <NavBar />

      <main className="max-w-content mx-auto pt-24 pb-32 px-6">

        {/* Session header */}
        <section className="mb-12 text-center">
          <p
            className="font-label text-xs text-on-surface-variant mb-4"
            style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}
          >
            Session Completed
          </p>
          <h2
            className="font-headline text-3xl font-bold text-on-surface leading-tight"
            style={{ letterSpacing: '0.08em' }}
          >
            Challenge Complete!
          </h2>
        </section>

        {/* Final Score Card */}
        <div className="bg-surface-container rounded-lg p-8 mb-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-primary opacity-5 pointer-events-none" />
          <p
            className="font-label text-sm text-on-surface-variant mb-2"
            style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Final Score
          </p>
          <div
            className="font-headline text-7xl font-bold text-primary mb-4"
            style={{ letterSpacing: '-0.02em' }}
          >
            {displayScore.toLocaleString()}
          </div>

          {submitting && (
            <p className="font-label text-xs text-on-surface-variant" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Saving score...
            </p>
          )}

          {rank && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container-highest rounded-full">
              <span className="material-symbols-outlined text-primary text-sm">trophy</span>
              <span
                className="font-label text-xs font-bold text-on-surface"
                style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
              >
                Rank #{rank}
              </span>
            </div>
          )}

          {scoreError && (
            <p className="font-body text-sm text-on-surface-variant italic mt-2">
              Could not save score: {scoreError}
            </p>
          )}
        </div>

        {/* Performance Stats Bento */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          {[
            { label: 'Solved', value: `${solvedCount}/${songResults.length}`, color: 'text-on-surface' },
            { label: 'Revealed', value: revealedCount, color: 'text-error' },
            { label: 'Total Time', value: formatMs(completionTimeMs), color: 'text-on-surface' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-surface-container-low p-6 rounded-lg text-center">
              <p
                className="font-label text-[10px] text-on-surface-variant mb-2"
                style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
              >
                {label}
              </p>
              <p className={`font-headline text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Track Breakdown */}
        <section className="mb-12">
          <div className="flex justify-between items-end mb-6">
            <h3
              className="font-headline text-lg font-bold text-on-surface"
              style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
            >
              Track Breakdown
            </h3>
            <span
              className="font-label text-[10px] text-on-surface-variant"
              style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Details
            </span>
          </div>

          <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2">
            {songResults.map((r, i) => {
              const isRevealed = r.status === 'revealed';
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between p-4 rounded-sm transition-colors ${
                    isRevealed
                      ? 'bg-[#1a1a1a] opacity-60'
                      : 'bg-surface-container-low hover:bg-surface-container'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-body text-base text-on-surface">
                      Track {i + 1}
                    </span>
                    <span
                      className="font-label text-[10px] text-on-surface-variant"
                      style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
                    >
                      {r.status === 'won' ? 'Solved' : r.status === 'revealed' ? 'Revealed' : 'Failed'} · {r.incorrectCount} wrong
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span
                      className={`font-headline text-sm font-bold ${
                        r.score > 0 ? 'text-primary' : 'text-on-surface-variant'
                      }`}
                    >
                      {r.score > 0 ? `+${r.score} PTS` : '0 PTS'}
                    </span>
                    {isRevealed && (
                      <span
                        className="text-[9px] font-label text-error-container font-bold"
                        style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}
                      >
                        REVEALED
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {songResults.length === 0 && (
              <p className="font-body text-sm text-on-surface-variant italic text-center py-8">
                No results to display.
              </p>
            )}
          </div>
        </section>

        {/* Action Buttons */}
        <div className="flex flex-col gap-4">
          <button
            onClick={() => navigate(`/challenge/${id}`)}
            className="w-full py-5 bg-primary-container text-on-primary font-headline font-bold text-lg rounded-full hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3"
            style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            <span className="material-symbols-outlined">share</span>
            SHARE
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full py-5 bg-transparent border-2 border-outline-variant text-on-surface font-headline font-bold text-lg rounded-full hover:bg-surface-container active:scale-95 transition-all"
            style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            BACK TO FEED
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-lowest py-8">
        <div className="max-w-content mx-auto px-4 flex flex-col items-center gap-4">
          <div className="flex gap-6 font-label text-[10px] text-on-surface-variant" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {['Terms', 'Privacy Policy', 'Support'].map(l => (
              <a key={l} href="#" className="hover:text-primary transition-colors">{l}</a>
            ))}
          </div>
          <p className="font-label text-[10px] text-on-surface-variant" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            © 2024 SONGSLEUTHS. THE DIGITAL CURATOR.
          </p>
        </div>
      </footer>
    </div>
  );
};
