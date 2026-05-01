import englishWords from 'an-array-of-english-words';

export const WORDS: string[] = englishWords.filter(w => w.length === 6 && /^[A-Z]+$/i.test(w)).map(w => w.toUpperCase());

export function getRandomWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

export function isValidGuess(word: string): boolean {
  return WORDS.includes(word.toUpperCase());
}
