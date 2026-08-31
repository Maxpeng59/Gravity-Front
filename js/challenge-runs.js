import { WEAPON_CATALOG } from './loadouts.js';

export const PVP_PROGRESS_KEY = 'gravityFront.pvp.progression.v1';

const run = (id, title, enemyCount, description, enemySuitIds, aceEvery, unlocks) => Object.freeze({
  id, title, enemyCount, description, enemySuitIds: Object.freeze(enemySuitIds), aceEvery,
  unlocks: Object.freeze(unlocks), env: 'ground', mapId: 'clearcity', solo: true,
});

// These are deliberately severe solo examinations rather than ordinary campaign
// contracts. Each clear opens another tier of field equipment for online PvP.
export const CHALLENGE_RUNS = Object.freeze([
  run('trial_01', 'TRIAL 01 · THE HUNTER', 1,
    'Defeat a Gelgoog Commander ace in a clean one-on-one engagement.',
    ['gelgoogs'], 1,
    ['fed_beam_spray', 'zeon_120mm']),
  run('trial_05', 'TRIAL 05 · ENCIRCLEMENT', 5,
    'Five veteran close-combat machines attack together from the city grid.',
    ['goufnh', 'dom', 'zaku2s', 'gouf', 'gelgoog'], 2,
    ['fed_90mm', 'zeon_mmp80', 'zeon_cracker']),
  run('trial_10', 'TRIAL 10 · BREAKPOINT', 10,
    'Survive a mixed mobile-suit section without a wingman or resupply team.',
    ['zaku2g', 'goufnh', 'dom', 'zaku2s', 'gelgoog'], 4,
    ['fed_100mm', 'fed_missile', 'zeon_zaku_bazooka']),
  run('trial_20', 'TRIAL 20 · IRON CROSSFIRE', 20,
    'Break twenty coordinated attackers carrying machine guns, missiles and bazookas.',
    ['zaku2', 'zaku2g', 'gouf', 'dom', 'gelgoog', 'goufnh'], 5,
    ['fed_beam_rifle', 'fed_hyper_bazooka', 'zeon_giant_bazooka', 'zeon_missile']),
  run('trial_35', 'TRIAL 35 · CITY OF ASH', 35,
    'A reinforced urban battalion hunts one pilot through every avenue and block.',
    ['zaku2g', 'goufnh', 'dom', 'gelgoog', 'zaku2s', 'gelgoogs'], 5,
    ['fed_180mm', 'zeon_magella_cannon', 'zeon_gelgoog_beam']),
  run('trial_50', 'TRIAL 50 · LAST PILOT STANDING', 50,
    'Fifty hostile machines. No teammates. No extraction until the city is silent.',
    ['zaku2g', 'goufnh', 'dom', 'gelgoog', 'zaku2s', 'gelgoogs'], 4,
    ['fed_sniper', 'zeon_anti_ship']),
]);

const RUN_BY_ID = new Map(CHALLENGE_RUNS.map(item => [item.id, item]));
const WEAPON_BY_ID = new Map(WEAPON_CATALOG.map(item => [item.id, item]));
const VALID_EQUIPMENT = new Set(WEAPON_CATALOG.map(item => item.id));

export function buildChallengeEnemies(challenge){
  if (!challenge || !Number.isInteger(challenge.enemyCount) || challenge.enemyCount < 1) return [];
  return Array.from({ length: challenge.enemyCount }, (_, index) => {
    const suitId = challenge.enemySuitIds[index % challenge.enemySuitIds.length];
    const ace = challenge.aceEvery > 0 && (index + 1) % challenge.aceEvery === 0;
    return {
      suitId,
      ace,
      name: ace ? `CHALLENGE ACE ${String(index + 1).padStart(2, '0')}` : `HOSTILE ${String(index + 1).padStart(2, '0')}`,
    };
  });
}

export function normalizePvpProgress(value){
  const source = value && typeof value === 'object' ? value : {};
  const cleared = [...new Set((Array.isArray(source.cleared) ? source.cleared : []).filter(id => RUN_BY_ID.has(id)))];
  const unlocked = new Set((Array.isArray(source.unlocked) ? source.unlocked : []).filter(id => VALID_EQUIPMENT.has(id)));
  // A recorded clear is authoritative, so a partially-written/older record can
  // always reconstruct every reward it earned.
  for (const id of cleared) for (const equipmentId of RUN_BY_ID.get(id).unlocks) unlocked.add(equipmentId);
  return { v: 1, cleared, unlocked: [...unlocked] };
}

function storageOrNull(storage){
  if (storage) return storage;
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export function readPvpProgress(storage = null){
  const target = storageOrNull(storage);
  if (!target) return normalizePvpProgress(null);
  try { return normalizePvpProgress(JSON.parse(target.getItem(PVP_PROGRESS_KEY) || 'null')); }
  catch { return normalizePvpProgress(null); }
}

export function completeChallenge(challengeId, storage = null){
  const challenge = RUN_BY_ID.get(challengeId);
  if (!challenge) throw new Error('Unknown challenge run.');
  const target = storageOrNull(storage);
  const before = readPvpProgress(target);
  const beforeSet = new Set(before.unlocked);
  const progress = normalizePvpProgress({
    cleared: [...before.cleared, challenge.id],
    unlocked: [...before.unlocked, ...challenge.unlocks],
  });
  if (target) {
    try { target.setItem(PVP_PROGRESS_KEY, JSON.stringify(progress)); } catch {}
  }
  return { progress, newUnlocks: challenge.unlocks.filter(id => !beforeSet.has(id)) };
}

export function challengeForEquipment(equipmentId){
  return CHALLENGE_RUNS.find(challenge => challenge.unlocks.includes(equipmentId)) || null;
}

export function equipmentNames(ids){
  return ids.map(id => WEAPON_BY_ID.get(id)?.name || id);
}
