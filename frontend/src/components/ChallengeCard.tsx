import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteChallenge } from '../lib/api';

interface ChallengeCardProps {
  id: string;
  title: string;
  songCount: number;
  createdAt: string;
  playCount: number;
  onDelete?: (id: string) => void;
}

type DeleteState = 'idle' | 'confirming' | 'deleting';

export const ChallengeCard: React.FC<ChallengeCardProps> = ({
  id,
  title,
  songCount,
  createdAt,
  playCount,
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

  return (
    <div
      style={{
        background: '#282828',
        borderRadius: '4px',
        padding: '16px',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
      }}
    >
      {/* Left: title + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: '"Courier New", monospace',
            fontWeight: 'bold',
            fontSize: '16px',
            color: '#FFFFFF',
            marginBottom: '4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: '"Courier New", monospace',
            fontSize: '12px',
            color: '#B3B3B3',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
          }}
        >
          {songCount} SONGS · {playCount} PLAYS · {formattedDate}
        </div>
      </div>

      {/* Right: action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        {deleteState === 'idle' && (
          <>
            <button
              onClick={() => navigate(`/challenge/${id}`)}
              style={{
                background: '#1DB954',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '500px',
                padding: '8px 16px',
                fontFamily: '"Courier New", monospace',
                fontWeight: 'bold',
                fontSize: '13px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.background = '#1ED760')}
              onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.background = '#1DB954')}
            >
              PLAY
            </button>

            {onDelete && (
              <button
                onClick={() => setDeleteState('confirming')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#535353',
                  fontFamily: '"Courier New", monospace',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  padding: '4px',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.color = '#B3B3B3')}
                onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.color = '#535353')}
              >
                DELETE
              </button>
            )}
          </>
        )}

        {deleteState === 'confirming' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: '12px',
                color: '#B3B3B3',
              }}
            >
              Delete this challenge?
            </span>
            <button
              onClick={handleConfirmDelete}
              style={{
                background: '#535353',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '500px',
                padding: '6px 12px',
                fontFamily: '"Courier New", monospace',
                fontWeight: 'bold',
                fontSize: '11px',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              CONFIRM
            </button>
            <button
              onClick={() => setDeleteState('idle')}
              style={{
                background: 'none',
                border: 'none',
                color: '#B3B3B3',
                fontFamily: '"Courier New", monospace',
                fontSize: '11px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              CANCEL
            </button>
          </div>
        )}

        {deleteState === 'deleting' && (
          <span
            style={{
              fontFamily: '"Courier New", monospace',
              fontSize: '12px',
              color: '#535353',
              textTransform: 'uppercase',
            }}
          >
            DELETING...
          </span>
        )}
      </div>
    </div>
  );
};
