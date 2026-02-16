/**
 * Timer: starts on first input, pauses on visibility change, stops on completion.
 */

export function createTimer(displayEl) {
  let elapsed = 0;        // seconds
  let intervalId = null;
  let running = false;
  let started = false;
  let onTick = null;

  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function updateDisplay() {
    displayEl.textContent = formatTime(elapsed);
  }

  function tick() {
    elapsed++;
    updateDisplay();
    if (onTick) onTick(elapsed);
  }

  function start() {
    if (running) return;
    started = true;
    running = true;
    intervalId = setInterval(tick, 1000);
  }

  function pause() {
    if (!running) return;
    running = false;
    clearInterval(intervalId);
    intervalId = null;
  }

  function stop() {
    pause();
  }

  function restore(savedElapsed) {
    elapsed = savedElapsed || 0;
    started = elapsed > 0;
    updateDisplay();
  }

  function getElapsed() {
    return elapsed;
  }

  // Visibility change
  document.addEventListener('visibilitychange', () => {
    if (!started) return;
    if (document.hidden) {
      pause();
    } else {
      start();
    }
  });

  updateDisplay();

  return {
    start,
    pause,
    stop,
    restore,
    getElapsed,
    formatTime,
    set onTick(fn) { onTick = fn; },
  };
}
