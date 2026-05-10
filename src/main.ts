import './style.css';
import { getDailyPuzzleId, getDailyWord, isValidGuess } from './words';
import { createEmptyGrid, evaluateGuess } from './game';
import type { LetterState, GameState } from './game';

const WORD_LENGTH = 6;
const MAX_GUESSES = 6;
const FLASH_DURATION = 600;
const FADE_DURATION = 400;
const STORAGE_KEY = 'memordle:daily-state:v1';
const STATS_KEY = 'memordle:stats:v1';

const KEYBOARD_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
];

type SavedGameState = GameState & {
  puzzleId: number;
};

type GameStats = {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: number[];
  lastRecordedPuzzleId: number | null;
};

const dailyPuzzleId = getDailyPuzzleId();
const dailyAnswer = getDailyWord();
const LETTER_STATES: LetterState[] = ['correct', 'present', 'absent', 'empty', 'active'];

const DEFAULT_STATS: GameStats = {
  played: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: Array(MAX_GUESSES).fill(0),
  lastRecordedPuzzleId: null,
};

function createNewState(): GameState {
  return {
    answer: dailyAnswer,
    guesses: createEmptyGrid(),
    currentRow: 0,
    currentCol: 0,
    gameOver: false,
    won: false,
    letterMap: {},
    ghostMap: {},
  };
}

function isValidSavedState(value: unknown): value is SavedGameState {
  if (!value || typeof value !== 'object') return false;
  const saved = value as Partial<SavedGameState>;
  return (
    saved.puzzleId === dailyPuzzleId &&
    saved.answer === dailyAnswer &&
    Array.isArray(saved.guesses) &&
    saved.guesses.length === MAX_GUESSES &&
    saved.guesses.every(row =>
      Array.isArray(row) &&
      row.length === WORD_LENGTH &&
      row.every(cell =>
        cell &&
        typeof cell.letter === 'string' &&
        LETTER_STATES.includes(cell.state) &&
        typeof cell.revealed === 'boolean'
      )
    ) &&
    typeof saved.currentRow === 'number' &&
    saved.currentRow >= 0 &&
    saved.currentRow <= MAX_GUESSES &&
    typeof saved.currentCol === 'number' &&
    saved.currentCol >= 0 &&
    saved.currentCol <= WORD_LENGTH &&
    typeof saved.gameOver === 'boolean' &&
    typeof saved.won === 'boolean' &&
    typeof saved.letterMap === 'object' &&
    typeof saved.ghostMap === 'object'
  );
}

function loadSavedState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createNewState();
    const saved = JSON.parse(raw);
    if (!isValidSavedState(saved)) return createNewState();
    return {
      answer: saved.answer,
      guesses: saved.guesses,
      currentRow: saved.currentRow,
      currentCol: saved.currentCol,
      gameOver: saved.gameOver,
      won: saved.won,
      letterMap: saved.letterMap,
      ghostMap: saved.ghostMap,
    };
  } catch {
    return createNewState();
  }
}

function isValidStats(value: unknown): value is GameStats {
  if (!value || typeof value !== 'object') return false;
  const stats = value as Partial<GameStats>;
  return (
    typeof stats.played === 'number' &&
    typeof stats.wins === 'number' &&
    typeof stats.currentStreak === 'number' &&
    typeof stats.maxStreak === 'number' &&
    (typeof stats.lastRecordedPuzzleId === 'number' || stats.lastRecordedPuzzleId === null) &&
    Array.isArray(stats.guessDistribution) &&
    stats.guessDistribution.length === MAX_GUESSES &&
    stats.guessDistribution.every(count => typeof count === 'number')
  );
}

function loadStats(): GameStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { ...DEFAULT_STATS, guessDistribution: [...DEFAULT_STATS.guessDistribution] };
    const stats = JSON.parse(raw);
    if (!isValidStats(stats)) return { ...DEFAULT_STATS, guessDistribution: [...DEFAULT_STATS.guessDistribution] };
    return stats;
  } catch {
    return { ...DEFAULT_STATS, guessDistribution: [...DEFAULT_STATS.guessDistribution] };
  }
}

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        puzzleId: dailyPuzzleId,
        ...state,
      })
    );
  } catch {
    // Ignore storage failures so the game still works in private or restricted browsers.
  }
}

function saveStats() {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage failures so gameplay and sharing still work.
  }
}

let state: GameState = loadSavedState();
let stats: GameStats = loadStats();

let isAnimating = false;

const gridEl = document.getElementById('grid')!;
const keyboardEl = document.getElementById('keyboard')!;
const messageEl = document.getElementById('message')!;
const answerRevealEl = document.getElementById('answer-reveal')!;
const newGameBtn = document.getElementById('new-game')!;
const sharePopup = document.getElementById('share-popup')!;
const shareText = document.getElementById('share-text') as HTMLTextAreaElement;
const statsSummaryEl = document.getElementById('stats-summary')!;
const statsDistributionEl = document.getElementById('stats-distribution')!;
const copyShareBtn = document.getElementById('copy-share')!;
const closeShareBtn = document.getElementById('close-share')!;

function buildGrid() {
  gridEl.innerHTML = '';
  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = document.createElement('div');
    row.classList.add('row');
    row.id = `row-${r}`;
    for (let c = 0; c < WORD_LENGTH; c++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.id = `cell-${r}-${c}`;
      row.appendChild(cell);
    }
    gridEl.appendChild(row);
  }
}

function buildKeyboard() {
  keyboardEl.innerHTML = '';
  KEYBOARD_ROWS.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.classList.add('kb-row');
    row.forEach(key => {
      const btn = document.createElement('button');
      btn.classList.add('key');
      if (key === 'ENTER' || key === '⌫') btn.classList.add('key-wide');
      btn.textContent = key;
      btn.dataset.key = key;
      btn.addEventListener('click', () => handleKey(key));
      rowEl.appendChild(btn);
    });
    keyboardEl.appendChild(rowEl);
  });
}

function updateGrid() {
  for (let r = 0; r < MAX_GUESSES; r++) {
    for (let c = 0; c < WORD_LENGTH; c++) {
      const cell = state.guesses[r][c];
      const el = document.getElementById(`cell-${r}-${c}`)!;
      el.textContent = cell.letter;
      el.className = 'cell';
      if (cell.letter) el.classList.add('filled');
      if (cell.revealed) {
        el.classList.add('ghost');
      } else if (cell.state !== 'empty' && cell.state !== 'active') {
        el.classList.add(cell.state);
      }
      if (r === state.currentRow && !state.gameOver) el.classList.add('active-row');
      if (r === state.currentRow && c === state.currentCol && !state.gameOver) el.classList.add('cursor');
    }
  }
}

function updateKeyboard() {
  document.querySelectorAll('.key').forEach(el => {
    const key = (el as HTMLElement).dataset.key!;
    const s = state.letterMap[key];
    el.className = 'key';
    if (key === 'ENTER' || key === '⌫') el.classList.add('key-wide');
    if (s) el.classList.add(`kb-${s}`);
  });
}

function showMessage(text: string, persist = false) {
  messageEl.textContent = text;
  messageEl.classList.add('show');
  if (!persist) setTimeout(() => messageEl.classList.remove('show'), 1800);
}

function handleKey(key: string) {
  if (state.gameOver || isAnimating) return;
  if (key === '⌫' || key === 'BACKSPACE') {
    if (state.currentCol > 0) {
      state.currentCol--;
      state.guesses[state.currentRow][state.currentCol].letter = '';
      state.guesses[state.currentRow][state.currentCol].state = 'empty';
    }
  } else if (key === 'ENTER') {
    submitGuess(); return;
  } else if (/^[A-Z]$/.test(key) && state.currentCol < WORD_LENGTH) {
    state.guesses[state.currentRow][state.currentCol].letter = key;
    state.guesses[state.currentRow][state.currentCol].state = 'active';
    state.currentCol++;
  }
  updateGrid();
  saveState();
}

function submitGuess() {
  if (state.currentCol !== WORD_LENGTH) {
    showMessage('Not enough letters'); shakeRow(state.currentRow); return;
  }
  const guess = state.guesses[state.currentRow].map(c => c.letter).join('');
  if (!isValidGuess(guess)) {
    showMessage('Not in word list'); shakeRow(state.currentRow); return;
  }
  const results = evaluateGuess(guess, state.answer);
  isAnimating = true;

  results.forEach((s, c) => { state.guesses[state.currentRow][c].state = s; });

  // Update letter map for keyboard
  results.forEach((res, c) => {
    const letter = guess[c];
    const current = state.letterMap[letter];
    if (res === 'correct') state.letterMap[letter] = 'correct';
    else if (res === 'present' && current !== 'correct') state.letterMap[letter] = 'present';
    else if (!current) state.letterMap[letter] = 'absent';
  });

  updateGrid();
  updateKeyboard();
  saveState();

  // Ghost the grid cells after flash duration
  setTimeout(() => {
    const row = state.currentRow;
    for (let c = 0; c < WORD_LENGTH; c++) state.guesses[row][c].revealed = true;
    updateGrid();
    saveState();
    // Clear keyboard colors after flash
    state.letterMap = {};
    updateKeyboard();
    setTimeout(() => {
      isAnimating = false;
      checkEndGame(guess, results);
      saveState();
    }, FADE_DURATION);
  }, FLASH_DURATION);
}

function checkEndGame(_guess: string, results: LetterState[]) {
  const won = results.every(r => r === 'correct');
  if (won) {
    state.gameOver = state.won = true;
    recordGameResult(true, state.currentRow + 1);
    const msgs = ['Genius!','Magnificent!','Brilliant!','Great!','Nice!','Phew!'];
    showMessage(msgs[state.currentRow] || 'Nice!', true);
    revealAnswer(); updateGrid();
    saveState();
    setTimeout(() => showSharePopup(getShareText()), 800);
    return;
  }
  state.currentRow++; state.currentCol = 0;
  if (state.currentRow >= MAX_GUESSES) {
    state.gameOver = true;
    recordGameResult(false);
    showMessage(`The word was ${state.answer}`, true);
    revealAnswer();
    setTimeout(() => showSharePopup(getShareText()), 800);
  }
  updateGrid(); updateKeyboard();
  saveState();
}

function revealAnswer() {
  answerRevealEl.textContent = state.answer;
  answerRevealEl.classList.add('show');
}

function shakeRow(rowIndex: number) {
  const row = document.getElementById(`row-${rowIndex}`)!;
  row.classList.add('shake');
  setTimeout(() => row.classList.remove('shake'), 500);
}

function newGame() {
  state = createNewState();
  saveState();
  messageEl.classList.remove('show');
  answerRevealEl.classList.remove('show');
  sharePopup.style.display = 'none';
  buildGrid(); buildKeyboard(); updateGrid(); updateKeyboard();
}

function recordGameResult(won: boolean, guessCount?: number) {
  if (stats.lastRecordedPuzzleId === dailyPuzzleId) return;

  stats.played++;
  stats.lastRecordedPuzzleId = dailyPuzzleId;

  if (won && guessCount) {
    stats.wins++;
    stats.currentStreak++;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    stats.guessDistribution[guessCount - 1]++;
  } else {
    stats.currentStreak = 0;
  }

  saveStats();
}

function renderStats() {
  const winPercent = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const summaryItems = [
    ['Played', stats.played],
    ['Win %', winPercent],
    ['Current Streak', stats.currentStreak],
    ['Max Streak', stats.maxStreak],
  ];

  statsSummaryEl.innerHTML = '';
  summaryItems.forEach(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'stats-summary-item';

    const valueEl = document.createElement('strong');
    valueEl.textContent = String(value);

    const labelEl = document.createElement('span');
    labelEl.textContent = String(label);

    item.append(valueEl, labelEl);
    statsSummaryEl.appendChild(item);
  });

  const maxGuessCount = Math.max(1, ...stats.guessDistribution);
  statsDistributionEl.innerHTML = '<h2>Guess Distribution</h2>';
  stats.guessDistribution.forEach((count, index) => {
    const row = document.createElement('div');
    row.className = 'stats-row';

    const label = document.createElement('span');
    label.className = 'stats-row-label';
    label.textContent = String(index + 1);

    const bar = document.createElement('div');
    bar.className = 'stats-bar';
    bar.style.width = `${Math.max(8, (count / maxGuessCount) * 100)}%`;
    bar.textContent = String(count);

    row.append(label, bar);
    statsDistributionEl.appendChild(row);
  });
}

const EMOJI: Record<string, string> = { correct: '🟩', present: '🟨', absent: '⬜' };

function getShareText(): string {
  const guessCount = state.won ? state.currentRow + 1 : 'X';
  const lines = [`Memordle ${guessCount}/${MAX_GUESSES}`, ''];
  const finalRow = Math.min(state.currentRow, MAX_GUESSES - 1);
  for (let r = 0; r <= finalRow; r++) {
    const row = state.guesses[r];
    if (row[0].state === 'empty') break;
    lines.push(row.map(c => EMOJI[c.state] ?? '⬜').join(''));
  }
  lines.push('', 'https://memordle.vercel.app');
  return lines.join('\n');
}

function showSharePopup(text: string) {
  renderStats();
  shareText.value = text;
  sharePopup.style.display = 'flex';
}

copyShareBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(shareText.value).then(() => {
    copyShareBtn.textContent = 'Copied!';
    setTimeout(() => (copyShareBtn.textContent = 'Copy'), 1500);
  });
});

closeShareBtn.addEventListener('click', () => {
  sharePopup.style.display = 'none';
});

document.addEventListener('keydown', e => {
  const key = e.key.toUpperCase();
  if (key === 'BACKSPACE') handleKey('BACKSPACE');
  else if (key === 'ENTER') handleKey('ENTER');
  else if (/^[A-Z]$/.test(key)) handleKey(key);
});

newGameBtn.addEventListener('click', newGame);
buildGrid(); buildKeyboard(); updateGrid(); updateKeyboard();
if (state.gameOver) {
  revealAnswer();
  if (state.won) showMessage('Already solved', true);
  else showMessage(`The word was ${state.answer}`, true);
}
