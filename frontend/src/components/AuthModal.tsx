import React from 'react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const { signIn, signInGuest } = useAuth();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div 
        className="bg-[#121212] border border-[#282828] rounded-xl p-8 max-w-md w-full shadow-2xl space-y-6"
      >
        <div className="flex justify-between items-start">
          <h2 className="font-headline font-bold text-2xl text-[#FFFFFF] tracking-widest uppercase">
            Identify
          </h2>
          <button 
            onClick={onClose}
            className="text-[#B3B3B3] hover:text-[#FFFFFF] transition-colors"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>

        <p className="font-body text-[#B3B3B3] italic text-sm">
          Connect your account to save your challenges and track your performance, or play anonymously as a guest sleuth.
        </p>

        <div className="space-y-4 pt-4">
          <button
            onClick={async () => {
              await signIn();
              onClose();
              if (onSuccess) onSuccess();
            }}
            className="w-full flex items-center justify-center gap-3 bg-[#1DB954] hover:bg-[#1ED760] text-[#121212] font-label font-bold py-4 px-6 rounded-full transition-colors active:scale-95"
            style={{ letterSpacing: '0.1em' }}
          >
            SIGN IN WITH GOOGLE
          </button>

          <button
            onClick={async () => {
              await signInGuest();
              onClose();
              if (onSuccess) onSuccess();
            }}
            className="w-full flex items-center justify-center gap-3 bg-[#282828] hover:bg-[#333333] text-[#FFFFFF] font-label font-bold py-4 px-6 rounded-full transition-colors active:scale-95"
            style={{ letterSpacing: '0.1em' }}
          >
            PLAY AS GUEST
          </button>
        </div>
      </div>
    </div>
  );
};
