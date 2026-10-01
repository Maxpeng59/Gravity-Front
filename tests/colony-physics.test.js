import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLONY_FLIGHT_ENTER_HEIGHT, COLONY_FLIGHT_EXIT_HEIGHT, COLONY_GRAVITY_SCALE,
  COLONY_RADIUS, COLONY_SURFACE_FALL_ACCEL, colonyFloorHeight, colonyFreeFlightState,
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
