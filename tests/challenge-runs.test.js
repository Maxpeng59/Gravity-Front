import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHALLENGE_RUNS, PVP_PROGRESS_KEY, buildChallengeEnemies, completeChallenge,
  normalizePvpProgress, readPvpProgress,
} from '../js/challenge-runs.js';

function memoryStorage(){
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('challenge ladder is sequential, surface-only, solo, and scales from one to fifty hostiles', () => {
  assert.deepEqual(CHALLENGE_RUNS.map(run => run.enemyCount), [1, 5, 10, 20, 35, 50]);
  for (const run of CHALLENGE_RUNS){
    assert.equal(run.env, 'ground');
    assert.equal(run.mapId, 'clearcity');
    assert.equal(run.solo, true);
    assert.equal(buildChallengeEnemies(run).length, run.enemyCount);
  }
});

test('clearing a challenge persists its PvP equipment and reconstructs rewards from clear history', () => {
  const storage = memoryStorage();
  const first = completeChallenge('trial_01', storage);
  assert.deepEqual(first.newUnlocks, ['fed_beam_spray', 'zeon_120mm']);
  const saved = readPvpProgress(storage);
  assert.ok(saved.cleared.includes('trial_01'));
  assert.ok(saved.unlocked.includes('fed_beam_spray'));
  storage.setItem(PVP_PROGRESS_KEY, JSON.stringify({ cleared: ['trial_01'], unlocked: [] }));
  assert.ok(normalizePvpProgress(JSON.parse(storage.getItem(PVP_PROGRESS_KEY))).unlocked.includes('zeon_120mm'));
});
