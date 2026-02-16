/**
 * Grid renderer and keyboard navigation for the crossword puzzle.
 *
 * Exports:
 *  - createGrid(puzzleData, callbacks) → { cells, words, cellToWords, getActiveWord, setActiveCell, getCell }
 */

export function createGrid(container, puzzleData, callbacks = {}) {
  const { puzzle, solution, clues, dimensions, empty } = puzzleData;
  const rows = dimensions.height;
  const cols = dimensions.width;

  // State
  let activeRow = -1;
  let activeCol = -1;
  let activeDirection = 'across';

  // --- Data structures ---
  const cells = [];         // cells[row][col] = { element, input, row, col, isBlack, number }
  const words = [];         // { id, number, direction, cells: [{row,col}], clue }
  const cellToWords = [];   // cellToWords[row][col] = { across: wordIndex|null, down: wordIndex|null }
  const wordMap = {};       // `${number}_${direction}` → word index

  // Init 2D arrays
  for (let r = 0; r < rows; r++) {
    cells[r] = [];
    cellToWords[r] = [];
    for (let c = 0; c < cols; c++) {
      cellToWords[r][c] = { across: null, down: null };
    }
  }

  // --- Build word map from clues ---
  function buildWords() {
    const numberToPos = {};
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = puzzle[r][c];
        if (typeof val === 'number') {
          numberToPos[val] = { row: r, col: c };
        }
      }
    }

    function isPlayable(r, c) {
      if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
      return puzzle[r][c] !== '#';
    }

    for (const [num, clue] of clues.Across || []) {
      const pos = numberToPos[num];
      if (!pos) continue;
      const wordCells = [];
      let c = pos.col;
      while (isPlayable(pos.row, c)) {
        wordCells.push({ row: pos.row, col: c });
        c++;
      }
      const idx = words.length;
      words.push({ id: idx, number: num, direction: 'across', cells: wordCells, clue });
      wordMap[`${num}_across`] = idx;
      for (const cell of wordCells) {
        cellToWords[cell.row][cell.col].across = idx;
      }
    }

    for (const [num, clue] of clues.Down || []) {
      const pos = numberToPos[num];
      if (!pos) continue;
      const wordCells = [];
      let r = pos.row;
      while (isPlayable(r, pos.col)) {
        wordCells.push({ row: r, col: pos.col });
        r++;
      }
      const idx = words.length;
      words.push({ id: idx, number: num, direction: 'down', cells: wordCells, clue });
      wordMap[`${num}_down`] = idx;
      for (const cell of wordCells) {
        cellToWords[cell.row][cell.col].down = idx;
      }
    }
  }

  // --- Render grid ---
  function render() {
    container.innerHTML = '';
    container.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
    container.style.gridTemplateRows = `repeat(${rows}, var(--cell-size))`;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = puzzle[r][c];
        const isBlack = val === '#';
        const cellEl = document.createElement('div');
        cellEl.className = 'cell' + (isBlack ? ' black' : '');
        cellEl.dataset.row = r;
        cellEl.dataset.col = c;

        let input = null;
        let numberSpan = null;

        if (!isBlack) {
          if (typeof val === 'number') {
            numberSpan = document.createElement('span');
            numberSpan.className = 'number';
            numberSpan.textContent = val;
            cellEl.appendChild(numberSpan);
          }

          input = document.createElement('input');
          input.type = 'text';
          input.maxLength = 1;
          input.autocomplete = 'off';
          input.autocorrect = 'off';
          input.autocapitalize = 'characters';
          input.inputMode = 'text';
          input.setAttribute('aria-label', `Row ${r + 1}, Column ${c + 1}`);
          cellEl.appendChild(input);

          input.addEventListener('focus', () => handleCellFocus(r, c));
          input.addEventListener('keydown', (e) => handleKeyDown(e, r, c));
          input.addEventListener('input', (e) => handleInput(e, r, c));
          input.addEventListener('click', (e) => {
            // If already focused on this cell, toggle direction
            if (activeRow === r && activeCol === c) {
              toggleDirection();
              e.preventDefault();
            }
          });
        }

        cells[r][c] = { element: cellEl, input, row: r, col: c, isBlack, number: typeof val === 'number' ? val : null };
        container.appendChild(cellEl);
      }
    }
  }

  // --- Highlighting ---
  function clearHighlights() {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!cells[r][c].isBlack) {
          cells[r][c].element.classList.remove('active', 'highlighted');
        }
      }
    }
  }

  function highlightWord(wordIdx) {
    if (wordIdx == null) return;
    const word = words[wordIdx];
    for (const { row, col } of word.cells) {
      cells[row][col].element.classList.add('highlighted');
    }
  }

  function setActiveCell(row, col, dir) {
    if (dir) activeDirection = dir;

    // If the cell only has one direction, use that
    const cw = cellToWords[row]?.[col];
    if (cw) {
      if (cw[activeDirection] == null) {
        activeDirection = activeDirection === 'across' ? 'down' : 'across';
      }
    }

    activeRow = row;
    activeCol = col;

    clearHighlights();
    cells[row][col].element.classList.add('active');

    const wordIdx = cw?.[activeDirection];
    highlightWord(wordIdx);

    cells[row][col].input?.focus();

    if (callbacks.onCellSelect) {
      callbacks.onCellSelect(row, col, activeDirection, wordIdx != null ? words[wordIdx] : null);
    }
  }

  // --- Navigation ---
  function getActiveWord() {
    if (activeRow < 0) return null;
    const idx = cellToWords[activeRow]?.[activeCol]?.[activeDirection];
    return idx != null ? words[idx] : null;
  }

  function toggleDirection() {
    const other = activeDirection === 'across' ? 'down' : 'across';
    const cw = cellToWords[activeRow]?.[activeCol];
    if (cw?.[other] != null) {
      activeDirection = other;
      setActiveCell(activeRow, activeCol);
    }
  }

  function moveToNextCell() {
    const word = getActiveWord();
    if (!word) return;
    const idx = word.cells.findIndex((c) => c.row === activeRow && c.col === activeCol);
    if (idx < word.cells.length - 1) {
      const next = word.cells[idx + 1];
      setActiveCell(next.row, next.col);
    }
  }

  function moveToPrevCell() {
    const word = getActiveWord();
    if (!word) return;
    const idx = word.cells.findIndex((c) => c.row === activeRow && c.col === activeCol);
    if (idx > 0) {
      const prev = word.cells[idx - 1];
      setActiveCell(prev.row, prev.col);
    }
  }

  function moveToNextWord(reverse = false) {
    const currentWordIdx = cellToWords[activeRow]?.[activeCol]?.[activeDirection];
    if (currentWordIdx == null) return;

    // Find next/prev word in same direction
    const sameDir = words.filter((w) => w.direction === activeDirection);
    const curPos = sameDir.findIndex((w) => w.id === currentWordIdx);
    let nextPos;
    if (reverse) {
      nextPos = curPos > 0 ? curPos - 1 : sameDir.length - 1;
    } else {
      nextPos = curPos < sameDir.length - 1 ? curPos + 1 : 0;
    }
    const nextWord = sameDir[nextPos];
    if (nextWord && nextWord.cells.length > 0) {
      // Find first empty cell in word, or first cell if all filled
      const firstEmpty = nextWord.cells.find(
        (c) => !cells[c.row][c.col].input?.value
      );
      const target = firstEmpty || nextWord.cells[0];
      setActiveCell(target.row, target.col, nextWord.direction);
    }
  }

  function moveArrow(dr, dc) {
    let r = activeRow + dr;
    let c = activeCol + dc;
    while (r >= 0 && r < rows && c >= 0 && c < cols) {
      if (!cells[r][c].isBlack) {
        setActiveCell(r, c);
        return;
      }
      r += dr;
      c += dc;
    }
  }

  // --- Input handling ---
  function handleCellFocus(row, col) {
    if (activeRow !== row || activeCol !== col) {
      setActiveCell(row, col);
    }
  }

  function handleKeyDown(e, row, col) {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        moveArrow(0, 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        moveArrow(0, -1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        moveArrow(1, 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveArrow(-1, 0);
        break;
      case 'Tab':
        e.preventDefault();
        moveToNextWord(e.shiftKey);
        break;
      case 'Enter':
        e.preventDefault();
        moveToNextWord();
        break;
      case ' ':
        e.preventDefault();
        toggleDirection();
        break;
      case 'Backspace':
        e.preventDefault();
        if (cells[row][col].input.value) {
          setLetter(row, col, '');
          if (callbacks.onLetterInput) callbacks.onLetterInput(row, col, '');
        } else {
          moveToPrevCell();
          if (activeRow >= 0 && activeCol >= 0) {
            setLetter(activeRow, activeCol, '');
            if (callbacks.onLetterInput) callbacks.onLetterInput(activeRow, activeCol, '');
          }
        }
        break;
      case 'Delete':
        e.preventDefault();
        setLetter(row, col, '');
        if (callbacks.onLetterInput) callbacks.onLetterInput(row, col, '');
        break;
      default:
        // Let input handler deal with letter keys
        if (e.key.length === 1 && /[a-zA-ZÀ-ÿ]/.test(e.key)) {
          e.preventDefault();
          const letter = e.key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
          setLetter(row, col, letter);
          if (callbacks.onLetterInput) callbacks.onLetterInput(row, col, letter);
          moveToNextCell();
        }
    }
  }

  function handleInput(e, row, col) {
    // Handle mobile virtual keyboard input
    const value = e.target.value;
    if (value) {
      const letter = value.slice(-1).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
      e.target.value = '';
      setLetter(row, col, letter);
      if (callbacks.onLetterInput) callbacks.onLetterInput(row, col, letter);
      moveToNextCell();
    }
  }

  // --- Public API ---
  function setLetter(row, col, letter) {
    const cell = cells[row]?.[col];
    if (!cell || cell.isBlack) return;
    cell.input.value = letter;
  }

  function getLetter(row, col) {
    return cells[row]?.[col]?.input?.value || '';
  }

  function getCell(row, col) {
    return cells[row]?.[col];
  }

  function setCellClass(row, col, className, add = true) {
    const cell = cells[row]?.[col];
    if (!cell) return;
    if (add) {
      cell.element.classList.add(className);
    } else {
      cell.element.classList.remove(className);
    }
  }

  function lockCell(row, col) {
    const cell = cells[row]?.[col];
    if (cell?.input) {
      cell.input.readOnly = true;
    }
  }

  function focusFirstCell() {
    // Find first playable cell
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!cells[r][c].isBlack) {
          setActiveCell(r, c, 'across');
          return;
        }
      }
    }
  }

  function selectWord(wordIdx) {
    const word = words[wordIdx];
    if (!word) return;
    const firstEmpty = word.cells.find(
      (c) => !cells[c.row][c.col].input?.value
    );
    const target = firstEmpty || word.cells[0];
    setActiveCell(target.row, target.col, word.direction);
  }

  // --- Init ---
  buildWords();
  render();

  return {
    cells,
    words,
    cellToWords,
    rows,
    cols,
    solution,
    getActiveWord,
    setActiveCell,
    getCell,
    getLetter,
    setLetter,
    setCellClass,
    lockCell,
    focusFirstCell,
    selectWord,
    get activeRow() { return activeRow; },
    get activeCol() { return activeCol; },
    get activeDirection() { return activeDirection; },
  };
}
