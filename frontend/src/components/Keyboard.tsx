import React from 'react';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

interface KeyboardProps {
  correctLetters: Set<string>;
  wrongLetters: Set<string>;
  onGuess: (letter: string) => void;
  /** Called when the on-screen ENTER key is pressed (e.g. open reveal-answer modal). */
  onEnter?: () => void;
  /** Called when the on-screen Backspace key is pressed (e.g. dismiss reveal-answer modal). */
  onBackspace?: () => void;
  disabled?: boolean;
}

export const Keyboard: React.FC<KeyboardProps> = ({
  correctLetters,
  wrongLetters,
  onGuess,
  onEnter,
  onBackspace,
  disabled = false,
}) => {
  const enterActive  = Boolean(onEnter)    && !disabled;
  const bkspActive   = Boolean(onBackspace) && !disabled;

  return (
    <div className="flex flex-col gap-2 items-center">
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-1.5">

          {ri === 2 && (
            <button
              type="button"
              onClick={enterActive ? onEnter : undefined}
              disabled={!enterActive}
              aria-label="Enter — reveal answer"
              className={[
                'key w-16 rounded-sm font-label text-[10px] font-bold flex items-center justify-center transition-colors',
                enterActive
                  ? 'bg-surface-container-highest text-on-surface hover:bg-surface-bright cursor-pointer active:scale-95'
                  : 'bg-surface-container-highest text-on-surface-variant cursor-default opacity-50',
              ].join(' ')}
            >
              ENTER
            </button>
          )}

          {row.split('').map((letter) => {
            const isCorrect  = correctLetters.has(letter);
            const isWrong    = wrongLetters.has(letter);
            const isDisabled = disabled || isCorrect || isWrong;

            return (
              <button
                key={letter}
                type="button"
                onClick={() => !isDisabled && onGuess(letter)}
                disabled={isDisabled}
                aria-label={`Guess letter ${letter}`}
                className={[
                  'key flex items-center justify-center rounded-sm font-headline font-bold transition-colors active:scale-95',
                  isCorrect
                    ? 'bg-primary text-on-primary cursor-default'
                    : isWrong
                    ? 'bg-secondary-container text-on-surface-variant cursor-default'
                    : 'bg-surface-container-highest text-on-surface hover:bg-surface-bright cursor-pointer',
                ].join(' ')}
              >
                {letter}
              </button>
            );
          })}

          {ri === 2 && (
            <button
              type="button"
              onClick={bkspActive ? onBackspace : undefined}
              disabled={!bkspActive}
              aria-label="Backspace — dismiss"
              className={[
                'key w-16 rounded-sm flex items-center justify-center transition-colors',
                bkspActive
                  ? 'bg-surface-container-highest text-on-surface hover:bg-surface-bright cursor-pointer active:scale-95'
                  : 'bg-surface-container-highest text-on-surface-variant cursor-default opacity-50',
              ].join(' ')}
            >
              <span className="material-symbols-outlined text-[18px]">backspace</span>
            </button>
          )}

        </div>
      ))}
    </div>
  );
};
