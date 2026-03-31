import React, { useReducer, useEffect, useRef, useCallback } from 'react';
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
  revealedAt: Record<number, string>; // position → UPPER letter
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
  | { type: 'SHOW_MODAL'; show: boolean };

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
      return {
        ...state, revealedAt: rev,
        recentRevealPositions: action.positions,
        status: allDone ? 'won' : 'playing',
      };
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
      return {
        ...state, revealedAt: rev,
        status: action.newStatus,
        score: action.newScore ?? state.score,
        showRevealModal: false,
      };
    }

    case 'CLEAR_RECENT':
      return { ...state, recentRevealPositions: [] };

    case 'SHOW_MODAL':
      return { ...state, showRevealModal: action.show };

    default:
      return state;
  }
}

// ─── Keyboard rows ────────────────────────────────────────────────────────────
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

  // Load puzzle
  useEffect(() => {
    advancedRef.current = false;
    startTime.current = Date.now();
    prevResults.current = (location.state as any)?.songResults ?? prevResults.current;
    dispatch({ type: 'LOAD', payload: { tokens: [], artist: '', previewUrl: null, songId: '', songCount: 1 } });
    getChallengePuzzle(id!, songIndex).then(data => {
      dispatch({ type: 'LOAD', payload: { tokens: data.puzzleTokens, artist: data.artist, previewUrl: data.previewUrl, songId: data.songId, songCount: data.songCount } });
    });
  }, [id, songIndex]);

  // Clear recent reveal animation after it finishes
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
      navigate(`/results/${id}`, {
        state: { songResults: newResults, startTime: startTime.current },
      });
    } else {
      navigate(`/play/${id}/${next}`, { state: { songResults: newResults } });
    }
  }, [id, songIndex, navigate]);

  // Auto-advance on won
  useEffect(() => {
    if (state.status !== 'won') return;
    const t = setTimeout(() => advanceSong(), 1500);
    return () => clearTimeout(t);
  }, [state.status, advanceSong]);

  // Auto-reveal + advance on lost
  useEffect(() => {
    if (state.status !== 'lost') return;
    getSongAnswer(id!, songIndex).then(data => {
      dispatch({ type: 'FILL_ANSWER', title: data.title, newStatus: 'lost' });
    });
    const t = setTimeout(() => advanceSong({ status: 'lost' }), 2000);
    return () => clearTimeout(t);
  }, [state.status, id, songIndex, advanceSong]);

  // Auto-advance on revealed
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
    const correctLetters = new Set(Object.values(s.revealedAt));
    if (correctLetters.has(L)) return;

    submittingGuessRef.current = true;
    try {
      const res = await submitGuess(id!, songIndex, L);
      if (res.correct) {
        dispatch({ type: 'CORRECT', letter: L, positions: res.positions });
      } else {
        dispatch({ type: 'WRONG', letter: L });
      }
    } catch { /* ignore network errors during gameplay */ }
    finally { submittingGuessRef.current = false; }
  }, [id, songIndex]);

  // Physical keyboard
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

  // ─── Render helpers ────────────────────────────────────────────────────────
  const correctSet = new Set(Object.values(state.revealedAt));
  const mono: React.CSSProperties = { fontFamily: '"Courier New", monospace' };

  const renderTile = (token: PuzzleToken, idx: number) => {
    if (token.type === 'space') {
      return <span key={idx} style={{ display: 'inline-block', width: 8 }} />;
    }
    if (token.type === 'punctuation') {
      return (
        <span key={idx} style={{ ...mono, fontSize: 28, fontWeight: 'bold', color: '#B3B3B3', lineHeight: '52px', margin: '0 1px' }}>
          {token.char}
        </span>
      );
    }
    // Letter tile
    const pos = token.position!;
    const revealedLetter = state.revealedAt[pos];
    const isRevealed = revealedLetter !== undefined;
    const isRecent = state.recentRevealPositions.includes(pos);
    const isLost = state.status === 'lost' && isRevealed && !correctSet.has(revealedLetter);

    // Stagger delay for flip animation
    const staggerIdx = state.recentRevealPositions.indexOf(pos);
    const delay = staggerIdx >= 0 ? staggerIdx * 60 : 0;

    let bg = '#282828';
    let border = '2px solid #535353';
    let color = 'transparent';
    if (isRevealed && !isLost) { bg = '#1DB954'; border = 'none'; color = '#FFFFFF'; }
    if (isRevealed && isLost)  { bg = '#191414'; border = 'none'; color = '#B3B3B3'; }

    return (
      <span
        key={idx}
        className="tile"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 4,
          background: bg, border,
          ...mono, fontWeight: 'bold', color,
          margin: '2px',
          animation: isRecent ? `flipTile 0.4s ease-in-out ${delay}ms both` : undefined,
          transition: 'background 0.2s',
        }}
      >
        {isRevealed ? revealedLetter : ''}
      </span>
    );
  };

  const renderKey = (letter: string) => {
    const isWrong = state.wrongGuesses.includes(letter);
    const isCorrect = correctSet.has(letter);
    const disabled = isWrong || isCorrect || state.status !== 'playing';
    return (
      <button
        key={letter}
        onClick={() => handleGuess(letter)}
        disabled={disabled}
        className="key"
        style={{
          borderRadius: 4,
          background: isCorrect ? '#1DB954' : isWrong ? '#535353' : '#282828',
          color: isWrong ? '#B3B3B3' : '#FFFFFF',
          border: 'none', cursor: disabled ? 'default' : 'pointer',
          ...mono, fontWeight: 'bold',
          transition: 'background 0.15s',
          margin: '2px',
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
      {/* Flip animation keyframes */}
      <style>{`
        @keyframes flipTile {
          0%   { transform: rotateY(0deg); }
          50%  { transform: rotateY(90deg); }
          100% { transform: rotateY(0deg); }
        }
      `}</style>

      <NavBar />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>

        {/* Progress */}
        <div style={{ ...mono, fontSize: 12, color: '#B3B3B3', textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' }}>
          SONG {songIndex + 1} OF {state.songCount}
        </div>

        {/* Status message */}
        {state.status === 'won' && (
          <div style={{ ...mono, fontWeight: 'bold', fontSize: 24, color: '#1DB954', textAlign: 'center', marginBottom: 12 }}>
            NICE!
          </div>
        )}
        {state.status === 'lost' && (
          <div style={{ ...mono, fontWeight: 'bold', fontSize: 24, color: '#B3B3B3', textAlign: 'center', marginBottom: 12 }}>
            GAME OVER
          </div>
        )}

        {/* Attempt squares */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 20, height: 20, borderRadius: 4,
              background: i < state.attemptsLeft ? '#1DB954' : '#535353',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>

        {/* Tile board */}
        {state.status !== 'loading' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 32, minHeight: 100 }}>
            {state.tokens.map((t, i) => renderTile(t, i))}
          </div>
        )}

        {/* Artist hint */}
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#535353', textAlign: 'center', marginBottom: 24 }}>
          by {state.artist}
        </div>

        {/* Keyboard */}
        {ROWS.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            {row.split('').map(renderKey)}
          </div>
        ))}

        {/* Reveal button */}
        {(state.status === 'playing') && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button
              onClick={() => dispatch({ type: 'SHOW_MODAL', show: true })}
              style={{ background: 'none', border: 'none', ...mono, fontSize: 12, color: '#B3B3B3', cursor: 'pointer', textTransform: 'uppercase' }}
            >
              REVEAL ANSWER
            </button>
          </div>
        )}

        {/* Reveal modal */}
        {state.showRevealModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}>
            <div style={{ background: '#282828', borderRadius: 8, padding: 32, maxWidth: 360, textAlign: 'center' }}>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#FFFFFF', marginBottom: 24 }}>
                Reveal the answer? You'll score 0 points for this song.
              </p>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                <button
                  onClick={handleRevealConfirm}
                  style={{ background: '#535353', color: '#FFFFFF', border: 'none', borderRadius: 500, padding: '10px 20px', ...mono, fontWeight: 'bold', fontSize: 13, textTransform: 'uppercase', cursor: 'pointer' }}
                >
                  CONFIRM
                </button>
                <button
                  onClick={() => dispatch({ type: 'SHOW_MODAL', show: false })}
                  style={{ background: 'none', border: 'none', ...mono, fontSize: 13, color: '#B3B3B3', cursor: 'pointer', textTransform: 'uppercase' }}
                >
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
