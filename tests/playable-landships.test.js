import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANDSHIP_PROFILES } from '../js/landship-balance.js';

const menu = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const battle = readFileSync(new URL('../js/battle.js', import.meta.url), 'utf8');

test('all three landship hulls are selectable player units in ground custom battles', () => {
  assert.deepEqual(Object.keys(LANDSHIP_PROFILES).sort(), ['bigtray', 'dabude', 'gallop']);
  for (const id of Object.keys(LANDSHIP_PROFILES))
    assert.match(menu, new RegExp(`id: '${id}'.*env: 'ground'`));
  assert.match(menu, /SHIPS\.filter\(unit => unit\.env === custom\.env\)/);
  assert.match(menu, /landshipProfile\(ship\.id\) \|\| spaceShipProfile\(ship\.id\)/);
  assert.match(menu, /playerControlled: true/);
  assert.match(menu, /playerTeam: playerFaction, playerShipKind: custom\.playerShip/);
});

test('ground player ships receive a dedicated helm, independent turret sight, and manual batteries', () => {
  assert.match(battle, /const correctEnvironment = SPACE \? !!ship\?\.spaceProfile : !!ship\?\.landProfile/);
  assert.match(battle, /function updateCommandedLandship/);
  assert.match(battle, /if \(p === commandedShip\) updateCommandedLandship\(p, dt\)/);
  assert.match(battle, /MOUSE TURRET AIM · HULL STAYS ON COURSE/);
  assert.match(battle, /return index === 1 \? 'MACHINE-GUN BURST' : 'MAIN BATTERY'/);
  assert.match(battle, /function fireCommandedLandshipWeapon/);
  assert.match(battle, /weaponName: secondary \? 'PLAYER LANDSHIP MACHINE GUN' : 'PLAYER LANDSHIP MAIN BATTERY'/);
  assert.match(battle, /ship\.landProfile\.secondaryRange : ship\.landProfile\.mainRange/);
  assert.match(battle, /if \(p === commandedShip && p\.landProfile\) return/);
  assert.match(battle, /function updateCommandedLandshipTurrets/);
  assert.match(battle, /turret\.yaw\.rotation\.y = shipTurretYaw/);
  assert.match(battle, /turret\.gun\.rotation\.x = -shipTurretPitch/);
  assert.match(battle, /const sightDirection = landship \? commandedShipAimDirection\(ship\) : forward/);
  assert.match(battle, /if \(commandedShip\?\.landProfile\)[\s\S]*shipTurretYaw = wrapAngle[\s\S]*return;/);
});

test('landship helm stays on terrain and collision checks its full hull route', () => {
  assert.match(battle, /const ny = groundY\(nx, nz\)/);
  assert.match(battle, /staticCircleBlocked\(nx, nz, bodyRadius, ny, ny \+ p\.hitY \* 2\)/);
  assert.match(battle, /p\.root\.position\.set\(nx, ny, nz\)/);
  assert.match(battle, /p\.verticalThrust = false/);
  assert.match(battle, /p\.spaceTravelMode = 'land-helm'/);
});
