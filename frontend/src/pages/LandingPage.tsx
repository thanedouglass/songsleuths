import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { AuthModal } from '../components/AuthModal';
import { ChallengeCard } from '../components/ChallengeCard';
import { getPublicChallenges } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { Challenge } from '../types';

const SkeletonCard: React.FC = () => (
  <div className="bg-surface-container p-6 rounded-lg h-[88px] animate-pulse opacity-50" />
);

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    getPublicChallenges()
      .then(setChallenges)
      .catch(() => setChallenges([]))
      .finally(() => setLoading(false));
  }, []);

  const handleCta = () => {
    if (user) navigate('/create');
    else setShowModal(true);
  };

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface font-body selection:bg-primary selection:text-on-primary">
      <NavBar />

      <main className="max-w-content mx-auto pt-32 pb-16 px-4 space-y-24">
        {/* Hero */}
        <section className="text-center space-y-8">
          <div className="space-y-4">
            <h1
              className="font-headline text-4xl md:text-5xl font-bold text-on-surface leading-tight"
              style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
            >
              Guess Song Titles From Your Playlists
            </h1>
            <p className="font-body text-xl text-on-surface-variant max-w-md mx-auto italic">
              Connect your library and decode the rhythm. A high-fidelity sonic
              challenge for the modern listener.
            </p>
          </div>
          <button
            onClick={handleCta}
            className="bg-primary-container text-on-primary font-label font-bold py-4 px-10 rounded-full text-lg hover:brightness-110 transition-all active:scale-95 shadow-lg"
            style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            {user ? 'CREATE A CHALLENGE' : 'GET STARTED'}
          </button>
          {!user && (
            <button
              onClick={() => navigate('/play/test-challenge/0')}
              className="bg-surface-container-high text-on-surface font-label font-bold py-4 px-10 rounded-full text-lg hover:brightness-110 md:ml-4 mt-4 md:mt-0 transition-all active:scale-95 shadow-lg"
              style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              DEMO GAMEPLAY
            </button>
          )}
        </section>

        {/* Public Challenges */}
        <section className="space-y-12">
          <div className="flex justify-between items-end">
            <h2
              className="font-headline text-xl font-bold text-primary"
              style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
            >
              Public Challenges
            </h2>
            <span
              className="font-label text-xs text-on-surface-variant"
              style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Live Feed
            </span>
          </div>

          <div className="space-y-4">
            {loading && (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}

            {!loading && challenges.length === 0 && (
              <p className="font-body text-base text-on-surface-variant italic text-center py-8">
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
                />
              ))}
          </div>
        </section>

        {/* Editorial Quote */}
        <section className="py-12" style={{ borderTop: '1px solid rgba(61,74,61,0.1)', borderBottom: '1px solid rgba(61,74,61,0.1)' }}>
          <blockquote className="font-body text-2xl text-on-surface italic text-center leading-relaxed">
            "Music is the shorthand of emotion. We just help you remember the
            words."
          </blockquote>
          <div className="mt-4 text-center">
            <span
              className="font-label text-xs text-primary"
              style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              — THE SONIC MONOLITH
            </span>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-lowest py-16">
        <div className="max-w-content mx-auto px-4 flex flex-col items-center gap-8">
          <div className="flex gap-8">
            {['Terms', 'Privacy Policy', 'Support'].map((link) => (
              <a
                key={link}
                href="#"
                className="font-label text-xs text-on-surface-variant hover:text-primary transition-colors"
                style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
              >
                {link}
              </a>
            ))}
          </div>
          <div className="h-px w-12 bg-primary opacity-30" />
          <p
            className="font-label text-[10px] text-on-surface-variant text-center opacity-60"
            style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            © 2024 SONGSLEUTHS. THE DIGITAL CURATOR.
          </p>
        </div>
      </footer>

      {showModal && (
        <AuthModal 
          onClose={() => setShowModal(false)} 
          onSuccess={() => navigate('/create')}
        />
      )}
    </div>
  );
};
