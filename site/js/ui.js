/**
 * UI controls: clues panel, modals, confetti.
 */

export function setupCluesPanel(grid, containers) {
  const { acrossEl, downEl, activeClueBar } = containers;

  function renderClues() {
    acrossEl.innerHTML = '';
    downEl.innerHTML = '';

    for (const word of grid.words) {
      const li = document.createElement('li');
      li.dataset.wordId = word.id;
      li.innerHTML = `<span class="clue-number">${word.number}.</span>${word.clue}`;
      li.addEventListener('click', () => {
        grid.selectWord(word.id);
      });

      if (word.direction === 'across') {
        acrossEl.appendChild(li);
      } else {
        downEl.appendChild(li);
      }
    }
  }

  function highlightClue(wordIdx) {
    // Remove all active
    acrossEl.querySelectorAll('li.active').forEach((el) => el.classList.remove('active'));
    downEl.querySelectorAll('li.active').forEach((el) => el.classList.remove('active'));

    if (wordIdx == null) return;

    const word = grid.words[wordIdx];
    const container = word.direction === 'across' ? acrossEl : downEl;
    const li = container.querySelector(`li[data-word-id="${wordIdx}"]`);
    if (li) {
      li.classList.add('active');
      li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    // Update active clue bar (mobile)
    if (activeClueBar) {
      activeClueBar.textContent = word ? `${word.number} ${word.direction === 'across' ? 'H' : 'V'}. ${word.clue}` : '';
    }
  }

  function markWordSolved(wordIdx) {
    const word = grid.words[wordIdx];
    const container = word.direction === 'across' ? acrossEl : downEl;
    const li = container.querySelector(`li[data-word-id="${wordIdx}"]`);
    if (li) li.classList.add('solved');
  }

  renderClues();

  return { highlightClue, markWordSolved, renderClues };
}

export function setupMobileClueToggle() {
  document.querySelectorAll('.clues-header').forEach((header) => {
    header.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        header.closest('.clues-section').classList.toggle('collapsed');
      }
    });
  });
}

export function showModal(overlayEl, contentEl, html) {
  contentEl.innerHTML = html;
  overlayEl.classList.remove('hidden');
}

export function hideModal(overlayEl) {
  overlayEl.classList.add('hidden');
}

export function showCompletionModal(overlayEl, contentEl, state, stats, formatTime) {
  const noHints = state.hintsUsed === 0;
  const html = `
    <h2>Parabéns!</h2>
    <div class="stat-row">
      <span class="stat-label">Tempo</span>
      <span class="stat-value">${formatTime(state.elapsed)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Dicas usadas</span>
      <span class="stat-value">${state.hintsUsed}</span>
    </div>
    ${noHints ? '<div class="stat-row"><span class="stat-label">Sem dicas!</span><span class="stat-value">&#11088;</span></div>' : ''}
    <div class="stat-row">
      <span class="stat-label">Total completados</span>
      <span class="stat-value">${stats.totalCompleted}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Streak</span>
      <span class="stat-value">${stats.streak.current} dias</span>
    </div>
  `;
  showModal(overlayEl, contentEl, html);
}

export function showStatsModal(overlayEl, contentEl, stats, formatTime) {
  const historyHtml = stats.history.slice(0, 10).map((h) => `
    <div class="stat-row">
      <span class="stat-label">${h.date} (${h.level})</span>
      <span class="stat-value">${formatTime(h.time)}${h.noHints ? ' &#11088;' : ''}</span>
    </div>
  `).join('');

  const bestTimesHtml = Object.entries(stats.bestTime).map(([lvl, time]) => `
    <div class="stat-row">
      <span class="stat-label">Melhor ${lvl}</span>
      <span class="stat-value">${formatTime(time)}</span>
    </div>
  `).join('');

  const html = `
    <h2>Estatísticas</h2>
    <div class="stat-row">
      <span class="stat-label">Completados</span>
      <span class="stat-value">${stats.totalCompleted}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Streak atual</span>
      <span class="stat-value">${stats.streak.current} dias</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Melhor streak</span>
      <span class="stat-value">${stats.streak.best} dias</span>
    </div>
    ${bestTimesHtml}
    ${historyHtml ? '<h3 style="margin-top:16px;margin-bottom:8px;">Histórico</h3>' + historyHtml : ''}
  `;
  showModal(overlayEl, contentEl, html);
}

export function showConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);

  const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6eb4'];
  for (let i = 0; i < 50; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.left = Math.random() * 100 + '%';
    el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDelay = Math.random() * 2 + 's';
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    el.style.transform = `rotate(${Math.random() * 360}deg)`;
    container.appendChild(el);
  }

  setTimeout(() => container.remove(), 5000);
}
