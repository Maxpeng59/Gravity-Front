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

test('mobile armors are boss-sized but bounded multi-turret combatants', () => {
  for (const id of ['bigzam', 'apsaras3', 'neueziel', 'dendrobium']){
    const profile = mobileArmors.match(new RegExp(`${id}: Object\\.freeze\\(\\{([\\s\\S]*?)\\n  \\}\\)`))?.[1] || '';
    const number = key => Number(profile.match(new RegExp(`${key}: (\\d+)`))?.[1]);
    assert.ok(number('hp') >= 34000 && number('hp') <= 42000, `${id} HP`);
    assert.ok(number('speed') >= 12 && number('speed') <= 28, `${id} speed`);
    assert.ok(number('turretCount') >= 5 && number('turretCount') <= 8, `${id} hardpoint count`);
    assert.ok(number('mainRange') >= 1400 && number('mainRange') <= 1700, `${id} range`);
    assert.ok(number('activeTurretLimit') >= 2 && number('activeTurretLimit') <= 4, `${id} simultaneous banks`);
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
  assert.match(battle, /activeTurretLimit/);
  assert.match(battle, /relativeBankIndex >= activeLimit/);
  assert.match(battle, /mobileArmors: props\.filter\(p => p\.isMobileArmor\)/);
});

test('custom battle lets the player select a mobile armor with a normal MS reserve', () => {
  assert.match(main, /playerMobileArmor: null/);
  assert.match(main, /secondarySuitEligible = suit => !!suit && !suit\.air && !suit\.vehicle && !suit\.supportOnly/);
  assert.match(main, /aria-label', `Pilot \$\{armor\.name\} with secondary mobile suit`/);
  assert.match(main, /SECONDARY MOBILE SUIT/);
  assert.match(main, /playerMobileArmorKind: custom\.playerMobileArmor/);
  assert.match(main, /SECONDARY MS ON DESTRUCTION/);
});

test('player-controlled mobile armor has manual movement, beam banks, and MS fallback', () => {
  assert.match(battle, /const playerMobileArmorLocked = !!mobileArmorProfile/);
  assert.match(battle, /if \(p\.isMobileArmor\) return fireCommandedMobileArmorWeapon/);
  assert.match(battle, /PLAYER MOBILE ARMOR PRIMARY BEAM BANK/);
  assert.match(battle, /p === commandedShip && p\.isMobileArmor/);
  assert.match(battle, /if \(playerShipLocked && !playerShipProp\?\.alive && !playerMobileArmorLocked\)/);
  assert.match(battle, /DESTROYED — SECONDARY MS DEPLOYED/);
  assert.match(battle, /_debugDestroyPlayerMobileArmor\(\)/);
  assert.match(battle, /secondaryDeployed: playerMobileArmorLocked/);
});
