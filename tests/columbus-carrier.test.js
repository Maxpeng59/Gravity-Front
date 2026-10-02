import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COLUMBUS_LAUNCH_CHANCES,
  COLUMBUS_LAUNCH_INTERVAL,
  rollColumbusLaunches,
} from '../js/columbus-carrier.js';

function sequence(values){
  let index = 0;
  return () => values[index++];
}

test('Columbus rolls the requested independent events every ten seconds', () => {
  assert.equal(COLUMBUS_LAUNCH_INTERVAL, 10);
  assert.deepEqual(COLUMBUS_LAUNCH_CHANCES, {
    gm: 0.10,
    saberfish: 0.30,
    saberfish5000: 0.25,
    gmii: 0.05,
  });
});

test('all four Columbus launch events can succeed in the same cycle', () => {
  const launches = rollColumbusLaunches(sequence([0.09, 0.29, 0.24, 0.04, 0.75]));
  assert.deepEqual(launches, ['gmbazooka', 'saberfish', 'saberfish5000', 'gmii']);
});

test('the GM event independently chooses standard or bazooka equipment', () => {
  assert.deepEqual(
    rollColumbusLaunches(sequence([0.09, 0.99, 0.99, 0.99, 0.49])),
    ['gm'],
  );
  assert.deepEqual(
    rollColumbusLaunches(sequence([0.09, 0.99, 0.99, 0.99, 0.50])),
    ['gmbazooka'],
  );
});

test('chance boundaries are exclusive and each event may miss', () => {
  assert.deepEqual(rollColumbusLaunches(sequence([0.10, 0.30, 0.25, 0.05])), []);
});

test('battle runtime advances living Columbus carriers and spawns their team units', () => {
  const battle = readFileSync(new URL('../js/battle.js', import.meta.url), 'utf8');
  const data = readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
  assert.match(battle, /carrierLaunchT: kind === 'columbus' \? COLUMBUS_LAUNCH_INTERVAL/);
  assert.match(battle, /runColumbusLaunchCycle\(carrier\)/);
  assert.match(battle, /spawnMech\(\{ suitId \}, carrier\.team, exit, \{ core: false \}\)/);
  for (const id of ['gm', 'gmbazooka', 'gmii', 'saberfish', 'saberfish5000'])
    assert.match(data, new RegExp(`id: '${id}'`));
});
