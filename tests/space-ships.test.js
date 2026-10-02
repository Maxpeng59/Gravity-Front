import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SPACE_SHIP_PROFILES, spaceShipProfile } from '../js/space-ship-balance.js';

const FED = ['salamis', 'magellan', 'columbus'];
const ZEON = ['musai', 'chivvay'];

test('custom space battle exposes the five faction-correct fleet hulls', () => {
  assert.deepEqual(Object.keys(SPACE_SHIP_PROFILES).sort(), [...FED, ...ZEON].sort());
  assert.ok(FED.every(id => spaceShipProfile(id).faction === 'FED'));
  assert.ok(ZEON.every(id => spaceShipProfile(id).faction === 'ZEON'));
  assert.ok(Object.values(SPACE_SHIP_PROFILES).every(profile =>
    profile.hp >= 30000 && profile.speed > 0 && profile.mainRange >= 1000));
  assert.ok(spaceShipProfile('magellan').hp > spaceShipProfile('salamis').hp);
  assert.ok(spaceShipProfile('musai').speed > spaceShipProfile('chivvay').speed);
  assert.ok(spaceShipProfile('columbus').standoff > spaceShipProfile('salamis').standoff);
});

test('every fleet hull is routed through a dedicated complex silhouette builder', () => {
  const source = readFileSync(new URL('../js/canonical-space-ships.js', import.meta.url), 'utf8');
  assert.match(source, /function longitudinalHull/);
  assert.ok((source.match(/longitudinalHull\(/g) || []).length >= 12);
  assert.match(source, /kind === 'musai'.*buildMusai/);
  assert.match(source, /kind === 'chivvay'.*buildChivvay/);
  assert.match(source, /kind === 'salamis'.*buildSalamis/);
  assert.match(source, /kind === 'magellan'.*buildMagellan/);
  assert.match(source, /kind === 'columbus'.*buildColumbus/);
  assert.match(source, /separated twin engine nacelles/);
  assert.match(source, /Broad twin cargo bodies/);
});

test('space hulls appear only in space rosters and actively maneuver and fire', () => {
  const menu = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const battle = readFileSync(new URL('../js/battle.js', import.meta.url), 'utf8');
  for (const id of [...FED, ...ZEON]) assert.match(menu, new RegExp(`id: '${id}'.*env: 'space'`));
  assert.match(menu, /ship\.faction === canonicalShipFaction && ship\.env === custom\.env/);
  assert.match(menu, /custom\.env === 'space' \? 'musai'/);
  assert.match(menu, /custom\.env === 'space' \? 'salamis'/);
  assert.match(battle, /buildCanonicalSpaceShip\(kind, glow, thrust/);
  assert.match(battle, /function updateSpaceShipMovement/);
  assert.match(battle, /if \(p\.alive && p\.spaceProfile\)\{[\s\S]*?updateSpaceShipMovement\(p, dt\)/);
  assert.match(battle, /p\.spaceProfile \? 'SHIP MAIN BATTERY'/);
});
