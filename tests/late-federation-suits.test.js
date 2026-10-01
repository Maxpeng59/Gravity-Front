import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { suitById } from '../js/data.js';
import { weaponLoadoutOptions } from '../js/loadouts.js';

const IDS = ['gmii', 'gmiii', 'jegan'];

test('GM II, GM III and Jegan are distinct playable Federation mobile suits', () => {
  const units = IDS.map(suitById);
  assert.deepEqual(units.map(unit => unit.code), ['RMS-179', 'RGM-86R', 'RGM-89']);
  assert.ok(units.every(unit => unit.faction === 'FED' && unit.style === 'gm'));
  assert.ok(units.every(unit => unit.hp > 0 && unit.weapons.length > 0));
  assert.ok(units[0].boost < units[2].boost && units[2].boost < units[1].boost);
  assert.ok(units[2].walk > units[1].walk && units[2].boostFuel > units[1].boostFuel);
  assert.ok(units[1].armor > units[0].armor && units[1].armor > units[2].armor);
});

test('late Federation suits retain their intended stock combat roles', () => {
  const gmii = suitById('gmii');
  const gmiii = suitById('gmiii');
  const jegan = suitById('jegan');
  assert.equal(gmii.weapons[0].clip, 24);
  assert.equal(gmii.weapons[0].dmg, 420);
  assert.ok(gmiii.weapons.some(weapon => weapon.head && /VULCAN/.test(weapon.name)));
  assert.ok(gmiii.weapons.some(weapon => weapon.integrated && /MEDIUM MISSILE/.test(weapon.name)
    && weapon.clip === 24 && weapon.barrage && weapon.freeAim && weapon.speed >= 1000));
  assert.ok(gmiii.weapons.some(weapon => weapon.integrated && /WAIST MISSILE/.test(weapon.name)
    && weapon.clip === 4 && weapon.barrage && weapon.freeAim && weapon.speed >= 900));
  assert.ok(jegan.weapons.some(weapon => weapon.integrated && /SHIELD MISSILE/.test(weapon.name)
    && weapon.type === 'lockmissile' && weapon.barrage && weapon.freeAim && weapon.speed >= 900));
  assert.ok(jegan.weapons[0].rof > gmii.weapons[0].rof && jegan.weapons[0].dmg < gmii.weapons[0].dmg);
  assert.ok(IDS.every(id => weaponLoadoutOptions(suitById(id)).primary.length >= 3));
});

test('each late Federation suit is routed to a dedicated canonical model builder', () => {
  const source = readFileSync(new URL('../js/canonical-fed.js', import.meta.url), 'utf8');
  const modelKit = readFileSync(new URL('../js/model-kit.js', import.meta.url), 'utf8');
  assert.match(source, /case 'gmii': return buildGMII/);
  assert.match(source, /case 'gmiii': return buildGMIII/);
  assert.match(source, /case 'jegan': return buildJegan/);
  assert.ok((source.match(/facetedHull\(/g) || []).length >= 18);
  assert.match(source, /geometry\.setAttribute\('uv', new THREE\.Float32BufferAttribute\(uvs, 2\)\)/);
  assert.match(modelKit, /if \(!geo\.getAttribute\('uv'\)\)/);
  assert.match(modelKit, /name !== 'position' && name !== 'normal' && name !== 'uv'/);
  assert.match(source, /frontSkirts: false/);
  assert.match(source, /shoulderIndex.*MEDIUM MISSILE/);
  assert.match(source, /waistIndex.*WAIST MISSILE/);
  assert.match(source, /missileIndex.*SHIELD MISSILE/);
});

test('late Federation missile racks fire immediately as a free-aim full-rack barrage', () => {
  const source = readFileSync(new URL('../js/battle.js', import.meta.url), 'utf8');
  assert.match(source, /function startMissileBarrage/);
  assert.match(source, /m\.clip = 0; \/\/ the trigger commits the whole rack immediately/);
  assert.match(source, /updateMissileBarrage\(m, dt\)/);
  assert.match(source, /m\.isPlayer && w\.freeAim/);
  assert.match(source, /startMissileBarrage\(m, null, manualAim\)/);
  assert.match(source, /homing: w\.freeAim \? null/);
  assert.match(source, /activeWeapon\?\.type === 'lockmissile' && !activeWeapon\.freeAim/);
});

test('the camera control cycles cockpit, tactical and pursuit views', () => {
  const source = readFileSync(new URL('../js/battle.js', import.meta.url), 'utf8');
  assert.match(source, /function cycleCameraView/);
  assert.match(source, /TACTICAL CAMERA/);
  assert.match(source, /PURSUIT CAMERA/);
  assert.match(source, /cameraView: firstPerson \? 'cockpit' : thirdPersonView/);
});
