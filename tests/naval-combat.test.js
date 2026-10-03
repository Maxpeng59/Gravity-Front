import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  federationRamEligible,
  spaceShipAttackHeading,
  spaceShipHelmVelocity,
  spaceShipPropulsionEngaged,
  spaceShipTravelMode,
  spaceShipVelocityToward,
  sweptHeavyCollisionFraction,
  wrapNavalAngle,
} from '../js/naval-combat.js';

test('Federation gunships choose the shorter broadside inside battery range', () => {
  const port = spaceShipAttackHeading({
    team: 'FED', turretCount: 3, distance: 900, gunRange: 1400,
    currentYaw: 1.2, targetYaw: 0, travelMode: 'hold',
  });
  assert.equal(port.broadside, true);
  assert.equal(port.side, 1);
  assert.ok(Math.abs(wrapNavalAngle(port.yaw - Math.PI / 2)) < 1e-9);

  const starboard = spaceShipAttackHeading({
    team: 'FED', turretCount: 4, distance: 900, gunRange: 1600,
    currentYaw: -1.2, targetYaw: 0, travelMode: 'hold',
  });
  assert.equal(starboard.side, -1);
  assert.ok(Math.abs(wrapNavalAngle(starboard.yaw + Math.PI / 2)) < 1e-9);
});

test('a Federation gunship turns bow-on whenever it needs to move', () => {
  const result = spaceShipAttackHeading({
    team: 'FED', turretCount: 3, distance: 900, gunRange: 1400,
    currentYaw: Math.PI / 2, targetYaw: 0, travelMode: 'move', broadsideSide: 1,
  });
  assert.equal(result.broadside, false);
  assert.equal(result.side, 0);
  assert.equal(result.yaw, 0);
  assert.equal(spaceShipPropulsionEngaged('move', Math.PI / 2), false);
  assert.equal(spaceShipPropulsionEngaged('move', 0.17), true);
  assert.equal(spaceShipPropulsionEngaged('hold', 0), false);
});

test('Federation combat ships can commit to a bow-first charge but the carrier and Zeon cannot', () => {
  assert.equal(federationRamEligible({
    team: 'FED', kind: 'salamis', distance: 720, standoff: 620, cooldown: 0,
  }), true);
  assert.equal(federationRamEligible({
    team: 'FED', kind: 'magellan', distance: 820, standoff: 700, cooldown: 0,
  }), true);
  assert.equal(federationRamEligible({
    team: 'FED', kind: 'columbus', distance: 720, standoff: 900, cooldown: 0,
  }), false);
  assert.equal(federationRamEligible({
    team: 'ZEON', kind: 'musai', distance: 720, standoff: 620, cooldown: 0,
  }), false);
  const heading = spaceShipAttackHeading({
    team: 'FED', turretCount: 4, distance: 500, gunRange: 1600,
    currentYaw: Math.PI / 2, targetYaw: 0, travelMode: 'charge', broadsideSide: 1,
  });
  assert.equal(heading.broadside, false);
  assert.equal(heading.yaw, 0);
  assert.equal(spaceShipPropulsionEngaged('charge', 0.1), true);
});

test('space ships climb and descend without exceeding their commanded speed', () => {
  const climb = spaceShipVelocityToward({ x: 100, y: 500, z: 0 }, 20, true, 0.68);
  const descend = spaceShipVelocityToward({ x: 0, y: -80, z: 100 }, 20, false, 0.68);
  assert.ok(climb.y > 0 && climb.y <= 13.600001);
  assert.ok(Math.hypot(climb.x, climb.y, climb.z) <= 20 + 1e-9);
  assert.equal(descend.x, 0);
  assert.ok(descend.y < 0);
  assert.equal(descend.z, 0);
});

test('manual helm velocity follows hull yaw and keeps height control independent', () => {
  const ahead = spaceShipHelmVelocity(0, 24, 7);
  assert.deepEqual(ahead, { x: 0, y: 7, z: 24 });
  const starboard = spaceShipHelmVelocity(Math.PI / 2, 24, -5);
  assert.ok(Math.abs(starboard.x - 24) < 1e-9);
  assert.equal(starboard.y, -5);
  assert.ok(Math.abs(starboard.z) < 1e-9);
});

test('ship hold range uses hysteresis before switching back to travel', () => {
  assert.equal(spaceShipTravelMode(1100, 1000, 'move'), 'move');
  assert.equal(spaceShipTravelMode(1000, 1000, 'move'), 'hold');
  assert.equal(spaceShipTravelMode(1040, 1000, 'hold'), 'hold');
  assert.equal(spaceShipTravelMode(1056, 1000, 'hold'), 'move');
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
  assert.match(battle, /heavy: t\.heavy \?\? true/);
  assert.match(battle, /spaceShipAttackHeading\(/);
  assert.match(battle, /federationRamEligible\(/);
  assert.match(battle, /damageProp\(target, ramDamage, impact, p, 'BOW RAM'\)/);
  assert.match(battle, /spaceShipVelocityToward\(/);
  assert.match(battle, /spaceShipHelmVelocity\(/);
  assert.match(battle, /function updateCommandedShip\(/);
  assert.match(battle, /H CAPITAL SHIP HELM/);
  assert.match(battle, /p\.root\.position\.addScaledVector\(p\.vel, dt\)/);
  assert.match(battle, /heavyProjectileInterceptions/);
  assert.match(battle, /t\.shotsFired = \(t\.shotsFired \|\| 0\) \+ \(t\.shots \|\| 1\)/);
});
