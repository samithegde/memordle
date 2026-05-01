import englishWords from 'an-array-of-english-words';

export const WORDS: string[] = englishWords.filter(w => w.length === 6 && /^[A-Z]+$/i.test(w)).map(w => w.toUpperCase());

function getDayIndex(): number {
  // Days since a fixed epoch (e.g., Jan 1, 2022)
  const epoch = new Date(Date.UTC(2022, 0, 1));
  const now = new Date();
  const diff = Math.floor((now.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export function getDailyWord(): string {
  const idx = getDayIndex() % WORDS.length;
  return WORDS[idx];
}

export function getRandomWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

export function isValidGuess(word: string): boolean {
  return WORDS.includes(word.toUpperCase());
}
