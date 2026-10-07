import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUITS } from '../js/data.js';

const battle = readFileSync(new URL('../js/battle.js', import.meta.url), 'utf8');
const effects = readFileSync(new URL('../js/anime-fx.js', import.meta.url), 'utf8');

test('player beam guns charge while held and discharge when LMB is released', () => {
  assert.match(battle, /const BEAM_CHARGE_SECONDS_PER_NORMAL_SHOT = 0\.08/);
  assert.equal((16 - 1) * 0.08, 1.2);
  assert.match(battle, /player\.beamChargeDraw = Math\.min\(player\.clip,[\s\S]*1 \+ player\.beamCharge \/ BEAM_CHARGE_SECONDS_PER_NORMAL_SHOT\)/);
  assert.doesNotMatch(battle, /Math\.floor\(player\.beamCharge/);
  assert.match(battle, /if \(e\.button === 0\)[\s\S]*releasePlayerBeamCharge\(\)[\s\S]*mouseDown = false/);
  assert.match(battle, /if \(isChargeableBeam\(activeWeapon\)\)[\s\S]*updatePlayerBeamCharge\(dt\);[\s\S]*return;/);
});

test('charged beams consume the selected battery draw and scale power and line length', () => {
  assert.match(battle, /spendActiveAmmo\(player, draw\)/);
  assert.match(battle, /return w\.dmg \* Math\.min\(1, Math\.max\(0, Number\(draw\) \|\| 0\)\)[\s\S]*\* Math\.exp\(BEAM_DAMAGE_EXPONENT \* beamChargeFraction\(w, draw\)\)/);
  assert.doesNotMatch(battle, /const maxHits =/);
  assert.match(battle, /for \(const hit of hits\)\{[\s\S]*if \(hit\.t > hardStop\) break/);
  assert.match(battle, /fx\.chargedBeamLine\(muzzle, end, player\.suit\.faction, width/);
  assert.match(effects, /function chargedBeamLine\(start, end, faction = 'FED', width = 1, life = 0\.18\)/);
});

test('charged beam lines and bounded charged damage replicate to PvP peers', () => {
  assert.match(battle, /kind: 'beam_charge',[\s\S]*chargeDraw: draw,[\s\S]*batteryPercent:[\s\S]*width,[\s\S]*life/);
  assert.match(battle, /if \(kind === 'beam_charge'\)[\s\S]*fx\.chargedBeamLine\(position, end, m\.suit\.faction, width, life\)/);
  assert.match(battle, /chargeDraw > 0 && isChargeableBeam\(weapon\)[\s\S]*beamChargeDamage\(weapon, chargeDraw\)/);
});

test('concentrated beam collisions create explosions on targets and terminal surfaces', () => {
  assert.match(battle, /function concentratedBeamImpactExplosion\(point, chargeFraction[\s\S]*explosion\(point, radius, volume\)/);
  assert.match(battle, /const terrainHit = rayTerrainHit\(muzzle, dir, range[\s\S]*const hardStop = terrainHit \? TERRAIN_HIT\.t : range/);
  assert.match(battle, /for \(const hit of hits\)[\s\S]*if \(hit\.t > hardStop\) break[\s\S]*impactPoints\.push\(point\)/);
  assert.doesNotMatch(battle, /hit\.hard[\s\S]*hardStop = Math\.min\(hardStop, hit\.t\)/);
  assert.match(battle, /if \(terrainHit\)[\s\S]*impactPoints\.push\(terminalPoint\)/);
  assert.match(battle, /const blastDamage = chargeDamage \* lerp\(CONCENTRATED_BEAM_SPLASH_MIN, CONCENTRATED_BEAM_SPLASH_MAX, chargeFraction\)/);
  assert.match(battle, /concentratedBeamImpactExplosion\(point, chargeFraction, blastDamage, player, directTargets\)/);
  assert.match(battle, /splashDamage\(point, radius, blastDamage, attacker, 'CONCENTRATED BEAM EXPLOSION', excludedTargets\)/);
  assert.match(battle, /if \(!m\.alive \|\| excludedTargets\?\.has\(m\)\) continue/);
  assert.match(battle, /impacts: impacts\.slice\(0, 16\)[\s\S]*if \(kind === 'beam_charge'\)[\s\S]*concentratedBeamImpactExplosion\(point, chargeFraction\)/);
});

test('sixteen normal beam shots equal a continuously drainable 100-percent battery', () => {
  assert.match(battle, /return clamp\(\(Number\(draw\) \|\| 0\) \/ Math\.max\(1, w\?\.clip \|\| 1\) \* 100, 0, 100\)/);
  assert.match(battle, /BATTERY \$\{beamBatteryPercent\(w, player\.clip\)\.toFixed\(1\)\}%[\s\S]*HOLD LMB/);
  assert.match(battle, /CHARGING \$\{chargePercent\.toFixed\(1\)\}%/);
});

test('a full battery discharge reaches exactly twenty times normal beam damage', () => {
  assert.match(battle, /const BEAM_DAMAGE_EXPONENT = Math\.log\(20\)/);
  const exponent = Math.log(20);
  const multiplier = draw => Math.exp(exponent * Math.max(0, Math.min(1, (draw - 1) / 15)));
  assert.equal(multiplier(1), 1);
  assert.ok(Math.abs(multiplier(16) - 20) < 1e-12);
  assert.ok(multiplier(8.5) > 1 && multiplier(8.5) < 20);
});

test('the GM charged beam spray remains six separate shotgun pellets', () => {
  const gm = SUITS.find(suit => suit.id === 'gm');
  const spray = gm.weapons.find(weapon => /BEAM SPRAY GUN/.test(weapon.name));
  assert.equal(spray.pellets, 6);
  assert.match(battle, /if \(w\.pellets\) return firePlayerChargedScatter\(w, draw, aimPoint\)/);
  assert.match(battle, /const pelletCount = Math\.max\(1, Math\.trunc\(w\.pellets \|\| 1\)\)/);
  assert.match(battle, /for \(let s = 0; s < pelletCount; s\+\+\)[\s\S]*projectileMesh\('beam', player\.suit\.faction\)[\s\S]*projectiles\.push\(projectile\)/);
  assert.match(battle, /chargeDraw: draw, chargedScatter: true/);
});

test('every true beam firearm can charge while the physical heat rod remains immediate-fire', () => {
  const beamWeapons = SUITS.flatMap(suit => suit.weapons).filter(weapon => weapon.type === 'beam');
  assert.ok(beamWeapons.length > 0);
  assert.ok(beamWeapons.some(weapon => /HEAT ROD/i.test(weapon.name)));
  assert.match(battle, /weapon\?\.type === 'beam' && !\/HEAT ROD\/i\.test\(weapon\.name \|\| ''\)/);
});
