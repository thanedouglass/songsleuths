import React, { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { getChallengePuzzle, submitGuess, getSongAnswer } from '../lib/api';
import type { PuzzleToken } from '../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SongResult {
  songId: string;
  score: number;
  status: 'won' | 'lost' | 'revealed';
  incorrectCount: number;
  hintsUsed: number;
}

interface GameState {
  tokens: PuzzleToken[];
  revealedAt: Record<number, string>;
  wrongGuesses: string[];
  attemptsLeft: number;
  status: 'loading' | 'playing' | 'won' | 'lost' | 'revealed';
  score: number;
  hintsUsed: number;
  artist: string;
  previewUrl: string | null;
  songId: string;
  songCount: number;
  recentRevealPositions: number[];
  showRevealModal: boolean;
}

type GameAction =
  | { type: 'LOAD'; payload: { tokens: PuzzleToken[]; artist: string; previewUrl: string | null; songId: string; songCount: number } }
  | { type: 'CORRECT'; letter: string; positions: number[] }
  | { type: 'WRONG'; letter: string }
  | { type: 'FILL_ANSWER'; title: string; newStatus: 'lost' | 'revealed'; newScore?: number }
  | { type: 'CLEAR_RECENT' }
  | { type: 'SHOW_MODAL'; show: boolean }
  | { type: 'USE_HINT' };

const initial: GameState = {
  tokens: [], revealedAt: {}, wrongGuesses: [], attemptsLeft: 3,
  status: 'loading', score: 100, hintsUsed: 0,
  artist: '', previewUrl: null, songId: '', songCount: 1,
  recentRevealPositions: [], showRevealModal: false,
};

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'LOAD':
      return { ...initial, ...action.payload, status: 'playing' };

    case 'CORRECT': {
      const rev = { ...state.revealedAt };
      action.positions.forEach(p => { rev[p] = action.letter.toUpperCase(); });
      const allDone = state.tokens
        .filter(t => t.type === 'letter')
        .every(t => rev[t.position!] !== undefined);
      return { ...state, revealedAt: rev, recentRevealPositions: action.positions, status: allDone ? 'won' : 'playing' };
    }

    case 'WRONG': {
      const left = state.attemptsLeft - 1;
      return {
        ...state,
        wrongGuesses: [...state.wrongGuesses, action.letter.toUpperCase()],
        attemptsLeft: left,
        score: Math.max(0, state.score - 20),
        status: left === 0 ? 'lost' : 'playing',
      };
    }

    case 'FILL_ANSWER': {
      const rev: Record<number, string> = { ...state.revealedAt };
      state.tokens.forEach(t => {
        if (t.type === 'letter' && t.position !== undefined) {
          const ch = action.title[t.position];
          if (ch) rev[t.position] = ch.toUpperCase();
        }
      });
      return { ...state, revealedAt: rev, status: action.newStatus, score: action.newScore ?? state.score, showRevealModal: false };
    }

    case 'USE_HINT':
      return { ...state, hintsUsed: state.hintsUsed + 1, score: Math.max(0, state.score - 25) };

    case 'CLEAR_RECENT':
      return { ...state, recentRevealPositions: [] };

    case 'SHOW_MODAL':
      return { ...state, showRevealModal: action.show };

    default:
      return state;
  }
}

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

// ─── Component ────────────────────────────────────────────────────────────────

export const GameplayPage: React.FC = () => {
  const { id, songIndex: idxStr } = useParams<{ id: string; songIndex: string }>();
  const songIndex = parseInt(idxStr ?? '0', 10);
  const navigate = useNavigate();
  const location = useLocation();

  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;

  const prevResults = useRef<SongResult[]>((location.state as any)?.songResults ?? []);
  const startTime = useRef(Date.now());
  const advancedRef = useRef(false);
  const submittingGuessRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioBlobUrl = useRef<string | null>(null);

  // Audio hint state (outside reducer — purely UI)
  const [hintAvailable, setHintAvailable] = useState<boolean | null>(null); // null = checking
  const [hintUsed, setHintUsed] = useState(false);
  const [hintPlaying, setHintPlaying] = useState(false);
  const [hintProgress, setHintProgress] = useState(0);

  // Load puzzle
  useEffect(() => {
    advancedRef.current = false;
    startTime.current = Date.now();
    setHintAvailable(null);
    setHintUsed(false);
    setHintPlaying(false);
    setHintProgress(0);
    if (audioBlobUrl.current) { URL.revokeObjectURL(audioBlobUrl.current); audioBlobUrl.current = null; }
    prevResults.current = (location.state as any)?.songResults ?? prevResults.current;
    dispatch({ type: 'LOAD', payload: { tokens: [], artist: '', previewUrl: null, songId: '', songCount: 1 } });
    getChallengePuzzle(id!, songIndex).then(data => {
      dispatch({ type: 'LOAD', payload: { tokens: data.puzzleTokens, artist: data.artist, previewUrl: data.previewUrl, songId: data.songId, songCount: data.songCount } });

      // Check if preview is available via a lightweight HEAD-like fetch
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      fetch(`${baseUrl}/api/challenges/${id}/songs/${songIndex}/preview/`, { method: 'HEAD' })
        .then(r => setHintAvailable(r.ok))
        .catch(() => setHintAvailable(false));
    });
  }, [id, songIndex]);

  useEffect(() => {
    if (state.recentRevealPositions.length === 0) return;
    const t = setTimeout(() => dispatch({ type: 'CLEAR_RECENT' }), 800);
    return () => clearTimeout(t);
  }, [state.recentRevealPositions]);

  const advanceSong = useCallback((extra: Partial<SongResult> = {}) => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    const s = stateRef.current;
    const result: SongResult = {
      songId: s.songId,
      score: extra.score ?? s.score,
      status: extra.status ?? (s.status as 'won' | 'lost' | 'revealed'),
      incorrectCount: 3 - s.attemptsLeft,
      hintsUsed: s.hintsUsed,
    };
    const newResults = [...prevResults.current, result];
    const next = songIndex + 1;
    if (next >= s.songCount) {
      navigate(`/results/${id}`, { state: { songResults: newResults, startTime: startTime.current } });
    } else {
      navigate(`/play/${id}/${next}`, { state: { songResults: newResults } });
    }
  }, [id, songIndex, navigate]);

  useEffect(() => {
    if (state.status !== 'won') return;
    const t = setTimeout(() => advanceSong(), 1500);
    return () => clearTimeout(t);
  }, [state.status, advanceSong]);

  useEffect(() => {
    if (state.status !== 'lost') return;
    getSongAnswer(id!, songIndex).then(data => {
      dispatch({ type: 'FILL_ANSWER', title: data.title, newStatus: 'lost' });
    });
    const t = setTimeout(() => advanceSong({ status: 'lost' }), 2000);
    return () => clearTimeout(t);
  }, [state.status, id, songIndex, advanceSong]);

  useEffect(() => {
    if (state.status !== 'revealed') return;
    const t = setTimeout(() => advanceSong({ status: 'revealed' }), 1000);
    return () => clearTimeout(t);
  }, [state.status, advanceSong]);

  const handleGuess = useCallback(async (letter: string) => {
    const s = stateRef.current;
    if (s.status !== 'playing' || submittingGuessRef.current) return;
    const L = letter.toUpperCase();
    if (s.wrongGuesses.includes(L)) return;
    if (new Set(Object.values(s.revealedAt)).has(L)) return;

    submittingGuessRef.current = true;
    try {
      const res = await submitGuess(id!, songIndex, L);
      if (res.correct) {
        dispatch({ type: 'CORRECT', letter: L, positions: res.positions });
      } else {
        dispatch({ type: 'WRONG', letter: L });
      }
    } catch { /* ignore */ }
    finally { submittingGuessRef.current = false; }
  }, [id, songIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (stateRef.current.status !== 'playing') return;
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) handleGuess(e.key);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleGuess]);

  const handleRevealConfirm = async () => {
    dispatch({ type: 'SHOW_MODAL', show: false });
    const data = await getSongAnswer(id!, songIndex);
    dispatch({ type: 'FILL_ANSWER', title: data.title, newStatus: 'revealed', newScore: 0 });
  };

  // Audio hint handler
  const handleHint = async () => {
    if (hintUsed || hintPlaying) return;
    dispatch({ type: 'USE_HINT' });
    setHintUsed(true);
    setHintPlaying(true);
    setHintProgress(0);

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const resp = await fetch(`${baseUrl}/api/challenges/${id}/songs/${songIndex}/preview/`);
      if (!resp.ok) { setHintPlaying(false); return; }
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      audioBlobUrl.current = blobUrl;

      const audio = new Audio(blobUrl);
      audioRef.current = audio;

      // Animate progress bar
      const duration = 30; // seconds cap
      let start = 0;
      const tick = () => {
        start += 0.1;
        setHintProgress(Math.min(start / duration, 1));
        if (start < duration && !audio.ended) requestAnimationFrame(tick);
        else setHintPlaying(false);
      };

      audio.addEventListener('ended', () => { setHintPlaying(false); setHintProgress(1); });
      audio.play().then(() => requestAnimationFrame(tick)).catch(() => setHintPlaying(false));
    } catch {
      setHintPlaying(false);
    }
  };

  // ─── Render helpers ────────────────────────────────────────────────────────
  const correctSet = new Set(Object.values(state.revealedAt));
  const mono: React.CSSProperties = { fontFamily: '"Courier New", monospace' };

  const renderTile = (token: PuzzleToken, idx: number) => {
    if (token.type === 'space') return <span key={idx} style={{ display: 'inline-block', width: 8 }} />;
    if (token.type === 'punctuation') {
      return <span key={idx} style={{ ...mono, fontSize: 22, fontWeight: 'bold', color: '#B3B3B3', margin: '0 1px' }}>{token.char}</span>;
    }
    const pos = token.position!;
    const revealedLetter = state.revealedAt[pos];
    const isRevealed = revealedLetter !== undefined;
    const isRecent = state.recentRevealPositions.includes(pos);
    const isLost = (state.status === 'lost') && isRevealed && !correctSet.has(revealedLetter);
    const staggerIdx = state.recentRevealPositions.indexOf(pos);
    const delay = staggerIdx >= 0 ? staggerIdx * 60 : 0;
    let bg = '#282828', border = '2px solid #535353', color = 'transparent';
    if (isRevealed && !isLost) { bg = '#1DB954'; border = 'none'; color = '#FFFFFF'; }
    if (isRevealed && isLost)  { bg = '#191414'; border = 'none'; color = '#B3B3B3'; }
    return (
      <span key={idx} className="tile" style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 4, background: bg, border, ...mono, fontWeight: 'bold', color,
        margin: '2px',
        animation: isRecent ? `flipTile 0.4s ease-in-out ${delay}ms both` : undefined,
        transition: 'background 0.2s',
      }}>
        {isRevealed ? revealedLetter : ''}
      </span>
    );
  };

  const renderKey = (letter: string) => {
    const isWrong = state.wrongGuesses.includes(letter);
    const isCorrect = correctSet.has(letter);
    const disabled = isWrong || isCorrect || state.status !== 'playing';
    return (
      <button key={letter} onClick={() => handleGuess(letter)} disabled={disabled}
        className="key"
        style={{
          borderRadius: 4,
          background: isCorrect ? '#1DB954' : isWrong ? '#535353' : '#282828',
          color: isWrong ? '#B3B3B3' : '#FFFFFF',
          border: 'none', cursor: disabled ? 'default' : 'pointer',
          ...mono, fontWeight: 'bold',
          transition: 'background 0.15s', margin: '2px',
          opacity: disabled && !isCorrect && !isWrong ? 0.6 : 1,
          minHeight: 44, minWidth: 32,
        }}
      >
        {letter}
      </button>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#121212', color: '#FFFFFF' }}>
      <style>{`
        @keyframes flipTile {
          0%   { transform: rotateY(0deg); }
          50%  { transform: rotateY(90deg); }
          100% { transform: rotateY(0deg); }
        }
      `}</style>

      <NavBar />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>

        <div style={{ ...mono, fontSize: 12, color: '#B3B3B3', textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' }}>
          SONG {songIndex + 1} OF {state.songCount}
        </div>

        {state.status === 'won' && (
          <div style={{ ...mono, fontWeight: 'bold', fontSize: 24, color: '#1DB954', textAlign: 'center', marginBottom: 12 }}>NICE!</div>
        )}
        {state.status === 'lost' && (
          <div style={{ ...mono, fontWeight: 'bold', fontSize: 24, color: '#B3B3B3', textAlign: 'center', marginBottom: 12 }}>GAME OVER</div>
        )}

        {/* Attempt squares */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 20, height: 20, borderRadius: 4, background: i < state.attemptsLeft ? '#1DB954' : '#535353', transition: 'background 0.2s' }} />
          ))}
        </div>

        {/* Tile board */}
        {state.status !== 'loading' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 32, minHeight: 50, gap: 4 }}>
            {state.tokens.map((t, i) => renderTile(t, i))}
          </div>
        )}

        <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#535353', textAlign: 'center', marginBottom: 24 }}>
          by {state.artist}
        </div>

        {/* Keyboard */}
        {ROWS.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            {row.split('').map(renderKey)}
          </div>
        ))}

        {/* Hint + Reveal buttons */}
        {state.status === 'playing' && (
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            {/* Audio hint */}
            {hintAvailable && (
              <div style={{ textAlign: 'center' }}>
                {hintUsed ? (
                  <div>
                    <span style={{ ...mono, fontSize: 11, color: '#535353', textTransform: 'uppercase' }}>HINT USED</span>
                    {hintPlaying && (
                      <div style={{ marginTop: 6, width: 160, height: 3, background: '#282828', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${hintProgress * 100}%`, height: '100%', background: '#1DB954', transition: 'width 0.1s linear' }} />
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={handleHint}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      ...mono, fontWeight: 'bold', fontSize: 12, color: '#B3B3B3',
                      textTransform: 'uppercase', minHeight: 44, padding: '0 8px',
                    }}
                  >
                    ▶ HINT (-25 PTS)
                  </button>
                )}
              </div>
            )}

            {/* Reveal answer */}
            <button
              onClick={() => dispatch({ type: 'SHOW_MODAL', show: true })}
              style={{ background: 'none', border: 'none', ...mono, fontSize: 12, color: '#535353', cursor: 'pointer', textTransform: 'uppercase', minHeight: 44 }}
            >
              REVEAL ANSWER
            </button>
          </div>
        )}

        {/* Reveal modal */}
        {state.showRevealModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#282828', borderRadius: 8, padding: 32, maxWidth: 360, width: '90%', textAlign: 'center' }}>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#FFFFFF', marginBottom: 24 }}>
                Reveal the answer? You'll score 0 points for this song.
              </p>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                <button onClick={handleRevealConfirm} style={{ background: '#535353', color: '#FFFFFF', border: 'none', borderRadius: 500, padding: '10px 20px', ...mono, fontWeight: 'bold', fontSize: 13, textTransform: 'uppercase', cursor: 'pointer', minHeight: 44 }}>
                  CONFIRM
                </button>
                <button onClick={() => dispatch({ type: 'SHOW_MODAL', show: false })} style={{ background: 'none', border: 'none', ...mono, fontSize: 13, color: '#B3B3B3', cursor: 'pointer', textTransform: 'uppercase', minHeight: 44 }}>
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
