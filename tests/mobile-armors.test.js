import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const battle = readFileSync(new URL('../js/battle.js', import.meta.url), 'utf8');
const mobileArmors = readFileSync(new URL('../js/mobile-armors.js', import.meta.url), 'utf8');

test('four faction-authentic UC mobile armors join the custom roster', () => {
  for (const [id, faction] of [['bigzam', 'ZEON'], ['apsaras3', 'ZEON'], ['neueziel', 'ZEON'], ['dendrobium', 'FED']])
    assert.match(mobileArmors, new RegExp(`id: '${id}'[\\s\\S]*?faction: '${faction}'`));
  assert.match(mobileArmors, /export const MOBILE_ARMOR_IDS = new Set\(MOBILE_ARMORS\.map\(unit => unit\.id\)\)/);
  assert.match(main, /\.\.\.MOBILE_ARMORS\.filter\(unit => unit\.faction === canonicalShipFaction\)/);
  assert.match(main, /if \(MOBILE_ARMOR_IDS\.has\(entry\.id\)\) return true/);
});

test('mobile armors are high-HP moderate-speed multi-turret combatants', () => {
  for (const id of ['bigzam', 'apsaras3', 'neueziel', 'dendrobium']){
    const profile = mobileArmors.match(new RegExp(`${id}: Object\\.freeze\\(\\{([\\s\\S]*?)\\n  \\}\\)`))?.[1] || '';
    const number = key => Number(profile.match(new RegExp(`${key}: (\\d+)`))?.[1]);
    assert.ok(number('hp') >= 76000, `${id} HP`);
    assert.ok(number('speed') >= 18 && number('speed') <= 32, `${id} speed`);
    assert.ok(number('turretCount') >= 10, `${id} turret count`);
    assert.ok(number('mainRange') >= 1800, `${id} range`);
  }
});

test('each mobile armor builds its own large silhouette and full independent turret bank', () => {
  for (const builder of ['buildBigZam', 'buildApsaras', 'buildNeueZiel', 'buildDendrobium'])
    assert.match(mobileArmors, new RegExp(`function ${builder}\\([\\s\\S]*?userData\\.silhouette[\\s\\S]*?return \\{ root, turrets`));
  assert.match(mobileArmors, /turrets\.push\(\{[\s\S]*yaw, gun, muzzle: muzzles\[0\], muzzles/);
  assert.match(mobileArmors, /if \(kind === 'bigzam'\) return buildBigZam/);
  assert.match(mobileArmors, /if \(kind === 'dendrobium'\) return buildDendrobium/);
});

test('battle runtime treats mobile armors as moving targetable heavy props in every environment', () => {
  assert.match(battle, /const mobileArmor = mobileArmorProfile\(kind\)/);
  assert.match(battle, /const spaceProfile = mobileArmor && SPACE \? mobileArmor : spaceShipProfile\(kind\)/);
  assert.match(battle, /const landProfile = mobileArmor && !SPACE \? mobileArmor : landshipProfile\(kind\)/);
  assert.match(battle, /isProp: true, isShip, isMobileArmor: !!mobileArmor/);
  assert.match(battle, /groundY\(nx, nz\) \+ \(p\.hoverHeight \|\| 0\)/);
  assert.match(battle, /p\.spaceProfile \|\| p\.isMobileArmor/);
  assert.match(battle, /energy: !!p\.isMobileArmor/);
  assert.match(battle, /mobileArmors: props\.filter\(p => p\.isMobileArmor\)/);
});
