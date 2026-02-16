/**
 * LocalStorage persistence for game progress and statistics.
 */

const PREFIX = 'crosswords_';

export function saveProgress(level, date, gameState) {
  const key = `${PREFIX}progress_${level}_${date}`;
  localStorage.setItem(key, JSON.stringify(gameState));
}

export function loadProgress(level, date) {
  const key = `${PREFIX}progress_${level}_${date}`;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

export function saveStats(stats) {
  localStorage.setItem(`${PREFIX}stats`, JSON.stringify(stats));
}

export function loadStats() {
  const data = localStorage.getItem(`${PREFIX}stats`);
  if (data) return JSON.parse(data);
  return {
    totalCompleted: 0,
    totalTime: 0,
    bestTime: {},
    streak: { current: 0, best: 0 },
    history: [],
    lastPlayed: null,
  };
}

export function updateStatsOnComplete(level, date, elapsed, hintsUsed) {
  const stats = loadStats();

  stats.totalCompleted++;
  stats.totalTime += elapsed;

  if (!stats.bestTime[level] || elapsed < stats.bestTime[level]) {
    stats.bestTime[level] = elapsed;
  }

  // Streak calculation
  const today = new Date().toISOString().split('T')[0];
  if (stats.lastPlayed) {
    const lastDate = new Date(stats.lastPlayed);
    const todayDate = new Date(today);
    const diffDays = Math.round((todayDate - lastDate) / (86400000));
    if (diffDays === 1) {
      stats.streak.current++;
    } else if (diffDays > 1) {
      stats.streak.current = 1;
    }
    // diffDays === 0: same day, keep streak
  } else {
    stats.streak.current = 1;
  }

  if (stats.streak.current > stats.streak.best) {
    stats.streak.best = stats.streak.current;
  }

  stats.lastPlayed = today;

  stats.history.unshift({
    date,
    level,
    time: elapsed,
    hints: hintsUsed,
    noHints: hintsUsed === 0,
  });

  // Keep last 50
  if (stats.history.length > 50) {
    stats.history = stats.history.slice(0, 50);
  }

  saveStats(stats);
  return stats;
}
