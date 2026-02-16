/**
 * App initialization, routing, and wiring.
 */

import { createGrid } from './grid.js';
import { createGame } from './game.js';
import { createTimer } from './timer.js';
import { loadStats } from './storage.js';
import {
  setupCluesPanel,
  setupMobileClueToggle,
  showCompletionModal,
  showStatsModal,
  showConfetti,
  hideModal,
} from './ui.js';

// --- DOM refs ---
const gridEl = document.getElementById('grid');
const acrossEl = document.getElementById('clues-across');
const downEl = document.getElementById('clues-down');
const activeClueBar = document.getElementById('active-clue-bar');
const timerDisplay = document.getElementById('timer-display');
const datePicker = document.getElementById('date-picker');
const modalOverlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');
const modalClose = document.getElementById('modal-close');
const statsBtn = document.getElementById('stats-btn');
const btnRevealLetter = document.getElementById('btn-reveal-letter');
const btnRevealWord = document.getElementById('btn-reveal-word');
const btnRevealAll = document.getElementById('btn-reveal-all');

// --- State ---
let currentLevel = 'daily';
let currentDate = null;
let grid = null;
let game = null;
let timer = null;
let cluesPanel = null;
let availableIndexes = {};

const DATA_BASE = '../data';

// --- Data loading ---
async function loadIndex(level) {
  if (availableIndexes[level]) return availableIndexes[level];
  try {
    const res = await fetch(`${DATA_BASE}/${level}/index.json`);
    if (!res.ok) return null;
    const data = await res.json();
    availableIndexes[level] = data;
    return data;
  } catch {
    return null;
  }
}

async function loadPuzzle(level, date) {
  try {
    const res = await fetch(`${DATA_BASE}/${level}/${date}.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// --- Theme ---
const THEME_KEY = 'crosswords_theme';
const themeBtn = document.getElementById('theme-btn');

function getEffectiveTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.className = theme;
  themeBtn.innerHTML = theme === 'dark' ? '&#9788;' : '&#9790;';
  themeBtn.title = theme === 'dark' ? 'Tema claro' : 'Tema escuro';
}

function initTheme() {
  applyTheme(getEffectiveTheme());
  themeBtn.addEventListener('click', () => {
    const next = getEffectiveTheme() === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });
}

// --- Init puzzle ---
async function initPuzzle(level, date) {
  const puzzleData = await loadPuzzle(level, date);
  if (!puzzleData) {
    gridEl.innerHTML = '<p style="padding:20px;">Puzzle não disponível para esta data.</p>';
    return;
  }

  currentLevel = level;
  currentDate = date;

  // Update URL
  window.location.hash = date;
  datePicker.value = date;

  // Timer
  timer = createTimer(timerDisplay);

  // Grid
  grid = createGrid(gridEl, puzzleData, {
    onCellSelect(row, col, direction, word) {
      if (cluesPanel && word) {
        cluesPanel.highlightClue(word.id);
      }
    },
    onLetterInput(row, col, letter) {
      game.onLetterInput(row, col, letter);
    },
  });

  // Clues panel
  cluesPanel = setupCluesPanel(grid, { acrossEl, downEl, activeClueBar });

  // Game logic
  game = createGame(grid, puzzleData, {
    onTimerStart() {
      timer.start();
    },
    onTimerRestore(elapsed) {
      timer.restore(elapsed);
      if (elapsed > 0) timer.start();
    },
    onWordCorrect(wordIdx, word, animate) {
      cluesPanel.markWordSolved(wordIdx);
    },
    onComplete(state, stats) {
      timer.stop();
      showConfetti();
      setTimeout(() => {
        showCompletionModal(modalOverlay, modalContent, state, stats, timer.formatTime);
      }, 500);
    },
  });

  // Timer tick → game elapsed
  timer.onTick = (elapsed) => game.updateElapsed(elapsed);

  // Focus first cell
  grid.focusFirstCell();
}

// --- Event listeners ---
function setupEventListeners() {
  // Date picker
  datePicker.addEventListener('change', () => {
    const date = datePicker.value;
    if (date) initPuzzle(currentLevel, date);
  });

  // Reveal buttons
  btnRevealLetter.addEventListener('click', () => game?.revealLetter());
  btnRevealWord.addEventListener('click', () => game?.revealWord());
  btnRevealAll.addEventListener('click', () => {
    if (confirm('Revelar todas as letras? Isso marcará todas como dica.')) {
      game?.revealAll();
    }
  });

  // Stats button
  statsBtn.addEventListener('click', () => {
    const stats = loadStats();
    showStatsModal(modalOverlay, modalContent, stats, timer?.formatTime || formatTimeFallback);
  });

  // Modal close
  modalClose.addEventListener('click', () => hideModal(modalOverlay));
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) hideModal(modalOverlay);
  });

  // Mobile clue toggle
  setupMobileClueToggle();

  // Hash routing
  window.addEventListener('hashchange', () => {
    const date = parseHash();
    if (date && date !== currentDate) {
      initPuzzle('daily', date);
    }
  });
}

function formatTimeFallback(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function parseHash() {
  const hash = window.location.hash.replace('#', '');
  // Hash is just the date: #2026-02-15
  return /^\d{4}-\d{2}-\d{2}$/.test(hash) ? hash : null;
}

// --- Setup date picker limits ---
async function setupDatePicker(level) {
  const index = await loadIndex(level);
  if (index?.dates?.length) {
    const sorted = [...index.dates].sort();
    datePicker.min = sorted[0];
    datePicker.max = sorted[sorted.length - 1];
  }
}

// --- Boot ---
async function boot() {
  initTheme();
  setupEventListeners();

  // Check hash for initial state
  let date = parseHash();

  const index = await loadIndex('daily');
  if (!date && index?.dates?.length) {
    date = index.dates[0]; // Most recent
  }

  await setupDatePicker('daily');

  if (date) {
    initPuzzle('daily', date);
  }
}

boot();
