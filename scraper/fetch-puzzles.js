#!/usr/bin/env node

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const API_BASE = 'https://oglobo-api.agilmenteapp.com/api/games/crossword';
const API_KEY = process.env.AGILMENTE_API_KEY;
const LEVELS = ['daily'];

if (!API_KEY) {
  console.error('Missing AGILMENTE_API_KEY environment variable.');
  console.error('Find it in the page source of https://oglobo.globo.com/jogos/palavras-cruzadas/ (data-key attribute).');
  process.exit(1);
}
const DELAY_MS = 500;

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      level: { type: 'string', default: 'all' },
      from: { type: 'string' },
      to: { type: 'string' },
    },
  });

  const levels = values.level === 'all' ? LEVELS : [values.level];
  for (const l of levels) {
    if (!LEVELS.includes(l)) {
      console.error(`Invalid level: ${l}. Must be one of: ${LEVELS.join(', ')}`);
      process.exit(1);
    }
  }

  const to = values.to ? new Date(values.to + 'T00:00:00') : new Date();
  const from = values.from
    ? new Date(values.from + 'T00:00:00')
    : new Date(to.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days back

  return { levels, from, to };
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function generateDates(from, to) {
  const dates = [];
  const current = new Date(from);
  while (current <= to) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPuzzle(level, date) {
  const token = `ANONYMOUS-${randomUUID()}-ANONYMOUS`;
  const url = `${API_BASE}/${level}/${date}`;

  const res = await fetch(url, {
    headers: {
      'x-key': API_KEY,
      'x-access-token': token,
      accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${level}/${date}`);
  }

  const data = await res.json();

  if (!data.ipuzData) {
    return null;
  }

  const ipuz = data.ipuzData;
  return {
    date,
    level,
    dimensions: ipuz.dimensions,
    puzzle: ipuz.puzzle,
    solution: ipuz.solution,
    clues: ipuz.clues,
    empty: ipuz.empty || ':',
  };
}

function savePuzzle(level, date, puzzleData) {
  const dir = join(DATA_DIR, level);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${date}.json`);
  writeFileSync(filePath, JSON.stringify(puzzleData, null, 2));
  return filePath;
}

function saveIndex(level, dates) {
  const dir = join(DATA_DIR, level);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, 'index.json');
  const index = {
    level,
    dates: dates.sort().reverse(),
    lastUpdated: new Date().toISOString(),
  };
  writeFileSync(filePath, JSON.stringify(index, null, 2));
}

async function main() {
  const { levels, from, to } = parseCliArgs();
  const allDates = generateDates(from, to);

  console.log(`Fetching puzzles: levels=[${levels}], from=${formatDate(from)}, to=${formatDate(to)}`);
  console.log(`Total dates: ${allDates.length}\n`);

  for (const level of levels) {
    const successDates = [];
    let skipped = 0;
    let failed = 0;

    // Load existing index dates
    const indexPath = join(DATA_DIR, level, 'index.json');
    if (existsSync(indexPath)) {
      try {
        const existing = JSON.parse(readFileSync(indexPath, 'utf-8'));
        for (const d of existing.dates) {
          if (!allDates.includes(d)) {
            successDates.push(d);
          }
        }
      } catch {}
    }

    for (const date of allDates) {
      const filePath = join(DATA_DIR, level, `${date}.json`);

      if (existsSync(filePath)) {
        successDates.push(date);
        skipped++;
        continue;
      }

      try {
        const puzzle = await fetchPuzzle(level, date);
        if (puzzle) {
          savePuzzle(level, date, puzzle);
          const clueCount =
            (puzzle.clues.Across?.length || 0) + (puzzle.clues.Down?.length || 0);
          console.log(
            `[${level}] ${date} OK (${puzzle.dimensions.width}x${puzzle.dimensions.height}, ${clueCount} clues)`
          );
          successDates.push(date);
        } else {
          console.log(`[${level}] ${date} NOT-AVAILABLE`);
          failed++;
        }
      } catch (err) {
        console.error(`[${level}] ${date} ERROR: ${err.message}`);
        failed++;
      }

      await sleep(DELAY_MS);
    }

    saveIndex(level, successDates);

    console.log(
      `\n[${level}] Done: ${successDates.length} available, ${skipped} skipped, ${failed} failed\n`
    );
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
