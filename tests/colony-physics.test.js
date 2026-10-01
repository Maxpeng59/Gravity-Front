import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLONY_AI_FLIGHT_CRUISE_HEIGHT, COLONY_FLIGHT_ENTER_HEIGHT, COLONY_FLIGHT_EXIT_HEIGHT,
  COLONY_FLIGHT_ROLL_RATE, COLONY_GRAVITY_SCALE, COLONY_RADIUS, COLONY_SURFACE_FALL_ACCEL,
  advanceColonyFlightRoll, colonyFloorHeight, colonyFreeFlightState, colonySurfaceNormal,
} from '../js/colony-physics.js';

test('colony floor follows the lower inside arc of the habitat cylinder', () => {
  assert.equal(colonyFloorHeight(0), 0);
  assert.equal(colonyFloorHeight(900), colonyFloorHeight(-900));
  assert.ok(colonyFloorHeight(900) > 100);
  assert.ok(colonyFloorHeight(1700) > colonyFloorHeight(900));
  assert.ok(colonyFloorHeight(1700) < COLONY_RADIUS);
});

test('colony surface gravity is one fifth of the ordinary movement gravity', () => {
  assert.equal(COLONY_GRAVITY_SCALE, 0.2);
  assert.ok(Math.abs(COLONY_SURFACE_FALL_ACCEL - 7.6) < 1e-9);
});

test('a boosted jump enters free flight and descending near the shell reconnects gravity', () => {
  assert.equal(colonyFreeFlightState(false, COLONY_FLIGHT_ENTER_HEIGHT - 1, 20), false);
  assert.equal(colonyFreeFlightState(false, COLONY_FLIGHT_ENTER_HEIGHT, 20), true);
  assert.equal(colonyFreeFlightState(true, COLONY_FLIGHT_EXIT_HEIGHT + 1, -20), true);
  assert.equal(colonyFreeFlightState(true, COLONY_FLIGHT_EXIT_HEIGHT, -1), false);
});

test('surface normal keeps a unit perpendicular to either side of the cylinder', () => {
  assert.deepEqual(colonySurfaceNormal(0), { x: -0, y: 1, z: 0 });
  const right = colonySurfaceNormal(COLONY_RADIUS * 0.6);
  const left = colonySurfaceNormal(-COLONY_RADIUS * 0.6);
  assert.ok(Math.abs(Math.hypot(right.x, right.y, right.z) - 1) < 1e-9);
  assert.equal(right.x, -left.x);
  assert.equal(right.y, left.y);
  assert.ok(right.x < 0 && right.y > 0);
});

test('free-flight roll is pilot controlled, rate limited, and wraps cleanly', () => {
  assert.equal(COLONY_FLIGHT_ROLL_RATE, Math.PI * 0.75);
  assert.ok(COLONY_AI_FLIGHT_CRUISE_HEIGHT > COLONY_FLIGHT_ENTER_HEIGHT);
  assert.ok(Math.abs(advanceColonyFlightRoll(0, 1, 0.5) - Math.PI * 0.375) < 1e-9);
  assert.ok(advanceColonyFlightRoll(Math.PI - 0.1, 1, 1) < 0);
});
