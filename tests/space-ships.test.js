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

test('capital ships cross space at the accelerated travel speeds', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(SPACE_SHIP_PROFILES)
    .map(([id, profile]) => [id, profile.speed])), {
    salamis: 56,
    magellan: 42,
    columbus: 32,
    musai: 60,
    chivvay: 44,
  });
  assert.ok(Object.values(SPACE_SHIP_PROFILES).every(profile => profile.speed >= 32));
});

test('every ship carries paired three-round missile racks and only Federation hulls carry torpedoes', () => {
  assert.ok(Object.values(SPACE_SHIP_PROFILES).every(profile =>
    profile.missileCount === 6 && profile.missileDamage > 0 && profile.missileCooldown > 0));
  assert.ok(FED.every(id => spaceShipProfile(id).torpedo === true));
  assert.ok(ZEON.every(id => !spaceShipProfile(id).torpedo));
  assert.ok(FED.every(id => spaceShipProfile(id).torpedoDamage > 0 && spaceShipProfile(id).torpedoCooldown > 0));

  const models = readFileSync(new URL('../js/canonical-space-ships.js', import.meta.url), 'utf8');
  assert.equal((models.match(/addMissileRacks\(staticHull/g) || []).length, 5);
  assert.equal((models.match(/addFederationTorpedoTube\(staticHull/g) || []).length, 3);
});

test('ship weapons use an MS-style centred N hull view with optional U missile auto-lock', () => {
  const battle = readFileSync(new URL('../js/battle.js', import.meta.url), 'utf8');
  assert.match(battle, /ARROWS CAMERA · N AIM FROM HULL VIEW · U MISSILE AUTO-LOCK · 1\/2 SELECT WEAPON · LMB FIRE/);
  assert.match(battle, /keys\.has\('arrowright'\)/);
  assert.match(battle, /shipCameraYaw = wrapAngle/);
  assert.match(battle, /if \(\(k === '1' \|\| k === '2'\) && !e\.repeat\) switchShipWeapon/);
  assert.match(battle, /if \(k === 'n' && !e\.repeat\) toggleShipAimMode\(\)/);
  assert.match(battle, /if \(k === 'u' && !e\.repeat && commandedShip\.spaceProfile\) toggleShipMissileAutoLock\(\)/);
  assert.match(battle, /if \(mouseDown\) fireSelectedShipWeapon\(p\)/);
  assert.match(battle, /function shipHullAimPoint/);
  assert.match(battle, /function shipHullAimOrigin/);
  assert.match(battle, /function drawShipHullReticle/);
  assert.match(battle, /function acquireShipMissileLock/);
  assert.match(battle, /shipAimMode \? 46 : 58/);
  assert.match(battle, /const x = innerWidth \* 0\.5/);
  assert.match(battle, /const y = innerHeight \* 0\.5/);
  assert.match(battle, /desired = cameraAimFlat\.copy\(shipHullAimOrigin\(ship\)\)/);
  assert.match(battle, /const sightDirection = landship \? commandedShipAimDirection\(ship\) : forward/);
  assert.match(battle, /camera\.lookAt\(cameraChaseDirection\.copy\(camera\.position\)\.addScaledVector\(sightDirection, 2000\)\)/);
  assert.match(battle, /sightPoint\.sub\(muzzle\)\.normalize\(\)/);
  assert.match(battle, /const spreadScale = p === commandedShip && shipAimMode \? 0 : 1/);
  assert.match(battle, /U AUTO-LOCK OFF · HULL-FORWARD SHOT/);
  assert.match(battle, /weaponName: 'SHIP MISSILE'/);
  assert.match(battle, /weaponName: 'FEDERATION SHIP TORPEDO'/);
  assert.match(battle, /mesh, homing: homingTarget, turn: 1\.35,[\s\S]*?collisionRadius: 1\.9/);
  assert.match(battle, /p === commandedShip && shipMissileAutoLock && target\?\.alive \? target : null/);
  assert.match(battle, /homing: null, heavy: true, collisionRadius: 4\.2/);
  assert.match(battle, /if \(p === commandedShip\) return/);
  assert.match(battle, /updateShipOrdnance\(p, dt\)/);
});

test('every fleet hull is routed through a dedicated canonical silhouette builder', () => {
  const source = readFileSync(new URL('../js/canonical-space-ships.js', import.meta.url), 'utf8');
  assert.match(source, /function longitudinalHull/);
  assert.ok((source.match(/longitudinalHull\(/g) || []).length >= 12);
  assert.match(source, /kind === 'musai'.*buildMusai/);
  assert.match(source, /kind === 'chivvay'.*buildChivvay/);
  assert.match(source, /kind === 'salamis'.*buildSalamis/);
  assert.match(source, /kind === 'magellan'.*buildMagellan/);
  assert.match(source, /kind === 'columbus'.*buildColumbus/);
  assert.match(source, /separated .*nacelles/);
  assert.match(source, /two blunt rectangular cargo barges/);
  assert.match(source, /salamis-simple-triangle-waist-box-drive/);
  assert.match(source, /magellan-simple-stepped-wedge-box-drive/);
  assert.match(source, /columbus-simple-twin-box-carrier/);
  assert.match(source, /musai-swan-neck-twin-nacelle/);
  assert.match(source, /arrowhead prow, an unmistakable pinched waist/);
  assert.match(source, /Swan-neck command tower and hammerhead bridge/);
});

test('Federation hulls use simple flat boxes and angular wedges instead of curved bodywork', () => {
  const source = readFileSync(new URL('../js/canonical-space-ships.js', import.meta.url), 'utf8');
  const federationBuilders = source.slice(
    source.indexOf('function buildSalamis'),
    source.indexOf('export function buildCanonicalSpaceShip'),
  );
  assert.doesNotMatch(federationBuilders, /chamferBox\(/);
  assert.doesNotMatch(federationBuilders, /\baddEngine\(/);
  assert.doesNotMatch(federationBuilders, /\bsph\(/);
  assert.ok((federationBuilders.match(/\bbox\(/g) || []).length >= 20);
  assert.ok((federationBuilders.match(/longitudinalHull\(/g) || []).length >= 5);
  assert.equal((federationBuilders.match(/addBlockEngine\(/g) || []).length, 3);
  assert.equal((federationBuilders.match(/addMissileRacks\(staticHull[^\n]*true\)/g) || []).length, 3);
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
  assert.match(menu, /SHIPS\.filter\(unit => unit\.env === custom\.env\)/);
  assert.match(menu, /custom\.playerShip = ship\.id/);
  assert.match(menu, /playerControlled: true/);
  assert.match(menu, /playerTeam: playerFaction, playerShipKind: custom\.playerShip/);
  assert.match(battle, /const playerShipLocked = !!opts\.playerShipKind/);
  assert.match(battle, /if \(cs\.playerControlled\)[\s\S]*?commandedShip = spawned/);
  assert.match(battle, /if \(p === commandedShip\) updateCommandedShip\(p, dt\)/);
  assert.match(battle, /playerShipLocked && !playerShipProp\?\.alive/);
  assert.match(battle, /playerShipLocked && playerShipProp[\s\S]*?playerShipProp\.hp \/ playerShipProp\.maxHp/);
});
