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

test('mobile armor profiles carry canonical dimensions, mass, weapon manifests and I-field state', () => {
  assert.match(mobileArmors, /dimensions: '59\.6 m tall'[\s\S]*mass: '1,936\.0 t full'[\s\S]*iField: true/);
  assert.match(mobileArmors, /apsaras3:[\s\S]*dimensions: 'approx\. 70 m disc'[\s\S]*iField: false/);
  assert.match(mobileArmors, /dimensions: '76\.6 m long'[\s\S]*mass: '403\.5 t full'[\s\S]*iField: true/);
  assert.match(mobileArmors, /dimensions: '140\.0 m long \/ 38\.5 m tall'[\s\S]*mass: '453\.1 t full'[\s\S]*iField: true/);
  for (const weapon of ['28 × 2.1 MW MEGA-PARTICLE GUN', 'VARIABLE-FOCUS LARGE MEGA-PARTICLE CANNON', '24 × SMALL MISSILE LAUNCHER', '2 × LARGE CLAW / LARGE BEAM SABER'])
    assert.ok(mobileArmors.includes(weapon), weapon);
});

test('damage and mobility follow each machine combat role instead of one generic boss template', () => {
  assert.match(mobileArmors, /bigzam:[\s\S]*speed: 11[\s\S]*mainDamage: 2200/);
  assert.match(mobileArmors, /apsaras3:[\s\S]*mainDamage: 2800[\s\S]*mainSplash: 46/);
  assert.match(mobileArmors, /neueziel:[\s\S]*speed: 32[\s\S]*turnRate: 0\.38/);
  assert.match(mobileArmors, /dendrobium:[\s\S]*speed: 35[\s\S]*mainRange: 2350/);
});

test('each mobile armor builds its own large silhouette and full independent turret bank', () => {
  for (const builder of ['buildBigZam', 'buildApsaras', 'buildNeueZiel', 'buildDendrobium'])
    assert.match(mobileArmors, new RegExp(`function ${builder}\\([\\s\\S]*?userData\\.silhouette[\\s\\S]*?return \\{ root, turrets`));
  assert.match(mobileArmors, /turrets\.push\(\{[\s\S]*yaw, gun, muzzle: muzzles\[0\], muzzles/);
  assert.match(mobileArmors, /if \(kind === 'bigzam'\) return buildBigZam/);
  assert.match(mobileArmors, /if \(kind === 'dendrobium'\) return buildDendrobium/);
  assert.match(mobileArmors, /addRingTurrets\(root, turrets, light, dark, cooldown, 28/);
  assert.match(mobileArmors, /weaponName: 'APSARAS III VARIABLE-FOCUS LARGE MEGA-PARTICLE CANNON'/);
  assert.match(mobileArmors, /weaponName: 'NEUE ZIEL SMALL MISSILE BARRAGE'/);
  assert.match(mobileArmors, /weaponName: 'DENDROBIUM MICRO-MISSILE CONTAINER'/);
});

test('battle runtime treats mobile armors as moving targetable heavy props in every environment', () => {
  assert.match(battle, /const mobileArmor = mobileArmorProfile\(kind\)/);
  assert.match(battle, /const spaceProfile = mobileArmor && SPACE \? mobileArmor : spaceShipProfile\(kind\)/);
  assert.match(battle, /const landProfile = mobileArmor && !SPACE \? mobileArmor : landshipProfile\(kind\)/);
  assert.match(battle, /isProp: true, isShip, isMobileArmor: !!mobileArmor/);
  assert.match(battle, /groundY\(nx, nz\) \+ \(p\.hoverHeight \|\| 0\)/);
  assert.match(battle, /p\.spaceProfile \|\| p\.isMobileArmor/);
  assert.match(battle, /activeTurretLimit/);
  assert.match(battle, /relativeBankIndex >= activeLimit/);
  assert.match(battle, /t\.damage \?\? p\.gunDmg/);
  assert.match(battle, /t\.weaponType === 'missile'/);
  assert.match(battle, /homing: mobileArmorMissile \? best : null/);
  assert.match(battle, /if \(p\.iField && energy && attacker\?\.root\)/);
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

test('player-controlled mobile armor has manual movement, canonical weapon banks, and MS fallback', () => {
  assert.match(battle, /const playerMobileArmorLocked = !!mobileArmorProfile/);
  assert.match(battle, /if \(p\.isMobileArmor\) return fireCommandedMobileArmorWeapon/);
  assert.match(battle, /turret\.weaponName \|\| 'MOBILE ARMOR WEAPON'/);
  assert.match(battle, /const missile = turret\.weaponType === 'missile'/);
  assert.match(battle, /energy: !missile && !vulcan/);
  assert.match(battle, /p === commandedShip && p\.isMobileArmor/);
  assert.match(battle, /if \(playerShipLocked && !playerShipProp\?\.alive && !playerMobileArmorLocked\)/);
  assert.match(battle, /DESTROYED — SECONDARY MS DEPLOYED/);
  assert.match(battle, /_debugDestroyPlayerMobileArmor\(\)/);
  assert.match(battle, /secondaryDeployed: playerMobileArmorLocked/);
});
