import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from './AuthModal';

export const NavBar: React.FC = () => {
  const { user, signOut } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const initials = (name: string | null | undefined) =>
    (name || '?').substring(0, 2).toUpperCase();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest h-16 flex items-center">
      <div className="flex justify-between items-center max-w-content mx-auto px-4 w-full">
        <Link
          to="/"
          className="text-2xl font-bold tracking-widest text-primary font-headline no-underline"
          style={{ letterSpacing: '0.08em' }}
        >
          SONGSLEUTHS
        </Link>

        <a
          href="/privacy"
          className="hidden sm:block font-label text-[11px] text-on-surface-variant hover:text-primary transition-colors"
          style={{ letterSpacing: '0.05em' }}
        >
          Privacy Policy
        </a>

        {user ? (
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center font-label font-bold text-xs text-primary">
              {initials(user.displayName || user.email)}
            </div>
            <button
              onClick={() => signOut()}
              className="font-label text-sm font-bold tracking-widest text-on-surface hover:text-primary transition-colors"
            >
              SIGN OUT
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowModal(true)}
            className="bg-primary-container text-on-primary px-6 py-2 rounded-full font-label font-bold text-sm transition-all active:scale-95 hover:brightness-110"
          >
            Sign In
          </button>
        )}
      </div>

      {showModal && <AuthModal onClose={() => setShowModal(false)} />}
    </header>
  );
};
