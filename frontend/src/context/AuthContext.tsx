import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, signInWithGoogle, signInAnonymously, signOut } from '../lib/firebase';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInGuest: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signInGuest: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (e: any) {
      console.error('Sign-in failed. Check .env config:', e);
      alert(`Sign in failed. Are your Firebase environment variables set? Error: ${e.message}`);
    }
  };

  const handleSignInGuest = async () => {
    try {
      await signInAnonymously();
    } catch (e: any) {
      console.error('Guest sign-in failed. Check .env config:', e);
      alert(`Guest sign in failed. Are your Firebase environment variables set? Error: ${e.message}`);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black-deep">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-green border-t-transparent"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn: handleSignIn, signInGuest: handleSignInGuest, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
};
