export type LetterState = 'correct' | 'present' | 'absent' | 'empty' | 'active';

export interface Cell {
  letter: string;
  state: LetterState;
  revealed: boolean; // true = has been flashed and faded, false = just color
}

export interface GameState {
  answer: string;
  guesses: Cell[][];
  currentRow: number;
  currentCol: number;
  gameOver: boolean;
  won: boolean;
  letterMap: Record<string, LetterState>; // keyboard state - always visible
  ghostMap: Record<string, boolean>; // tracks what has been ghosted
}

export function createEmptyGrid(): Cell[][] {
  return Array.from({ length: 6 }, () =>
    Array.from({ length: 6 }, () => ({ letter: '', state: 'empty' as LetterState, revealed: false }))
  );
}

export function evaluateGuess(guess: string, answer: string): LetterState[] {
  const result: LetterState[] = Array(6).fill('absent');
  const answerArr = answer.split('');
  const guessArr = guess.split('');
  const used = Array(6).fill(false);

  // First pass: correct positions
  for (let i = 0; i < 6; i++) {
    if (guessArr[i] === answerArr[i]) {
      result[i] = 'correct';
      used[i] = true;
    }
  }

  // Second pass: present but wrong position
  for (let i = 0; i < 6; i++) {
    if (result[i] === 'correct') continue;
    for (let j = 0; j < 6; j++) {
      if (!used[j] && guessArr[i] === answerArr[j]) {
        result[i] = 'present';
        used[j] = true;
        break;
      }
    }
  }

  return result;
}
