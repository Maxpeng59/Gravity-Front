import assert from 'node:assert/strict';
import test from 'node:test';

import {
  circleYawRectPenetration,
  raySphere,
  segmentSphere,
  segmentYawBox,
  sweepCircleYawRect,
} from '../js/collision-math.js';

const EPSILON = 1e-9;
const approx = (actual, expected, epsilon = EPSILON) => {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );
};

const localToWorld = (x, z, yaw, centerX = 0, centerZ = 0) => ({
  x: centerX + Math.cos(yaw) * x + Math.sin(yaw) * z,
  z: centerZ - Math.sin(yaw) * x + Math.cos(yaw) * z,
});

test('ray and segment sphere return the first surface entry', () => {
  const rayHit = {};
  assert.equal(
    raySphere(-10, 0, 0, 2, 0, 0, 0, 0, 0, 2, rayHit),
    true,
  );
  approx(rayHit.t, 4);
  approx(rayHit.x, -2);
  assert.deepEqual(
    { nx: rayHit.nx, ny: rayHit.ny, nz: rayHit.nz, inside: rayHit.inside },
    { nx: -1, ny: 0, nz: 0, inside: false },
  );

  const segmentHit = {};
  assert.equal(
    segmentSphere(-10, 0, 0, 10, 0, 0, 0, 0, 0, 2, segmentHit),
    true,
  );
  approx(segmentHit.t, 0.4);

  assert.equal(
    segmentSphere(-10, 3, 0, 10, 3, 0, 0, 0, 0, 2),
    false,
  );
});

test('yaw box entry is exact and nearer boxes sort before farther boxes', () => {
  const yaw = Math.PI / 4;
  const nearHit = {};
  const farHit = {};

  assert.equal(
    segmentYawBox(-10, 0, 0, 10, 0, 0, 0, 0, 0, 4, 2, 1, yaw, nearHit),
    true,
  );
  approx(nearHit.t, (10 - Math.SQRT2) / 20);
  approx(nearHit.nx, -Math.SQRT1_2);
  approx(nearHit.nz, -Math.SQRT1_2);

  assert.equal(
    segmentYawBox(-10, 0, 0, 10, 0, 0, 5, 0, 0, 1, 2, 1, 0, farHit),
    true,
  );
  assert.ok(nearHit.t < farHit.t, 'nearest collider should have the lower entry fraction');
  approx(farHit.t, 0.7);
});

test('circle penetration returns world-space separation for a rotated rectangle', () => {
  const yaw = Math.PI / 6;
  const circle = localToWorld(2.5, 0, yaw);
  const hit = {};

  assert.equal(
    circleYawRectPenetration(circle.x, circle.z, 1, 0, 0, 2, 1, yaw, hit),
    true,
  );
  approx(hit.depth, 0.5);
  approx(hit.nx, Math.cos(yaw));
  approx(hit.nz, -Math.sin(yaw));
  assert.equal(hit.inside, false);
});

test('fast circle sweep cannot tunnel through a rotated rectangle', () => {
  const yaw = Math.PI / 6;
  const start = localToWorld(-20, 0, yaw);
  const end = localToWorld(20, 0, yaw);
  const hit = {};

  assert.equal(
    sweepCircleYawRect(
      start.x,
      start.z,
      end.x - start.x,
      end.z - start.z,
      0.5,
      0,
      0,
      3,
      1,
      yaw,
      hit,
    ),
    true,
  );
  approx(hit.t, 0.4125);
  approx(hit.nx, -Math.cos(yaw));
  approx(hit.nz, Math.sin(yaw));
});

test('rounded-corner checks reject expanded-box false positives', () => {
  const yaw = Math.PI / 6;
  const outsideCorner = localToWorld(2.4, 1.4, yaw);
  assert.equal(
    circleYawRectPenetration(
      outsideCorner.x,
      outsideCorner.z,
      0.5,
      0,
      0,
      2,
      1,
      yaw,
    ),
    false,
  );

  const start = localToWorld(-10, 1.6, yaw);
  const end = localToWorld(10, 1.6, yaw);
  assert.equal(
    sweepCircleYawRect(
      start.x,
      start.z,
      end.x - start.x,
      end.z - start.z,
      0.5,
      0,
      0,
      2,
      1,
      yaw,
    ),
    false,
  );
});
