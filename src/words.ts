import englishWords from 'an-array-of-english-words';

export const WORDS: string[] = englishWords.filter(w => w.length === 6 && /^[A-Z]+$/i.test(w)).map(w => w.toUpperCase());

function seededRng(seed: number) {
  return () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
}

function shuffleArray<T>(items: T[], seed: number): T[] {
  const arr = items.slice();
  const rand = seededRng(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const SHUFFLED_WORDS = shuffleArray(WORDS, 421347);

export function getDailyPuzzleId(): number {
  const now = new Date();
  const epochDay = Date.UTC(2022, 0, 1);
  const localToday = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((localToday - epochDay) / (1000 * 60 * 60 * 24));
}

export function getDailyWord(): string {
  const idx = getDailyPuzzleId() % SHUFFLED_WORDS.length;
  return SHUFFLED_WORDS[idx];
}

export function getRandomWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

export function isValidGuess(word: string): boolean {
  return WORDS.includes(word.toUpperCase());
}
