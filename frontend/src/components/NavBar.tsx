import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const NavBar: React.FC = () => {
  const { user, signOut } = useAuth();

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <nav className="flex h-[64px] w-full items-center justify-between border-b border-black-surface bg-black-deep px-4 font-mono uppercase">
      <Link to="/" className="text-[20px] font-bold text-green no-underline">
        SONGSLEUTHS
      </Link>
      
      <div className="flex items-center space-x-4">
        {user ? (
          <>
            <div className="flex h-[32px] w-[32px] items-center justify-center rounded-full bg-black-surface text-green">
              {getInitials(user.displayName || user.email)}
            </div>
            <button
              onClick={() => signOut()}
              className="text-[14px] text-white hover:text-green-light"
            >
              SIGN OUT
            </button>
          </>
        ) : (
          <Link
            to="/login"
            className="text-[14px] text-white hover:text-green-light no-underline"
          >
            SIGN IN
          </Link>
        )}
      </div>
    </nav>
  );
};
