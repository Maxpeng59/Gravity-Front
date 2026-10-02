import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  spaceShipAttackHeading,
  sweptHeavyCollisionFraction,
  wrapNavalAngle,
} from '../js/naval-combat.js';

test('Federation gunships choose the shorter broadside inside battery range', () => {
  const port = spaceShipAttackHeading({
    team: 'FED', turretCount: 3, distance: 900, gunRange: 1400,
    currentYaw: 1.2, targetYaw: 0,
  });
  assert.equal(port.broadside, true);
  assert.equal(port.side, 1);
  assert.ok(Math.abs(wrapNavalAngle(port.yaw - Math.PI / 2)) < 1e-9);

  const starboard = spaceShipAttackHeading({
    team: 'FED', turretCount: 4, distance: 900, gunRange: 1600,
    currentYaw: -1.2, targetYaw: 0,
  });
  assert.equal(starboard.side, -1);
  assert.ok(Math.abs(wrapNavalAngle(starboard.yaw + Math.PI / 2)) < 1e-9);
});

test('ships stay bow-on outside range and carriers do not fake a three-turret broadside', () => {
  for (const input of [
    { team: 'FED', turretCount: 3, distance: 1500, gunRange: 1400 },
    { team: 'FED', turretCount: 2, distance: 800, gunRange: 1000 },
    { team: 'ZEON', turretCount: 3, distance: 800, gunRange: 1450 },
  ]){
    const result = spaceShipAttackHeading({ ...input, currentYaw: 0.4, targetYaw: 0.2 });
    assert.equal(result.broadside, false);
    assert.equal(result.yaw, 0.2);
  }
});

test('swept heavy collision catches fast opposing shells between frames', () => {
  const a = { pos: { x: -10, y: 0, z: 0 }, vel: { x: 1000, y: 0, z: 0 }, collisionRadius: 1.5 };
  const b = { pos: { x: 10, y: 0, z: 0 }, vel: { x: -1000, y: 0, z: 0 }, collisionRadius: 1.5 };
  const hit = sweptHeavyCollisionFraction(a, b, 0.02);
  assert.ok(hit !== null && hit > 0 && hit < 1);
});

test('parallel heavy rounds miss while overlapping rounds contact immediately', () => {
  const a = { pos: { x: 0, y: 0, z: 0 }, vel: { x: 800, y: 0, z: 0 }, collisionRadius: 1 };
  const parallel = { pos: { x: 0, y: 5, z: 0 }, vel: { x: 800, y: 0, z: 0 }, collisionRadius: 1 };
  const overlap = { pos: { x: 1, y: 0, z: 0 }, vel: { x: -800, y: 0, z: 0 }, collisionRadius: 1 };
  assert.equal(sweptHeavyCollisionFraction(a, parallel, 0.05), null);
  assert.equal(sweptHeavyCollisionFraction(a, overlap, 0.05), 0);
});

test('runtime tags only heavy ordnance for interception and reports broadside state', () => {
  const battle = readFileSync(new URL('../js/battle.js', import.meta.url), 'utf8');
  assert.match(battle, /function detonateHeavyProjectileCollisions/);
  assert.match(battle, /a\.owner === b\.owner/);
  assert.match(battle, /heavy: w\.type === 'bazooka' \|\| !!w\.shell/);
  assert.match(battle, /heavy: true, collisionRadius: p\.spaceProfile \? 2\.6 : p\.battery \? 1\.8 : 2\.1/);
  assert.match(battle, /spaceShipAttackHeading\(/);
  assert.match(battle, /heavyProjectileInterceptions/);
  assert.match(battle, /t\.shotsFired = \(t\.shotsFired \|\| 0\) \+ \(t\.shots \|\| 1\)/);
});
