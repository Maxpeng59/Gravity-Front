// Universal Century field-armament modification.
//
// The catalogue deliberately covers hand-carried weapons only. Built-in head,
// chest, arm and backpack weapons stay attached to their original machine. A
// custom rack replaces the stock hand-carried set with one primary and an
// optional support weapon, and carried mass changes both walk and boost speed.

const FED_STANDARD = ['rx78', 'gm', 'gmbazooka'];
const FED_GROUND = ['rx79g', 'ez8', 'gmg_a', 'gmg_b'];
const FED_GM = ['gm', 'gmbazooka', 'gmg_a', 'gmg_b', 'rgm79sp', 'gmspartan'];
const FED_MODULAR = [...new Set([...FED_STANDARD, ...FED_GROUND, ...FED_GM])];
const ZEON_ZAKU = ['zaku2', 'zaku2g', 'zaku2b', 'zaku2s'];
const ZEON_GOUF = ['gouf', 'goufnh'];
const ZEON_DOM = ['dom'];
const ZEON_GELGOOG = ['gelgoog', 'gelgoogs'];

const ALL_ZEON_HANDS = [...ZEON_ZAKU, ...ZEON_GOUF, ...ZEON_DOM, ...ZEON_GELGOOG];

const W = (id, name, mass, slots, suits, stats) => Object.freeze({
  id, name, mass, slots: Object.freeze(slots), suits: Object.freeze(suits),
  weapon: Object.freeze({ name, ...stats }),
});

export const WEAPON_CATALOG = Object.freeze([
  W('fed_beam_rifle', 'XBR-M-79-07G BEAM RIFLE', 7.2, ['primary'], FED_MODULAR,
    { type: 'beam', dmg: 420, rof: 1.45, clip: 16, reload: 2.6, speed: 1500, spread: 0.004, pref: 520 }),
  W('fed_beam_spray', 'BOWA BR-M-79C-1 BEAM SPRAY GUN', 4.2, ['primary'], FED_GM,
    { type: 'beam', dmg: 46, rof: 2.6, clip: 18, reload: 2.4, speed: 720, spread: 0.11, life: 0.85, pellets: 6, pref: 210 }),
  W('fed_90mm', 'HWF GMG·MG79-90 90MM MACHINE GUN', 5.0, ['primary', 'support'], FED_MODULAR,
    { type: 'mg', dmg: 58, rof: 8.8, clip: 90, reload: 2.5, speed: 1100, spread: 0.018, pref: 330 }),
  W('fed_100mm', 'YHI YF-MG100 100MM MACHINE GUN', 5.8, ['primary', 'support'], [...FED_GROUND, ...FED_GM, 'rx78'],
    { type: 'mg', dmg: 64, rof: 7.5, clip: 60, reload: 2.7, speed: 1050, spread: 0.016, pref: 360 }),
  W('fed_hyper_bazooka', 'BLASH HB-L-03/N-STD HYPER BAZOOKA', 11.5, ['primary', 'support'], FED_MODULAR,
    { type: 'bazooka', dmg: 530, rof: 0.72, clip: 6, reload: 3.4, speed: 280, spread: 0.012, splash: 15, pref: 390 }),
  W('fed_180mm', 'YHI FH-X180 180MM CANNON', 15.5, ['primary'], [...FED_GROUND, 'rgm79sp'],
    { type: 'beam', dmg: 700, rof: 0.5, clip: 6, reload: 4.0, speed: 1900, spread: 0.002, shell: true, recoil: 0.8, pref: 820 }),
  W('fed_sniper', 'EF-KAR98K 75MM SNIPER RIFLE', 9.0, ['primary'], [...FED_GROUND, ...FED_GM],
    { type: 'beam', dmg: 720, rof: 0.5, clip: 6, reload: 3.4, speed: 2200, spread: 0.001, pref: 900 }),
  W('fed_missile', 'YHI 6-TUBE MISSILE LAUNCHER', 10.0, ['support'], FED_GROUND,
    { type: 'bazooka', dmg: 330, rof: 1.0, clip: 6, reload: 3.6, speed: 340, spread: 0.018, splash: 11, pref: 430 }),

  W('zeon_120mm', 'ZMP-50D 120MM ZAKU MACHINE GUN', 7.5, ['primary'], [...ZEON_ZAKU, ...ZEON_GOUF],
    { type: 'mg', dmg: 48, rof: 8.2, clip: 100, reload: 2.8, speed: 880, spread: 0.023, pref: 320 }),
  W('zeon_mmp80', 'MMP-80 90MM MACHINE GUN', 5.5, ['primary', 'support'], ALL_ZEON_HANDS,
    { type: 'mg', dmg: 58, rof: 9.5, clip: 80, reload: 2.5, speed: 1060, spread: 0.019, pref: 330 }),
  W('zeon_zaku_bazooka', 'H&L-SB25K 280MM ZAKU BAZOOKA', 11.0, ['primary', 'support'], [...ZEON_ZAKU, ...ZEON_GOUF, ...ZEON_GELGOOG],
    { type: 'bazooka', dmg: 480, rof: 0.72, clip: 5, reload: 3.4, speed: 260, spread: 0.014, splash: 14, pref: 400 }),
  W('zeon_giant_bazooka', 'H&L-GB03K 360MM GIANT BAZOOKA', 14.0, ['primary', 'support'], [...ZEON_ZAKU, ...ZEON_DOM, ...ZEON_GELGOOG],
    { type: 'bazooka', dmg: 560, rof: 0.58, clip: 7, reload: 3.7, speed: 275, spread: 0.012, splash: 18, pref: 430 }),
  W('zeon_magella_cannon', 'ZIM/M.T-K175C MAGELLA TOP CANNON', 15.0, ['primary'], ZEON_ZAKU,
    { type: 'beam', dmg: 690, rof: 0.52, clip: 6, reload: 4.1, speed: 1750, spread: 0.003, shell: true, recoil: 0.85, pref: 780 }),
  W('zeon_anti_ship', 'ASR-78 ANTI-SHIP RIFLE', 13.0, ['primary'], ZEON_ZAKU,
    { type: 'beam', dmg: 760, rof: 0.42, clip: 5, reload: 4.4, speed: 2150, spread: 0.0015, shell: true, ap: true, recoil: 1.0, pref: 920 }),
  W('zeon_gelgoog_beam', 'MS-14A GELGOOG BEAM RIFLE', 8.0, ['primary'], ZEON_GELGOOG,
    { type: 'beam', dmg: 430, rof: 1.35, clip: 14, reload: 2.7, speed: 1450, spread: 0.004, pref: 540 }),
  W('zeon_cracker', 'MIP-B6 CRACKER GRENADE', 2.2, ['support'], [...ZEON_ZAKU, ...ZEON_GOUF],
    { type: 'bazooka', dmg: 340, rof: 1.2, clip: 3, reload: 3.0, speed: 360, spread: 0.022, splash: 12, pref: 240 }),
  W('zeon_missile', 'ZEON 3-TUBE MISSILE LAUNCHER', 7.8, ['support'], [...ZEON_ZAKU, ...ZEON_GOUF, ...ZEON_GELGOOG],
    { type: 'bazooka', dmg: 310, rof: 1.1, clip: 6, reload: 3.3, speed: 330, spread: 0.02, splash: 10, pref: 390 }),
]);

const BY_ID = new Map(WEAPON_CATALOG.map(item => [item.id, item]));
const fixedWeapon = weapon => !!(weapon?.head || weapon?.integrated);

function estimatedMass(weapon){
  if (!weapon || fixedWeapon(weapon)) return 0;
  const name = String(weapon.name || '');
  const exact = WEAPON_CATALOG.find(item => item.name === name);
  if (exact) return exact.mass;
  if (/180MM|ANTI-SHIP|MAGELLA|ARTILLERY/.test(name)) return 15;
  if (/GIANT BAZOOKA/.test(name)) return 14;
  if (/BAZOOKA/.test(name)) return 11;
  if (/SNIPER/.test(name)) return 9;
  if (/MISSILE/.test(name)) return 8;
  if (/120MM/.test(name)) return 7.5;
  if (/100MM/.test(name)) return 5.8;
  if (/90MM|SPRAY/.test(name)) return 5;
  if (weapon.type === 'beam') return 7;
  if (weapon.type === 'mg') return 6;
  if (weapon.type === 'bazooka') return 10;
  return 5;
}

export function weaponLoadoutOptions(suit){
  if (!suit || suit.air || suit.vehicle || suit.apc) return { primary: [], support: [] };
  const allowed = item => item.suits.includes(suit.id);
  return {
    primary: WEAPON_CATALOG.filter(item => allowed(item) && item.slots.includes('primary')),
    support: WEAPON_CATALOG.filter(item => allowed(item) && item.slots.includes('support')),
  };
}

export function canModifyWeapons(suit){
  return weaponLoadoutOptions(suit).primary.length > 0;
}

export function normalizeWeaponLoadout(suit, loadout){
  const options = weaponLoadoutOptions(suit);
  if (!options.primary.length || !loadout || loadout.primary === 'stock') return { primary: 'stock', support: 'stock' };
  const primary = options.primary.some(item => item.id === loadout.primary) ? loadout.primary : options.primary[0].id;
  const support = loadout.support === 'none' || options.support.some(item => item.id === loadout.support)
    ? (loadout.support || 'none') : 'none';
  return { primary, support: support === primary ? 'none' : support };
}

export function normalizeRestrictedWeaponLoadout(suit, loadout, unlockedIds){
  if (!loadout || loadout.primary === 'stock') return { primary: 'stock', support: 'stock' };
  const unlocked = unlockedIds instanceof Set ? unlockedIds : new Set(unlockedIds || []);
  if (!unlocked.has(loadout.primary)) return { primary: 'stock', support: 'stock' };
  const normalized = normalizeWeaponLoadout(suit, loadout);
  if (normalized.primary !== loadout.primary) return { primary: 'stock', support: 'stock' };
  if (normalized.support !== 'none' && !unlocked.has(normalized.support)) normalized.support = 'none';
  return normalized;
}

export function weaponLoadoutProfile(suit, loadout){
  const normalized = normalizeWeaponLoadout(suit, loadout);
  const stockMass = suit.weapons.reduce((sum, weapon) => sum + estimatedMass(weapon), 0);
  if (normalized.primary === 'stock'){
    return { loadout: normalized, stock: true, mass: stockMass, stockMass, mobility: 1, label: 'STOCK COMPLETE RACK' };
  }
  const primary = BY_ID.get(normalized.primary);
  const support = normalized.support === 'none' ? null : BY_ID.get(normalized.support);
  const mass = primary.mass + (support?.mass || 0);
  const mobility = Math.max(0.78, Math.min(1.12, 1 - (mass - stockMass) * 0.012));
  return {
    loadout: normalized, stock: false, primary, support, mass, stockMass, mobility,
    label: support ? `${primary.name} + ${support.name}` : primary.name,
  };
}

export function applyWeaponLoadout(suit, loadout){
  const profile = weaponLoadoutProfile(suit, loadout);
  if (profile.stock) return suit;
  const fixed = suit.weapons.filter(fixedWeapon);
  const carried = [profile.primary.weapon];
  if (profile.support) carried.push(profile.support.weapon);
  const mobility = profile.mobility;
  return {
    ...suit,
    weapons: [...carried.map(weapon => ({ ...weapon })), ...fixed],
    walk: suit.walk * mobility,
    boost: suit.boost * mobility,
    weaponLoadout: profile.loadout,
    weaponLoadoutLabel: profile.label,
    carriedWeaponMass: profile.mass,
    stockWeaponMass: profile.stockMass,
    mobilityMultiplier: mobility,
  };
}

export function mobilityPercent(profile){
  return Math.round((profile?.mobility ?? 1) * 100);
}

const AIM_PROFILES = Object.freeze({
  precision: Object.freeze({ id: 'precision', label: 'PRECISION SCOPE', coefficient: 0.06, entryCoefficient: 0.38, fov: 18, moveScale: 0.32, sensitivity: 0.00082, settledSensitivity: 0.00046, sway: 0.0065, settledSway: 0.0011, steadyRate: 1.15, breath: true }),
  rifle: Object.freeze({ id: 'rifle', label: 'OPTICAL GUNSIGHT', coefficient: 0.28, entryCoefficient: 0.68, fov: 34, moveScale: 0.46, sensitivity: 0.00135, settledSensitivity: 0.00092, sway: 0.0042, settledSway: 0.0015, steadyRate: 1.55, breath: false }),
  reflex: Object.freeze({ id: 'reflex', label: 'REFLEX LEAD SIGHT', coefficient: 0.48, entryCoefficient: 0.78, fov: 43, moveScale: 0.68, sensitivity: 0.00182, settledSensitivity: 0.00135, sway: 0.0032, settledSway: 0.0017, steadyRate: 2.15, breath: false }),
  scatter: Object.freeze({ id: 'scatter', label: 'CLOSE-COMBAT RING', coefficient: 0.62, entryCoefficient: 0.86, fov: 48, moveScale: 0.76, sensitivity: 0.00205, settledSensitivity: 0.00158, sway: 0.0028, settledSway: 0.0018, steadyRate: 2.5, breath: false }),
  rocket: Object.freeze({ id: 'rocket', label: 'ROCKET RANGEFINDER', coefficient: 0.42, entryCoefficient: 0.74, fov: 39, moveScale: 0.52, sensitivity: 0.00155, settledSensitivity: 0.00108, sway: 0.004, settledSway: 0.00155, steadyRate: 1.65, breath: false }),
  seeker: Object.freeze({ id: 'seeker', label: 'SEEKER TRACKER', coefficient: 0.36, entryCoefficient: 0.66, fov: 38, moveScale: 0.56, sensitivity: 0.0015, settledSensitivity: 0.00102, sway: 0.0036, settledSway: 0.0014, steadyRate: 1.8, breath: false }),
  artillery: Object.freeze({ id: 'artillery', label: 'BALLISTIC FIRE CONTROL', coefficient: 0.34, entryCoefficient: 0.70, fov: 41, moveScale: 0.40, sensitivity: 0.00142, settledSensitivity: 0.00096, sway: 0.0044, settledSway: 0.00145, steadyRate: 1.45, breath: false }),
  bombing: Object.freeze({ id: 'bombing', label: 'BOMBING COMPUTER', coefficient: 0.54, entryCoefficient: 0.82, fov: 50, moveScale: 0.72, sensitivity: 0.0019, settledSensitivity: 0.00142, sway: 0.0026, settledSway: 0.0017, steadyRate: 2.0, breath: false }),
});

const precisionWeapon = weapon =>
  !!weapon && !weapon.arc && weapon.type !== 'bomb' && weapon.type !== 'lockmissile'
    && (!!weapon.scope || (weapon.pref || 0) >= 750
      || /SNIPER|ANTI-SHIP|ANTI-MATERIEL|180MM|MAGELLA TOP|SATELLITE CANNON/.test(String(weapon.name || '').toUpperCase()));

export function weaponAimProfile(weapon){
  if (!weapon) return null;
  const name = String(weapon.name || '').toUpperCase();
  if (weapon.arc) return AIM_PROFILES.artillery;
  if (weapon.type === 'bomb') return AIM_PROFILES.bombing;
  if (weapon.type === 'lockmissile') return AIM_PROFILES.seeker;
  if (precisionWeapon(weapon)) return AIM_PROFILES.precision;
  if (weapon.type === 'bazooka') return /MISSILE/.test(name) ? AIM_PROFILES.seeker : AIM_PROFILES.rocket;
  if (weapon.pellets || /SPRAY|SHOTGUN/.test(name)) return AIM_PROFILES.scatter;
  if (weapon.type === 'mg' || weapon.head || weapon.integrated) return AIM_PROFILES.reflex;
  if (weapon.type === 'beam') return AIM_PROFILES.rifle;
  return null;
}

export function canAimWeapon(weapon){
  return weaponAimProfile(weapon) !== null;
}

export function weaponAimCoefficient(weapon, steady = 1){
  const profile = weaponAimProfile(weapon);
  if (!profile) return 1;
  const t = Math.max(0, Math.min(1, Number.isFinite(steady) ? steady : 0));
  return profile.entryCoefficient + (profile.coefficient - profile.entryCoefficient) * t;
}

export function isSniperWeapon(weapon){
  return weaponAimProfile(weapon)?.id === 'precision';
}
