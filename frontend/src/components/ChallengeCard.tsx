import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteChallenge } from '../lib/api';

interface ChallengeCardProps {
  id: string;
  title: string;
  songCount: number;
  createdAt: string;
  playCount: number;
  imageUrl?: string;
  curatorName?: string;
  onDelete?: (id: string) => void;
}

type DeleteState = 'idle' | 'confirming' | 'deleting';

export const ChallengeCard: React.FC<ChallengeCardProps> = ({
  id,
  title,
  songCount,
  createdAt,
  playCount,
  imageUrl,
  curatorName,
  onDelete,
}) => {
  const navigate = useNavigate();
  const [deleteState, setDeleteState] = useState<DeleteState>('idle');

  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handleConfirmDelete = async () => {
    setDeleteState('deleting');
    try {
      await deleteChallenge(id);
      onDelete?.(id);
    } catch {
      setDeleteState('idle');
    }
  };

  if (deleteState !== 'idle') {
    return (
      <div className="group bg-surface-container p-6 rounded-lg flex items-center justify-between transition-colors">
        {deleteState === 'confirming' && (
          <>
            <span className="font-body text-sm text-on-surface-variant italic">
              Delete "{title}"?
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleConfirmDelete}
                className="bg-surface-container-highest text-on-surface font-label font-bold text-xs tracking-widest px-4 py-2 rounded-full hover:bg-error/20 transition-colors"
              >
                CONFIRM
              </button>
              <button
                onClick={() => setDeleteState('idle')}
                className="font-label text-xs text-on-surface-variant hover:text-on-surface transition-colors"
              >
                CANCEL
              </button>
            </div>
          </>
        )}
        {deleteState === 'deleting' && (
          <span className="font-label text-xs tracking-widest text-on-surface-variant uppercase">
            DELETING...
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="group bg-surface-container p-6 rounded-lg flex items-center justify-between transition-colors hover:bg-surface-container-high">
      <div className="flex gap-6 items-center min-w-0">
        {/* Thumbnail */}
        <div className="w-16 h-16 bg-surface-container-highest rounded-sm overflow-hidden flex-shrink-0">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant text-2xl">
                music_note
              </span>
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="space-y-1 min-w-0">
          <h3
            className="font-headline text-base font-bold text-on-surface truncate"
            style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            {title}
          </h3>
          {curatorName ? (
            <p className="font-body text-sm text-on-surface-variant">
              Curated by <span className="italic">{curatorName}</span>
            </p>
          ) : (
            <p className="font-label text-xs text-on-surface-variant" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {songCount} Songs · {formattedDate}
            </p>
          )}
          <div className="flex items-center gap-2 font-label text-xs text-on-surface-variant" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            <span className="material-symbols-outlined text-[14px]">play_arrow</span>
            <span>{playCount.toLocaleString()} Plays</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
        <button
          onClick={() => navigate(`/challenge/${id}`)}
          className="bg-primary-container text-on-primary font-label font-bold h-10 px-6 rounded-full text-xs hover:scale-105 transition-transform active:scale-95"
          style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          PLAY
        </button>
        {onDelete && (
          <button
            onClick={() => setDeleteState('confirming')}
            className="font-label text-xs text-on-surface-variant hover:text-on-surface transition-colors"
            style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}
          >
            DELETE
          </button>
        )}
      </div>
    </div>
  );
};
