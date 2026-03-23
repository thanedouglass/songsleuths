import { create } from 'zustand';

const useGameStore = create((set) => ({
  challenge:       null,   // current challenge object
  currentSongIndex: 0,     // which song we're on
  guessedLetters:  [],     // all letters guessed so far
  incorrectCount:  0,      // 0-3
  score:           0,      // running score
  hintsUsed:       0,      // audio hints used this challenge
  status:          'idle', // 'idle' | 'playing' | 'won' | 'lost' | 'revealed'

  setChallenge:    (challenge) => set({ challenge }),
  guessLetter:     (letter)    => set((state) => ({
    guessedLetters: [...state.guessedLetters, letter.toUpperCase()]
  })),
  incrementIncorrect: ()       => set((state) => ({
    incorrectCount: state.incorrectCount + 1,
    status: state.incorrectCount + 1 >= 3 ? 'lost' : state.status
  })),
  useHint:         ()          => set((state) => ({ hintsUsed: state.hintsUsed + 1 })),
  resetPuzzle:     ()          => set({
    guessedLetters: [], incorrectCount: 0, status: 'idle', hintsUsed: 0
  }),
}));

export default useGameStore;
