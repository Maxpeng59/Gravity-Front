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
  assert.match(source, /separated .*nacelles/);
  assert.match(source, /Broad twin cargo bodies/);
  assert.match(source, /salamis-triangle-waist-box-drive/);
  assert.match(source, /magellan-long-wedge-heavy-drive/);
  assert.match(source, /musai-swan-neck-twin-nacelle/);
  assert.match(source, /triangular prow, a visible inward waist/);
  assert.match(source, /Swan-neck command tower and hammerhead bridge/);
});

test('each Federation hull mounts five light batteries on both sides', () => {
  const source = readFileSync(new URL('../js/canonical-space-ships.js', import.meta.url), 'utf8');
  assert.match(source, /FEDERATION_SIDE_BATTERY_Z = Object\.freeze\(\[-14, -7, 0, 7, 14\]\)/);
  assert.match(source, /zStations: \[-16, -8, 0, 8, 16\]/);
  assert.match(source, /zStations: \[-12, -6, 0, 6, 12\]/);
  assert.equal((source.match(/addFederationSideBatteries\(root, turrets/g) || []).length, 4);
  assert.match(source, /for \(const side of \[-1, 1\]\) for \(const z of zStations\)/);
  assert.match(source, /secondary: true/);
  assert.match(source, /weaponName: 'SHIP SIDE BATTERY'/);
});

test('space hulls appear only in space rosters and actively maneuver and fire', () => {
  const menu = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const battle = readFileSync(new URL('../js/battle.js', import.meta.url), 'utf8');
  for (const id of [...FED, ...ZEON]) assert.match(menu, new RegExp(`id: '${id}'.*env: 'space'`));
  assert.match(menu, /ship\.faction === canonicalShipFaction && ship\.env === custom\.env/);
  assert.match(menu, /faction === 'FED' \? 'salamis' : 'musai'/);
  assert.match(battle, /buildCanonicalSpaceShip\(kind, glow, thrust/);
  assert.match(battle, /function updateSpaceShipMovement/);
  assert.match(battle, /_debugViewShip\(kind = 'salamis'/);
  assert.match(battle, /\[\.\.\.props, \.\.\.missionProps\]\.find/);
  assert.match(battle, /if \(p\.alive && p\.spaceProfile\)\{[\s\S]*?updateSpaceShipMovement\(p, dt\)/);
  assert.match(battle, /t\.weaponName \|\| 'SHIP MAIN BATTERY'/);
  assert.match(battle, /sideTurrets: p\.turrets\?\.filter\(t => t\.secondary\)\.length/);
});

test('all five space hulls can launch as the player-controlled unit', () => {
  const menu = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const battle = readFileSync(new URL('../js/battle.js', import.meta.url), 'utf8');
  assert.match(menu, /SHIPS\.filter\(unit => unit\.env === 'space'\)/);
  assert.match(menu, /custom\.playerShip = ship\.id/);
  assert.match(menu, /playerControlled: true/);
  assert.match(menu, /playerTeam: playerFaction, playerShipKind: custom\.playerShip/);
  assert.match(battle, /const playerShipLocked = !!opts\.playerShipKind/);
  assert.match(battle, /if \(cs\.playerControlled\)[\s\S]*?commandedShip = spawned/);
  assert.match(battle, /if \(p === commandedShip\) updateCommandedShip\(p, dt\)/);
  assert.match(battle, /playerShipLocked && !playerShipProp\?\.alive/);
  assert.match(battle, /playerShipLocked && playerShipProp[\s\S]*?playerShipProp\.hp \/ playerShipProp\.maxHp/);
});
