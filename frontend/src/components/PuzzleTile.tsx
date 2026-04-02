import React from 'react';

export type TileState = 'unrevealed' | 'correct' | 'wrong';

interface PuzzleTileProps {
  letter?: string;
  state: TileState;
  isRecent?: boolean;
  delay?: number;
}

export const PuzzleTile: React.FC<PuzzleTileProps> = ({
  letter,
  state,
  isRecent = false,
  delay = 0,
}) => {
  const stateClass =
    state === 'correct'
      ? 'bg-primary-container text-white shadow-sm'
      : state === 'wrong'
      ? 'bg-[#191414] text-on-surface-variant'
      : 'bg-surface-container-highest border-2 border-outline-variant/20 text-transparent';

  return (
    <span
      className={`tile flex items-center justify-center rounded-sm font-headline font-bold select-none ${stateClass}`}
      style={isRecent ? { animation: `flipTile 0.4s ease-in-out ${delay}ms both` } : undefined}
    >
      {letter ?? ''}
    </span>
  );
};
