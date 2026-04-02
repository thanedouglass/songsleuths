import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { NowPlayingBar } from '../components/NowPlayingBar';
import { createChallenge } from '../lib/api';

interface FetchedSong {
  name: string;
}

export const CreateChallengePage: React.FC = () => {
  const navigate = useNavigate();

  // Form state
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ url?: string; title?: string }>({});

  // Fetch/preview state
  const [fetchedSongs, setFetchedSongs] = useState<FetchedSong[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Progress: 0=source, 1=fetched, 2=ready
  const step = hasFetched ? (title.trim() ? 2 : 1) : 0;
  const progress = step / 2;

  const validateUrl = () => {
    const valid =
      playlistUrl.startsWith('https://open.spotify.com/playlist/') ||
      playlistUrl.startsWith('spotify:playlist:');
    return valid ? {} : { url: 'Please enter a valid Spotify playlist URL' };
  };

  const handleFetch = async () => {
    setFetchError(null);
    setFieldErrors({});
    const errors = validateUrl();
    setFieldErrors(errors);
    if (errors.url) return;

    setIsFetching(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${baseUrl}/api/challenges/fetch_songs/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistUrl }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Always parse JSON so we can read the error field on non-2xx responses
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Server error ${response.status}`);
      }

      // Backend returns { songs: ['Title 1', 'Title 2', ...] }
      const songs: string[] = Array.isArray(data.songs) ? data.songs : [];
      setFetchedSongs(songs.map((name: string) => ({ name })));
      setHasFetched(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reach server';
      setFetchError(msg);
    } finally {
      setIsFetching(false);
    }
  };

  const validate = () => {
    const errors: { url?: string; title?: string } = { ...validateUrl() };
    if (!title.trim()) errors.title = 'Title is required';
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await createChallenge({ playlistUrl, title, description, visibility });
      navigate('/dashboard');
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full bg-surface-container-lowest border-none focus:ring-1 focus:ring-primary text-on-surface font-body px-4 py-3 outline-none placeholder:text-on-secondary-fixed-variant';

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface font-body selection:bg-primary selection:text-on-primary">
      <NavBar />

      <main className="max-w-content mx-auto pt-32 pb-24 px-4">

        {/* Title */}
        <section className="mb-12">
          <h1
            className="font-headline font-bold text-4xl text-primary"
            style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            Create Challenge
          </h1>
          <p className="font-body text-on-surface-variant mt-2 text-lg italic">
            The curator's workspace.
          </p>
        </section>

        {/* Progress indicator */}
        <div className="mb-16">
          <NowPlayingBar progress={progress} />
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-16">

          {/* Step 01 — Source */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <span
                className="font-label text-xs text-on-surface-variant"
                style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
              >
                01 / Source
              </span>
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                graphic_eq
              </span>
            </div>

            <div className="bg-surface-container p-6 space-y-6">
              <label
                className="block font-headline text-sm font-bold text-on-surface"
                style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
              >
                Spotify Playlist URL
              </label>
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="url"
                  value={playlistUrl}
                  onChange={e => setPlaylistUrl(e.target.value)}
                  placeholder="https://open.spotify.com/playlist/..."
                  className={`flex-1 ${inputClass}`}
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={handleFetch}
                  disabled={isFetching || submitting}
                  className="bg-primary-container text-on-primary-container font-label font-bold text-xs px-8 py-3 rounded-full hover:brightness-110 active:scale-95 transition-all disabled:opacity-60"
                  style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
                >
                  {isFetching ? 'SEARCHING SPOTIFY...' : 'FETCH'}
                </button>
              </div>
              {fieldErrors.url && (
                <p className="font-body text-sm text-error italic">{fieldErrors.url}</p>
              )}
              {fetchError && (
                <p className="font-body text-sm text-error italic">{fetchError}</p>
              )}
            </div>
          </section>

          {/* Step 02 — Preview */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <span
                className="font-label text-xs text-on-surface-variant"
                style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
              >
                02 / Preview
              </span>
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                list_alt
              </span>
            </div>

            <div className="bg-surface-container p-6">
              <h3
                className="font-headline text-sm font-bold text-on-surface mb-6"
                style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
              >
                Imported Titles
              </h3>

              {!hasFetched && (
                <p className="font-body text-base text-on-surface-variant italic">
                  Paste a Spotify playlist URL above and click FETCH to preview tracks.
                </p>
              )}

              {hasFetched && (
                <div className="max-h-[280px] overflow-y-auto pr-2 space-y-1">
                  {fetchedSongs.map((song, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 py-3 px-4 bg-surface-container-lowest hover:bg-surface-container-highest transition-colors group"
                    >
                      <span
                        className="font-label text-[10px] text-on-secondary-fixed-variant flex-shrink-0"
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="font-body text-lg group-hover:text-primary transition-colors">
                        {song.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Step 03 — Identity */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <span
                className="font-label text-xs text-on-surface-variant"
                style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
              >
                03 / Identity
              </span>
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                edit_note
              </span>
            </div>

            <div className="bg-surface-container p-6 space-y-8">
              {/* Title */}
              <div className="space-y-2">
                <label
                  className="block font-headline text-sm font-bold text-on-surface"
                  style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
                >
                  Challenge Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value.slice(0, 100))}
                  placeholder="Enter a name for this hunt..."
                  className={inputClass}
                  disabled={submitting}
                />
                <div className="flex justify-between items-center">
                  <span />
                  <span
                    className={`font-label text-[11px] ${title.length > 85 ? 'text-on-surface' : 'text-on-surface-variant'}`}
                  >
                    {title.length}/100
                  </span>
                </div>
                {fieldErrors.title && (
                  <p className="font-body text-sm text-error italic">{fieldErrors.title}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label
                  className="block font-headline text-sm font-bold text-on-surface"
                  style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
                >
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value.slice(0, 300))}
                  placeholder="Set the scene for your fellow sleuths..."
                  rows={3}
                  className={`${inputClass} resize-none`}
                  disabled={submitting}
                />
                <div className="flex justify-end">
                  <span
                    className={`font-label text-[11px] ${description.length > 255 ? 'text-on-surface' : 'text-on-surface-variant'}`}
                  >
                    {description.length}/300
                  </span>
                </div>
              </div>

              {/* Visibility */}
              <div className="space-y-2">
                <label
                  className="block font-headline text-sm font-bold text-on-surface"
                  style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
                >
                  Visibility
                </label>
                <select
                  value={visibility}
                  onChange={e => setVisibility(e.target.value)}
                  className={`${inputClass} cursor-pointer`}
                  disabled={submitting}
                >
                  <option value="public">Public</option>
                  <option value="private">Private — link only</option>
                </select>
              </div>
            </div>
          </section>

          {/* Publish */}
          <section className="pt-8 flex flex-col items-center gap-6">
            <button
              type="submit"
              disabled={submitting}
              className="w-full max-w-sm bg-primary-container text-on-primary-container font-headline font-bold text-lg py-5 rounded-full hover:brightness-110 active:scale-95 transition-all shadow-xl disabled:opacity-60"
              style={{ letterSpacing: '0.15em', textTransform: 'uppercase' }}
            >
              {submitting ? 'PUBLISHING...' : 'PUBLISH'}
            </button>
            <p
              className="font-label text-[10px] text-on-secondary-fixed-variant"
              style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              By publishing, you agree to our curator terms.
            </p>
            {apiError && (
              <p className="font-body text-sm text-error italic text-center">{apiError}</p>
            )}
          </section>
        </form>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-lowest mt-24 py-8">
        <div className="max-w-content mx-auto px-4 flex flex-col items-center gap-4">
          <div className="flex gap-8">
            {['Terms', 'Privacy Policy', 'Support'].map(l => (
              <a
                key={l}
                href="#"
                className="font-label text-xs text-on-surface-variant hover:text-primary transition-colors"
                style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
              >
                {l}
              </a>
            ))}
          </div>
          <p
            className="font-label text-[10px] text-on-surface-variant"
            style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            © 2024 SONGSLEUTHS. THE DIGITAL CURATOR.
          </p>
        </div>
      </footer>
    </div>
  );
};
