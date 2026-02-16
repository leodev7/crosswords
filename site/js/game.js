/**
 * Game logic: auto-validation, hints, and state management.
 */

import { saveProgress, loadProgress, updateStatsOnComplete } from './storage.js';

export function createGame(grid, puzzleData, callbacks = {}) {
  const { level, date, solution } = puzzleData;

  // Game state
  let state = {
    level,
    date,
    grid: {},           // 'row_col' → letter
    revealed: {},       // 'row_col' → true
    correctWords: [],   // word indices that are validated correct
    startTime: null,
    elapsed: 0,
    completed: false,
    completedAt: null,
    hintsUsed: 0,
  };

  let saveTimer = null;

  // --- Load saved progress ---
  function loadSaved() {
    const saved = loadProgress(level, date);
    if (!saved) return;

    state = { ...state, ...saved };

    // Restore grid letters
    for (const [key, letter] of Object.entries(state.grid)) {
      const [r, c] = key.split('_').map(Number);
      grid.setLetter(r, c, letter);
    }

    // Restore revealed cells
    for (const key of Object.keys(state.revealed)) {
      const [r, c] = key.split('_').map(Number);
      grid.setCellClass(r, c, 'revealed');
    }

    // Restore correct words
    for (const wordIdx of state.correctWords) {
      markWordCorrect(wordIdx, false);
    }

    // Restore timer
    if (callbacks.onTimerRestore) {
      callbacks.onTimerRestore(state.elapsed, state.startTime);
    }
  }

  // --- Save progress (debounced) ---
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveProgress(level, date, state);
    }, 1000);
  }

  // --- Letter input handler ---
  function onLetterInput(row, col, letter) {
    const key = `${row}_${col}`;

    if (!state.startTime) {
      state.startTime = Date.now();
      if (callbacks.onTimerStart) callbacks.onTimerStart();
    }

    if (letter) {
      state.grid[key] = letter;
    } else {
      delete state.grid[key];
    }

    // Check all words this cell belongs to
    const cw = grid.cellToWords[row]?.[col];
    if (cw) {
      if (cw.across != null) checkWord(cw.across);
      if (cw.down != null) checkWord(cw.down);
    }

    scheduleSave();
  }

  // --- Word validation ---
  function checkWord(wordIdx) {
    if (state.correctWords.includes(wordIdx)) return;

    const word = grid.words[wordIdx];
    if (!word) return;

    // Check if all cells are filled
    const allFilled = word.cells.every(({ row, col }) => {
      return grid.getLetter(row, col) !== '';
    });

    if (!allFilled) return;

    // Check if all cells match solution
    const allCorrect = word.cells.every(({ row, col }) => {
      const playerLetter = grid.getLetter(row, col);
      const solutionLetter = solution[row][col];
      return playerLetter === solutionLetter;
    });

    if (allCorrect) {
      state.correctWords.push(wordIdx);
      markWordCorrect(wordIdx, true);
      checkCompletion();
    }
  }

  function markWordCorrect(wordIdx, animate) {
    const word = grid.words[wordIdx];
    for (const { row, col } of word.cells) {
      grid.setCellClass(row, col, 'correct');
      grid.lockCell(row, col);
    }
    if (callbacks.onWordCorrect) {
      callbacks.onWordCorrect(wordIdx, word, animate);
    }
  }

  // --- Completion ---
  function checkCompletion() {
    if (state.completed) return;

    // Check if all words are correct
    if (state.correctWords.length === grid.words.length) {
      state.completed = true;
      state.completedAt = Date.now();
      saveProgress(level, date, state);

      const stats = updateStatsOnComplete(level, date, state.elapsed, state.hintsUsed);

      if (callbacks.onComplete) {
        callbacks.onComplete(state, stats);
      }
    }
  }

  // --- Hints ---
  function revealLetter() {
    const row = grid.activeRow;
    const col = grid.activeCol;
    if (row < 0 || col < 0) return;

    const cell = grid.getCell(row, col);
    if (!cell || cell.isBlack) return;
    if (cell.input?.readOnly) return; // already correct/revealed

    const letter = solution[row][col];
    if (!letter || letter === '#') return;

    const key = `${row}_${col}`;
    grid.setLetter(row, col, letter);
    state.grid[key] = letter;
    state.revealed[key] = true;
    state.hintsUsed++;
    grid.setCellClass(row, col, 'revealed');

    // Check words
    const cw = grid.cellToWords[row]?.[col];
    if (cw) {
      if (cw.across != null) checkWord(cw.across);
      if (cw.down != null) checkWord(cw.down);
    }

    scheduleSave();
  }

  function revealWord() {
    const word = grid.getActiveWord();
    if (!word) return;
    if (state.correctWords.includes(word.id)) return;

    for (const { row, col } of word.cells) {
      const cell = grid.getCell(row, col);
      if (cell?.input?.readOnly) continue;

      const letter = solution[row][col];
      const key = `${row}_${col}`;
      grid.setLetter(row, col, letter);
      state.grid[key] = letter;
      if (!state.revealed[key]) {
        state.revealed[key] = true;
        state.hintsUsed++;
      }
      grid.setCellClass(row, col, 'revealed');
    }

    checkWord(word.id);
    scheduleSave();
  }

  function revealAll() {
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const cell = grid.getCell(r, c);
        if (cell.isBlack || cell.input?.readOnly) continue;

        const letter = solution[r][c];
        const key = `${r}_${c}`;
        grid.setLetter(r, c, letter);
        state.grid[key] = letter;
        if (!state.revealed[key]) {
          state.revealed[key] = true;
          state.hintsUsed++;
        }
        grid.setCellClass(r, c, 'revealed');
      }
    }

    // Check all words
    for (let i = 0; i < grid.words.length; i++) {
      if (!state.correctWords.includes(i)) {
        checkWord(i);
      }
    }

    scheduleSave();
  }

  // --- Timer integration ---
  function updateElapsed(seconds) {
    state.elapsed = seconds;
  }

  function getState() {
    return state;
  }

  // --- Init ---
  loadSaved();

  return {
    onLetterInput,
    revealLetter,
    revealWord,
    revealAll,
    updateElapsed,
    getState,
  };
}
