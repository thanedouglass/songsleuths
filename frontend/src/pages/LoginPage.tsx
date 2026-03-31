import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { user, signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignIn = async () => {
    try {
      setError(null);
      await signIn();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    }
  };

  return (
    <div className="min-h-screen bg-black-deep text-white">
      <NavBar />
      <div className="flex h-[calc(100vh-64px)] items-center justify-center p-4">
        <div className="w-full max-w-[400px] text-center bg-black-deep">
          <h1 className="mb-2 font-mono text-[32px] font-bold text-green">SONGSLEUTHS</h1>
          <p className="mb-8 font-serif text-[18px] text-white">Guess the song. Beat your friends.</p>
          
          <button
            onClick={handleSignIn}
            className="rounded-[500px] bg-green px-[32px] py-[14px] font-mono text-[15px] font-bold uppercase text-white transition-transform hover:scale-102 hover:bg-green-light"
          >
            SIGN IN WITH GOOGLE
          </button>
          
          {error && (
            <p className="mt-4 text-sm text-red-500">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
};
