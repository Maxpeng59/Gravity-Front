import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUITS } from '../js/data.js';

const battle = readFileSync(new URL('../js/battle.js', import.meta.url), 'utf8');
const effects = readFileSync(new URL('../js/anime-fx.js', import.meta.url), 'utf8');

test('player beam guns charge while held and discharge when LMB is released', () => {
  assert.match(battle, /const BEAM_CHARGE_SECONDS_PER_CELL = 0\.16/);
  assert.match(battle, /player\.beamChargeCells = Math\.min\(player\.clip,[\s\S]*1 \+ Math\.floor\(player\.beamCharge \/ BEAM_CHARGE_SECONDS_PER_CELL\)\)/);
  assert.match(battle, /if \(e\.button === 0\)[\s\S]*releasePlayerBeamCharge\(\)[\s\S]*mouseDown = false/);
  assert.match(battle, /if \(isChargeableBeam\(activeWeapon\)\)[\s\S]*updatePlayerBeamCharge\(dt\);[\s\S]*return;/);
});

test('charged beams consume the selected battery draw and scale power and line length', () => {
  assert.match(battle, /player\.clip = Math\.max\(0, player\.clip - cells\)/);
  assert.match(battle, /const chargeDamage = w\.dmg \* \(1 \+ 0\.32 \* Math\.pow\(Math\.max\(0, cells - 1\), 0\.72\)\)/);
  assert.match(battle, /const maxHits = Math\.min\(4, 1 \+ Math\.floor\(\(cells - 1\) \/ 5\)\)/);
  assert.match(battle, /fx\.chargedBeamLine\(muzzle, end, player\.suit\.faction, width/);
  assert.match(effects, /function chargedBeamLine\(start, end, faction = 'FED', width = 1, life = 0\.18\)/);
});

test('charged beam lines and bounded charged damage replicate to PvP peers', () => {
  assert.match(battle, /kind: 'beam_charge',[\s\S]*chargeCells: cells,[\s\S]*width,[\s\S]*life/);
  assert.match(battle, /if \(kind === 'beam_charge'\)[\s\S]*fx\.chargedBeamLine\(position, end, m\.suit\.faction, width, life\)/);
  assert.match(battle, /chargeCells > 0 && isChargeableBeam\(weapon\)[\s\S]*weapon\.dmg \* \(1 \+ 0\.32/);
});

test('every true beam firearm can charge while the physical heat rod remains immediate-fire', () => {
  const beamWeapons = SUITS.flatMap(suit => suit.weapons).filter(weapon => weapon.type === 'beam');
  assert.ok(beamWeapons.length > 0);
  assert.ok(beamWeapons.some(weapon => /HEAT ROD/i.test(weapon.name)));
  assert.match(battle, /weapon\?\.type === 'beam' && !\/HEAT ROD\/i\.test\(weapon\.name \|\| ''\)/);
});
