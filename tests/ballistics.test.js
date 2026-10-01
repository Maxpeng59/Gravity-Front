import test from 'node:test';
import assert from 'node:assert/strict';
import { SUITS } from '../js/data.js';
import {
  armorThickness, ballisticProfile, beamFalloff, environmentPhysics, impactMultiplier,
  speedAfter, spreadBloom, stepBallistic, superelevation, timeOfFlight, weaponCalibre,
} from '../js/ballistics.js';

const weapon = name => SUITS.flatMap(s => s.weapons).find(w => w.name === name);

test('calibre is read from the weapon designation', () => {
  assert.equal(weaponCalibre(weapon('ZMP-50D 120MM MACHINE GUN')), 120);
  assert.equal(weaponCalibre(weapon('60MM VULCAN GUNS')), 60);
  assert.equal(weaponCalibre(weapon('XBR-M-79-07G BEAM RIFLE')), null);
});

test('weapons fall into the right ballistic families', () => {
  assert.equal(ballisticProfile(weapon('XBR-M-79-07G BEAM RIFLE')).kind, 'beam');
  assert.equal(ballisticProfile(weapon('ZMP-50D 120MM MACHINE GUN')).kind, 'kinetic');
  assert.equal(ballisticProfile(weapon('BLASH 380MM HYPER BAZOOKA')).kind, 'rocket');
  assert.equal(ballisticProfile(weapon('220MM CANNON')).kind, 'shell');
  assert.equal(ballisticProfile(weapon('QUAD BOP MISSILE LAUNCHER')).kind, 'rocket');
  // a gun designation in a beam slot is a kinetic long gun
  const sniper = ballisticProfile(weapon('EF-KAR98K 75MM SNIPER RIFLE'));
  assert.equal(sniper.kind, 'kinetic');
  assert.ok(sniper.longGun);
});

test('every authored weapon gets a finite, sane profile', () => {
  for (const suit of SUITS) for (const w of suit.weapons){
    const p = ballisticProfile(w);
    assert.ok(p, w.name);
    assert.ok(p.gravityScale >= 0 && p.gravityScale <= 1, w.name);
    assert.ok(p.drag >= 0 && p.drag < 0.001, w.name);
    assert.ok(p.heatPerShot > 0 && p.heatPerShot <= 0.3, w.name);
  }
});

test('vacuum has no drop or drag; ground has both', () => {
  const space = environmentPhysics('space'), ground = environmentPhysics('ground');
  const moon = environmentPhysics('ground', { airless: true });
  const colony = environmentPhysics('colony');
  assert.deepEqual(space, { gravity: 0, air: 0 });
  assert.ok(ground.gravity > 9 && ground.air === 1);
  assert.ok(moon.gravity < 2 && moon.air === 0);
  assert.equal(colony.gravity, ground.gravity * 0.2);
  assert.equal(colony.air, 1);
  const mg = ballisticProfile(weapon('ZMP-50D 120MM MACHINE GUN'));
  assert.equal(superelevation(mg, 840, 800, space), 0);
  assert.equal(speedAfter(mg, 840, 800, space.air), 840);
  assert.ok(superelevation(mg, 840, 800, ground) > 3);
  assert.ok(speedAfter(mg, 840, 800, ground.air) < 840 * 0.95);
});

test('fire-control hold-over matches the integrated trajectory', () => {
  const mg = ballisticProfile(weapon('YF-MG100 100MM MACHINE GUN'));
  const phys = environmentPhysics('ground');
  const distance = 700, speed = 1000;
  const lift = superelevation(mg, speed, distance, phys);
  // integrate a round aimed `lift` metres above a target `distance` metres away
  const dir = { x: 0, y: lift, z: distance }, len = Math.hypot(dir.y, dir.z);
  const vel = { x: 0, y: dir.y / len * speed, z: dir.z / len * speed };
  const pos = { x: 0, y: 0, z: 0 };
  const dt = 1 / 240;
  while (pos.z < distance){
    stepBallistic(vel, mg, phys, dt);
    pos.y += vel.y * dt; pos.z += vel.z * dt;
  }
  assert.ok(Math.abs(pos.y) < 1.2, `impact ${pos.y.toFixed(2)} m from the aim point`);
  assert.ok(timeOfFlight(mg, speed, distance, 1) > distance / speed);
});

test('small calibre rounds struggle against heavy armour, heavy guns do not', () => {
  const gundam = armorThickness(SUITS.find(s => s.id === 'rx78'));
  const zaku = armorThickness(SUITS.find(s => s.id === 'zaku2'));
  const vulcan = ballisticProfile(weapon('60MM VULCAN GUNS'));
  const tankGun = ballisticProfile(weapon('TWIN 155MM SMOOTHBORE CANNON'));
  const vsGundam = impactMultiplier({ profile: vulcan, impactSpeed: 1400, muzzleSpeed: 1500, armorMM: gundam });
  const vsZaku = impactMultiplier({ profile: vulcan, impactSpeed: 1400, muzzleSpeed: 1500, armorMM: zaku });
  assert.ok(vsGundam.mult < vsZaku.mult);
  assert.ok(vsGundam.mult >= 0.25 && vsGundam.mult < 0.8);
  assert.equal(impactMultiplier({ profile: tankGun, impactSpeed: 610, muzzleSpeed: 620, armorMM: zaku }).mult, 1);
});

test('glancing hits can ricochet; square hits never do', () => {
  const mg = ballisticProfile(weapon('ZMP-50D 120MM MACHINE GUN'));
  const armor = armorThickness(SUITS.find(s => s.id === 'rx78'));
  const glance = impactMultiplier({ profile: mg, impactSpeed: 800, muzzleSpeed: 840, cosImpact: 0.1, armorMM: armor, roll: 0.1 });
  assert.ok(glance.ricochet);
  const square = impactMultiplier({ profile: mg, impactSpeed: 800, muzzleSpeed: 840, cosImpact: 1, armorMM: armor, roll: 0.1 });
  assert.ok(!square.ricochet && square.mult > glance.mult);
});

test('beams diffuse with range, faster in air than vacuum', () => {
  assert.equal(beamFalloff(300, 1), 1);
  assert.ok(beamFalloff(1500, 1) < beamFalloff(1500, 0));
  assert.ok(beamFalloff(5000, 1) >= 0.55 - 1e-9);
  const rifle = ballisticProfile(weapon('XBR-M-79-07G BEAM RIFLE'));
  const far = impactMultiplier({ profile: rifle, impactSpeed: 1500, muzzleSpeed: 1500, armorMM: 999, distance: 2500, air: 1 });
  assert.ok(far.mult < 1 && far.penetrated);
});

test('spread bloom grows with heat and movement and settles at 1', () => {
  assert.equal(spreadBloom(), 1);
  assert.ok(spreadBloom({ heat: 1 }) > spreadBloom({ heat: 0.3 }));
  assert.ok(spreadBloom({ speedFrac: 1, boosting: true }) > 1.8);
  assert.ok(spreadBloom({ heat: 1, beam: true }) < spreadBloom({ heat: 1 }));
});
