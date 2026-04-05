import React, {
  useReducer,
  useEffect,
  useRef,
  useCallback,
  useState,
} from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { PuzzleTile } from '../components/PuzzleTile';
import { Keyboard } from '../components/Keyboard';
import { NowPlayingBar } from '../components/NowPlayingBar';
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

// ─── Component ────────────────────────────────────────────────────────────────

export const GameplayPage: React.FC = () => {
  const { id, songIndex: idxStr } = useParams<{ id: string; songIndex: string }>();
  const songIndex = parseInt(idxStr ?? '0', 10);
  const navigate = useNavigate();
  const location = useLocation();

  const challengeTitle = (location.state as any)?.challengeTitle ?? '';

  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;

  const prevResults = useRef<SongResult[]>((location.state as any)?.songResults ?? []);
  const startTime = useRef(Date.now());
  const advancedRef = useRef(false);
  const submittingGuessRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioBlobUrl = useRef<string | null>(null);

  // Elapsed timer (UI only)
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (state.status !== 'playing') return;
    const interval = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [state.status]);

  const formatElapsed = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // Audio hint state
  const [hintAvailable, setHintAvailable] = useState<boolean | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintPlaying, setHintPlaying] = useState(false);
  const [hintProgress, setHintProgress] = useState(0);

  // Load puzzle
  useEffect(() => {
    advancedRef.current = false;
    startTime.current = Date.now();
    setElapsed(0);
    setHintAvailable(null);
    setHintUsed(false);
    setHintPlaying(false);
    setHintProgress(0);
    if (audioBlobUrl.current) { URL.revokeObjectURL(audioBlobUrl.current); audioBlobUrl.current = null; }
    prevResults.current = (location.state as any)?.songResults ?? prevResults.current;
    dispatch({ type: 'LOAD', payload: { tokens: [], artist: '', previewUrl: null, songId: '', songCount: 1 } });
    getChallengePuzzle(id!, songIndex).then(data => {
      dispatch({ type: 'LOAD', payload: { tokens: data.puzzleTokens, artist: data.artist, previewUrl: data.previewUrl, songId: data.songId, songCount: data.songCount } });
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
      navigate(`/play/${id}/${next}`, { state: { songResults: newResults, challengeTitle } });
    }
  }, [id, songIndex, navigate, challengeTitle]);

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
      if (res.correct) dispatch({ type: 'CORRECT', letter: L, positions: res.positions });
      else dispatch({ type: 'WRONG', letter: L });
    } catch { /* ignore */ }
    finally { submittingGuessRef.current = false; }
  }, [id, songIndex]);

  const handleRevealConfirm = useCallback(async () => {
    dispatch({ type: 'SHOW_MODAL', show: false });
    const data = await getSongAnswer(id!, songIndex);
    dispatch({ type: 'FILL_ANSWER', title: data.title, newStatus: 'revealed', newScore: 0 });
  }, [id, songIndex]);

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
      const duration = 30;
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const s = stateRef.current;

      // Enter — open reveal modal when playing; confirm it when modal is already open
      if (e.key === 'Enter') {
        e.preventDefault();
        if (s.showRevealModal) handleRevealConfirm();
        else if (s.status === 'playing') dispatch({ type: 'SHOW_MODAL', show: true });
        return;
      }

      // Backspace — dismiss the reveal modal
      if (e.key === 'Backspace') {
        if (s.showRevealModal) dispatch({ type: 'SHOW_MODAL', show: false });
        return;
      }

      if (s.status !== 'playing') return;
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) handleGuess(e.key);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleGuess, handleRevealConfirm]);

  // ─── Render helpers ────────────────────────────────────────────────────────

  const correctSet = new Set(Object.values(state.revealedAt));
  const wrongSet = new Set(state.wrongGuesses);

  const discoveredLetters = [...correctSet].sort();

  const renderTokens = () => {
    const groups: React.ReactNode[] = [];
    let wordBuffer: PuzzleToken[] = [];

    const flushWord = () => {
      if (wordBuffer.length === 0) return;
      groups.push(
        <div key={`word-${groups.length}`} className="flex gap-1 mb-2">
          {wordBuffer.map((t, i) => {
            const pos = t.position!;
            const revealedLetter = state.revealedAt[pos];
            const isRevealed = revealedLetter !== undefined;
            const isLost = state.status === 'lost' && isRevealed && !correctSet.has(revealedLetter);
            const isRecent = state.recentRevealPositions.includes(pos);
            const staggerIdx = state.recentRevealPositions.indexOf(pos);
            return (
              <PuzzleTile
                key={i}
                letter={isRevealed ? revealedLetter : undefined}
                state={isRevealed ? (isLost ? 'wrong' : 'correct') : 'unrevealed'}
                isRecent={isRecent}
                delay={staggerIdx >= 0 ? staggerIdx * 60 : 0}
              />
            );
          })}
        </div>
      );
      wordBuffer = [];
    };

    state.tokens.forEach((token, idx) => {
      if (token.type === 'space') {
        flushWord();
        groups.push(<div key={`space-${idx}`} className="w-2" />);
      } else if (token.type === 'punctuation') {
        flushWord();
        groups.push(
          <span
            key={`punct-${idx}`}
            className="font-headline text-2xl font-bold text-on-surface-variant opacity-40 mx-0.5 self-center"
          >
            {token.char}
          </span>
        );
      } else {
        wordBuffer.push(token);
      }
    });
    flushWord();
    return groups;
  };

  const progress = state.songCount > 0 ? (songIndex) / state.songCount : 0;

  // ─── Page ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface font-body selection:bg-primary selection:text-on-primary">
      <NavBar />

      {/* Full-width progress bar just below fixed header */}
      <div className="fixed top-16 left-0 right-0 z-40">
        <NowPlayingBar progress={progress} />
      </div>

      <main className="max-w-content mx-auto pt-24 pb-32 px-4 flex flex-col min-h-screen">

        {/* Header */}
        <section className="mb-12 mt-4">
          {challengeTitle && (
            <h2
              className="font-headline text-2xl font-bold text-on-surface mb-1"
              style={{ letterSpacing: '0.08em' }}
            >
              {challengeTitle}
            </h2>
          )}
          <p
            className="font-label text-xs text-on-surface-variant"
            style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Song {songIndex + 1} of {state.songCount}
          </p>
        </section>

        {/* Stats Bar */}
        <section className="grid grid-cols-3 gap-4 mb-16">
          {[
            { label: 'Attempts', value: state.attemptsLeft, highlight: false },
            { label: 'Score', value: state.score, highlight: true },
            { label: 'Time', value: formatElapsed(elapsed), highlight: false },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="bg-surface-container p-4 flex flex-col items-center justify-center rounded-lg">
              <span
                className="font-label text-[10px] text-on-surface-variant mb-1"
                style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
              >
                {label}
              </span>
              <span className={`font-headline text-lg font-bold ${highlight ? 'text-primary' : 'text-on-surface'}`}>
                {value}
              </span>
            </div>
          ))}
        </section>

        {/* Status Messages */}
        {state.status === 'won' && (
          <p
            className="font-headline text-2xl font-bold text-primary text-center mb-6"
            style={{ letterSpacing: '0.08em' }}
          >
            NICE!
          </p>
        )}
        {state.status === 'lost' && (
          <p
            className="font-headline text-2xl font-bold text-on-surface-variant text-center mb-6"
            style={{ letterSpacing: '0.08em' }}
          >
            GAME OVER
          </p>
        )}

        {/* Tile Board */}
        {state.status !== 'loading' && (
          <section className="flex flex-wrap justify-center gap-x-3 gap-y-1 mb-12 max-w-[400px] mx-auto">
            {renderTokens()}
          </section>
        )}

        {/* Artist */}
        <p className="font-body text-sm text-on-surface-variant italic text-center mb-12">
          by {state.artist}
        </p>

        {/* Letters Discovered */}
        {discoveredLetters.length > 0 && (
          <section className="flex flex-col items-center mb-12">
            <span
              className="font-label text-[10px] text-on-surface-variant mb-4"
              style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Letters Discovered
            </span>
            <div className="flex gap-3 text-on-surface font-headline font-bold text-lg flex-wrap justify-center">
              {discoveredLetters.map((letter, i) => (
                <React.Fragment key={letter}>
                  <span>{letter}</span>
                  {i < discoveredLetters.length - 1 && (
                    <span className="text-outline-variant opacity-30">·</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </section>
        )}

        {/* Hint + Reveal Actions */}
        {state.status === 'playing' && (
          <section className="flex flex-col items-center gap-4 mb-24">
            {hintAvailable && (
              <div className="text-center">
                {hintUsed ? (
                  <div>
                    <span
                      className="font-label text-[10px] text-on-surface-variant"
                      style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
                    >
                      Hint Used
                    </span>
                    {hintPlaying && (
                      <div className="mt-2 w-40 h-0.5 bg-surface-container-highest rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-100"
                          style={{ width: `${hintProgress * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={handleHint}
                    className="font-label text-sm font-bold text-on-surface-variant hover:text-primary transition-colors"
                    style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
                  >
                    ▶ HINT (−25 PTS)
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() => dispatch({ type: 'SHOW_MODAL', show: true })}
              className="px-8 py-3 rounded-full border-2 border-outline-variant text-on-surface font-label font-bold hover:bg-surface-container transition-colors active:scale-95"
              style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              REVEAL ANSWER
            </button>
          </section>
        )}

        {/* Keyboard */}
        <section className="mt-auto pb-8">
          <Keyboard
            correctLetters={correctSet}
            wrongLetters={wrongSet}
            onGuess={handleGuess}
            onEnter={() => dispatch({ type: 'SHOW_MODAL', show: true })}
            onBackspace={() => dispatch({ type: 'SHOW_MODAL', show: false })}
            disabled={state.status !== 'playing'}
          />
        </section>
      </main>

      {/* Reveal Confirm Modal */}
      {state.showRevealModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-surface-container rounded-lg p-8 max-w-sm w-[90%] text-center">
            <p className="font-body text-base text-on-surface mb-6">
              Reveal the answer? You'll score 0 points for this song.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleRevealConfirm}
                className="bg-surface-container-highest text-on-surface font-label font-bold text-sm px-6 py-3 rounded-full hover:bg-surface-bright transition-colors"
                style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
              >
                CONFIRM
              </button>
              <button
                onClick={() => dispatch({ type: 'SHOW_MODAL', show: false })}
                className="font-label text-sm text-on-surface-variant hover:text-on-surface transition-colors"
                style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
