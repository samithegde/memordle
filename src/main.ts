import './style.css';
import { getDailyWord, isValidGuess } from './words';
import { createEmptyGrid, evaluateGuess } from './game';
import type { LetterState, GameState } from './game';

const WORD_LENGTH = 6;
const MAX_GUESSES = 6;
const FLASH_DURATION = 600;
const FADE_DURATION = 400;

let state: GameState = {
  answer: getDailyWord(),
  guesses: createEmptyGrid(),
  currentRow: 0,
  currentCol: 0,
  gameOver: false,
  won: false,
  letterMap: {},
  ghostMap: {},
};

let isAnimating = false;

const gridEl = document.getElementById('grid')!;
const keyboardEl = document.getElementById('keyboard')!;
const messageEl = document.getElementById('message')!;
const answerRevealEl = document.getElementById('answer-reveal')!;
const newGameBtn = document.getElementById('new-game')!;

const KEYBOARD_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
];

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

  // Ghost the grid cells after flash duration
  setTimeout(() => {
    const row = state.currentRow;
    for (let c = 0; c < WORD_LENGTH; c++) state.guesses[row][c].revealed = true;
    updateGrid();
    // Clear keyboard colors after flash
    state.letterMap = {};
    updateKeyboard();
    setTimeout(() => {
      isAnimating = false;
      checkEndGame(guess, results);
    }, FADE_DURATION);
  }, FLASH_DURATION);
}

function checkEndGame(_guess: string, results: LetterState[]) {
  const won = results.every(r => r === 'correct');
  if (won) {
    state.gameOver = state.won = true;
    const msgs = ['Genius!','Magnificent!','Brilliant!','Great!','Nice!','Phew!'];
    showMessage(msgs[state.currentRow] || 'Nice!', true);
    revealAnswer(); updateGrid(); return;
  }
  state.currentRow++; state.currentCol = 0;
  if (state.currentRow >= MAX_GUESSES) {
    state.gameOver = true;
    showMessage(`The word was ${state.answer}`, true);
    revealAnswer();
  }
  updateGrid(); updateKeyboard();
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
  state = {
    answer: getDailyWord(),
    guesses: createEmptyGrid(),
    currentRow: 0, currentCol: 0,
    gameOver: false, won: false,
    letterMap: {}, ghostMap: {},
  };
  messageEl.classList.remove('show');
  answerRevealEl.classList.remove('show');
  buildGrid(); buildKeyboard(); updateGrid(); updateKeyboard();
}

document.addEventListener('keydown', e => {
  const key = e.key.toUpperCase();
  if (key === 'BACKSPACE') handleKey('BACKSPACE');
  else if (key === 'ENTER') handleKey('ENTER');
  else if (/^[A-Z]$/.test(key)) handleKey(key);
});

newGameBtn.addEventListener('click', newGame);
buildGrid(); buildKeyboard(); updateGrid();
