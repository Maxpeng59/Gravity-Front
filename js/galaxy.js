// ---------- the Frontier Sphere: 150 worlds, observed-only existence ----------
// Dormant worlds are pure statistics (a handful of numbers ticked once per day).
// A world only *exists* — garrison rosters, contracts, recruits, markets,
// terrain — while the player is docked there ("materialized"). On departure
// the detail is dropped and the world collapses back to its statistics.
// Star-map intel is a *snapshot*: you see worlds as they were when last
// observed within your sensor radius, not as they are.
import { RNG, hashStr, clamp } from './util.js';
import {
  SUITS, suitById, SHIP_MODULES, CREW_ROLES, CREW_FIRST, CREW_LAST,
  NAME_A, NAME_B, NAME_C, CANON_WORLDS, TIMELINE, FINAL_DAY,
} from './data.js';

export const WORLD_COUNT = 150;
const BIOMES = ['verdant', 'desert', 'ice', 'regolith', 'crimson'];

// runtime-only materialized detail, never serialized
const details = new Map();

export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const worldById = (S, id) => S.worlds.find(w => w.id === id);
export const activeWorldCount = () => details.size;

export function controlOf(w){
  if (w.neutral && w.fed < 40 && w.zeon < 40) return 'NEUTRAL';
  if (w.fed < 6 && w.zeon < 6) return 'NEUTRAL';
  if (w.fed > w.zeon * 2.4) return 'FED';
  if (w.zeon > w.fed * 2.4) return 'ZEON';
  return 'CONTESTED';
}

// ---------- generation ----------
export function genGalaxy(seed){
  const rng = new RNG('galaxy:' + seed);
  const worlds = [];
  const zeonAnchors = CANON_WORLDS.filter(c => c.zeonHome);

  CANON_WORLDS.forEach((c, i) => {
    worlds.push({
      id: 'c' + i, name: c.name, type: c.type, x: c.x, z: c.z, pop: c.pop,
      econ: 1.4, biome: c.type === 'planet' ? 'verdant' : 'regolith',
      fed: c.fixed.fed, zeon: c.fixed.zeon,
      neutral: c.control === 'NEUTRAL', zeonHome: !!c.zeonHome, finale: !!c.finale,
      canon: true, visited: false, lastSeen: -1, snap: null,
    });
  });

  // U.C. 0079.09: the war has gone badly — most of the frontier is under occupation
  // (rolls high so realized control lands at 70–90% after neutrals and holdouts)
  const zeonGrip = rng.range(0.74, 0.95);

  for (let i = worlds.length; i < WORLD_COUNT; i++){
    const ang = rng.range(0, Math.PI * 2);
    const r = 70 + Math.pow(rng.next(), 0.62) * 480;
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
    const type = rng.pick(['planet', 'planet', 'moon', 'colony', 'colony', 'station', 'asteroid']);
    const garrison = rng.range(14, 60) * (type === 'station' || type === 'asteroid' ? 0.6 : 1);
    const neutral = rng.chance(0.06);
    let fed, zeon;
    if (!neutral && rng.next() < zeonGrip){
      // occupied: a strong Zeon garrison over a crushed Federation presence
      zeon = garrison * rng.range(0.72, 1.0);
      fed = garrison * rng.range(0.04, 0.18);
    } else {
      // the holdouts: influence falls off near Zeon strongholds and the deep frontier
      const zNear = Math.min(...zeonAnchors.map(a => Math.hypot(x - a.x, z - a.z)));
      const zInf = clamp(1 - zNear / 520, 0, 1) * 0.65 + clamp((r - 140) / 520, 0, 1) * 0.35 + rng.range(-0.18, 0.18);
      fed = garrison * clamp(1 - zInf, 0.06, 1);
      zeon = garrison * clamp(zInf, 0.06, 1);
    }
    worlds.push({
      id: 'w' + i,
      name: rng.pick(NAME_A) + rng.pick(NAME_B) + rng.pick(NAME_C),
      type, x, z,
      pop: Math.round(type === 'planet' ? rng.range(40, 900) : type === 'colony' ? rng.range(30, 400) : rng.range(2, 60)),
      econ: rng.range(0.5, 2.0),
      biome: rng.pick(BIOMES),
      fed, zeon,
      neutral, zeonHome: false, finale: false,
      canon: false, visited: false, lastSeen: -1, snap: null,
    });
  }
  return worlds;
}

// ---------- observation ----------
export function intelRadius(S){
  const scout = S.crew.find(c => c.role === 'scout' && c.job === 'SECTOR SCAN');
  return SHIP_MODULES.radar.base + SHIP_MODULES.radar.per * S.modules.radar + (scout ? scout.skill * 35 : 0);
}

export function observe(S){
  const here = worldById(S, S.locId);
  const r = intelRadius(S);
  for (const w of S.worlds){
    if (dist(w, here) <= r || w.id === S.locId){
      w.lastSeen = S.day;
      w.snap = { fed: Math.round(w.fed), zeon: Math.round(w.zeon), control: controlOf(w) };
    }
  }
}

// ---------- daily simulation (every world, statistically) ----------
export function simDay(S){
  S.day++;
  const ev = TIMELINE.find(e => e.day === S.day);
  if (ev && !S.eventsSeen.includes(ev.id)){
    S.eventsSeen.push(ev.id);
    if (ev.fedProd) S.mods.fed += ev.fedProd;
    if (ev.zeonProd) S.mods.zeon += ev.zeonProd;
    if (ev.flag) S.flags[ev.flag] = true;
    if (ev.finale) S.flags.finaleOpen = true;
    news(S, `${ev.title} — ${ev.text}`, 'warn');
  }

  const momentum = S.mods.fed - S.mods.zeon; // war drifts Federation-ward after Odessa
  const rng = new RNG(S.seed + ':d' + S.day);
  const here = worldById(S, S.locId);
  const r = intelRadius(S);

  for (const w of S.worlds){
    const before = controlOf(w);
    // production by controller
    if (before === 'FED') w.fed += 0.05 * w.econ * S.mods.fed;
    else if (before === 'ZEON') w.zeon += 0.05 * w.econ * S.mods.zeon;
    else if (before === 'CONTESTED'){
      // statistical attrition; momentum decides who bleeds faster
      const swing = rng.range(-0.6, 0.6) + momentum * 0.5;
      w.fed = Math.max(2, w.fed + swing - 0.4);
      w.zeon = Math.max(2, w.zeon - swing - 0.4);
    }
    // front-line spread: offensives spill into neighbors
    if (!w.neutral && rng.chance(0.012)){
      if (momentum > 0.15) w.fed += rng.range(2, 9);
      else w.zeon += rng.range(2, 8);
    }
    w.fed = Math.min(w.fed, 400); w.zeon = Math.min(w.zeon, 400);
    const after = controlOf(w);
    if (after !== before && dist(w, here) <= r)
      news(S, `${w.name}: control shifted ${before} → ${after}`, after === 'FED' ? 'good' : 'warn');
  }

  // ---- crew economy ----
  let wages = 0;
  for (const cr of S.crew){
    wages += cr.wage;
    if (cr.role === 'engineer' && cr.job === 'REPAIR SHIP')
      S.hull = Math.min(maxHull(S), S.hull + cr.skill * 4);
    if (cr.role === 'mechanic' && cr.job === 'MAINTAIN MS')
      for (const su of S.suits) su.hp = Math.min(1, su.hp + cr.skill * 0.012);
    if (cr.role === 'quartermaster' && cr.job === 'TRADE RUNS')
      S.credits += cr.skill * 140;
  }
  S.credits -= wages;

  if (S.day === FINAL_DAY && !S.flags.victory && !S.flags.armistice){
    S.flags.armistice = true;
    news(S, 'U.C. 0080.01.01 — ARMISTICE SIGNED AT SIDE 6. The One Year War is over. Frontier operations continue.', 'warn');
  }
  observe(S);
}

export function news(S, text, cls = ''){
  S.news.push({ day: S.day, text, cls });
  if (S.news.length > 120) S.news.shift();
}

export function maxHull(S){
  return SHIP_MODULES.armor.base + SHIP_MODULES.armor.per * S.modules.armor;
}
export function hangarBays(S){
  const m = SHIP_MODULES.hangar;
  return m.levels ? m.levels[S.modules.hangar] : m.base + m.per * S.modules.hangar;
}
// air wing: independent of MS bays — cheap mass-produced fighters, so the bay is
// generous (6 at start, +2 per MS HANGAR level) and duplicates are allowed
export function airCap(S){
  return 6 + S.modules.hangar * 2;
}
export function crewCap(S){
  return SHIP_MODULES.quarters.base + SHIP_MODULES.quarters.per * S.modules.quarters;
}
export function shipSpeed(S){
  let v = SHIP_MODULES.engine.base + SHIP_MODULES.engine.per * S.modules.engine;
  const eng = S.crew.find(c => c.role === 'engineer' && c.job === 'TUNE DRIVE');
  if (eng) v *= 1 + eng.skill * 0.08;
  return v;
}

// ---------- materialization: a world only exists while you are there ----------
const PHASE_POOLS = [
  { until: 300, pool: ['zaku2', 'zaku2', 'zaku2b', 'gouf', 'acguy', 'weasel'] },
  { until: 340, pool: ['zaku2', 'zaku2b', 'gouf', 'goufnh', 'dom', 'acguy', 'weasel', 'weasel'] },
  { until: 9999, pool: ['zaku2', 'zaku2b', 'gouf', 'dom', 'dom', 'gelgoog', 'weasel'] },
];
export const zeonPoolFor = day => PHASE_POOLS.find(p => day < p.until).pool;
const zeonPool = zeonPoolFor;

// epithets for hunt-contract enemy aces
const ACE_NAMES = ['DESERT SERPENT', 'BLUE NOVA', 'NIGHTMARE OF SOLOMON', 'IRON MARIONETTE',
  'WHITE FANG', 'CRIMSON HOWL', 'GRAVE DANCER', 'VOID JACKAL', 'MIDNIGHT FENRIR', 'ASH BARON'];

export function envFor(w, rng){
  if (w.type === 'colony') return rng.chance(0.6) ? 'colony' : 'space';
  if (w.type === 'planet' || w.type === 'moon') return rng.chance(0.7) ? 'ground' : 'space';
  return 'space';
}

export function materialize(S, w){
  if (details.has(w.id)) return details.get(w.id);
  const bucket = Math.floor(S.day / 3);
  const rng = new RNG(`${S.seed}:${w.id}:${bucket}:${Math.round(w.fed)}:${Math.round(w.zeon)}`);
  const ctl = controlOf(w);
  const d = { contracts: [], market: [], recruits: [], terrainSeed: hashStr(S.seed + w.id), desc: describe(w, ctl) };

  // -- contracts --
  const mk = (kind, title, desc, env, enemies, allies, pay, shift, danger, mission) =>
    ({ id: w.id + ':' + kind + ':' + bucket, kind, title, desc, env, enemies, allies,
       pay: Math.round(pay), shift, danger, mission: mission || { type: 'destroy' } });
  const pool = zeonPool(S.day);
  const eN = clamp(2 + Math.floor(w.zeon / 30), 2, 6);
  const enemies = n => Array.from({ length: n }, () => ({ suitId: rng.pick(pool), ace: rng.chance(0.1) }));
  const odessa = S.day >= 312 && S.day <= 330 && ctl === 'CONTESTED' ? 3 : 1;
  const aceSuit = S.day < 335 ? 'zaku2s' : 'gelgoogs';
  const aceHunt = shift => {
    const aceName = rng.pick(ACE_NAMES);
    return mk('HUNT', `ACE HUNT — “${aceName}”`,
      `Intelligence has tracked the enemy ace known as “${aceName}” to this sector. Eliminate the target — the escorts are secondary.`,
      envFor(w, rng), [...enemies(2), { suitId: aceSuit, ace: true, vip: true, name: aceName }], [],
      8800 + (S.day >= 335 ? 1600 : 0), shift, 4, { type: 'hunt' });   // ace work pays: a live ace is a harder kill than any fragile cruiser
  };
  const onLand = w.type === 'planet' || w.type === 'moon';

  // Operation Odessa: a one-time grand land battle on Earth, available after U.C. 0079.09.30
  if (w.id === 'c0' && S.day >= 273 && !S.flags.odessaWon){
    d.contracts.push(mk('ODESSA', 'OPERATION ODESSA — THE GREAT OFFENSIVE',
      'The largest land operation of the war. Two Big Tray landships spearhead the assault on the Zeon mining stronghold — 1,500 Federation troops and massed armor advance with you against the Dabude line. Destroy their landships and every machine they field.',
      'ground',
      [
        ...Array.from({ length: 30 }, () => ({ suitId: 'zaku2' })),
        ...Array.from({ length: 5 }, () => ({ suitId: 'dom' })),
        ...Array.from({ length: 10 }, () => ({ suitId: rng.pick(pool), ace: rng.chance(0.15) })),
        ...Array.from({ length: 20 }, () => ({ suitId: 'magella' })),
        ...Array.from({ length: 4 }, () => ({ suitId: 'weasel' })),
        ...Array.from({ length: 6 }, () => ({ suitId: 'dopp' })),       // Zeon air cover
      ],
      [
        // 30 GMs of mixed variants + 20 Type 61 tanks + Saberfish air support
        ...Array.from({ length: 30 }, () => ({ suitId: rng.chance(0.3) ? 'rgm79sp' : 'gm' })),
        ...Array.from({ length: 20 }, () => ({ suitId: 'type61' })),
        ...Array.from({ length: 4 }, () => ({ suitId: 'saberfish' })),
      ],
      45000, { fed: 70, zeon: -90 }, 5,
      { type: 'odessa', soldiers: { fed: 1500, zeon: 1000 } }));
  }

  // Operation Odessa II: a harder, repeatable counterstrike unlocked after the first victory
  if (w.id === 'c0' && S.flags.odessaWon && (S.flags.odessa2Count || 0) < 5){
    const n = (S.flags.odessa2Count || 0) + 1;
    d.contracts.push(mk('ODESSA2', `ODESSA COUNTERSTRIKE — WAVE ${n} / 5`,
      'Zeon mounts a massed armored counterstrike to retake the Odessa sector, led by two GALLOP heavy hover-battleships whose long-range main batteries hammer the field from across the front. Hold the line behind the Big Trays and shatter the assault.',
      'ground',
      [
        ...Array.from({ length: 20 }, () => ({ suitId: 'zaku2' })),
        ...Array.from({ length: 10 }, () => ({ suitId: 'dom' })),
        ...Array.from({ length: 8 }, () => ({ suitId: 'gouf' })),
        ...Array.from({ length: 12 }, () => ({ suitId: rng.pick(pool), ace: rng.chance(0.2) })),
        ...Array.from({ length: 10 }, () => ({ suitId: 'magella' })),
        ...Array.from({ length: 6 }, () => ({ suitId: rng.chance(0.5) ? 'gattle' : 'dopp' })), // Zeon air wing
      ],
      [
        // 50 GMs of mixed variants (with heavy Guncannon support) + 20 Type 61 tanks
        ...Array.from({ length: 35 }, () => ({ suitId: 'gm' })),
        ...Array.from({ length: 10 }, () => ({ suitId: 'rgm79sp' })),
        ...Array.from({ length: 5 }, () => ({ suitId: 'guncannon' })),
        ...Array.from({ length: 20 }, () => ({ suitId: 'type61' })),
      ],
      36000, { fed: 12, zeon: -18 }, 5,
      { type: 'odessa', zeonShip: 'gallop', soldiers: { fed: 1200, zeon: 1200 },
        winMsg: 'ZEON COUNTERSTRIKE BROKEN — THE ODESSA SECTOR HOLDS' }));
  }

  // Operation Solomon: the decisive two-phase battle, unlocked at the fortress after Odessa
  if (w.id === 'c6' && S.flags.odessaWon && !S.flags.solomonWon){
    const zf = 20 + Math.round(10 * S.mods.zeon);    // Zeon fighter screen scales with their production
    const ff = 10 + Math.round(10 * S.mods.fed);     // Federation fighter wing scales with theirs
    const p1enemies = [
      { suitId: 'zaku2s', ace: true, vip: true, name: 'THE RED COMET' },
      { suitId: 'gelgoogs', ace: true, name: 'CYCLOPS LEADER' },
      { suitId: 'gelgoogs', ace: true, name: 'NIGHTMARE OF SOLOMON' },
      ...Array.from({ length: 30 }, () => ({ suitId: 'gelgoog' })),
      ...Array.from({ length: 30 }, () => ({ suitId: 'zaku2' })),
      ...Array.from({ length: 15 }, () => ({ suitId: 'dom' })),
      ...Array.from({ length: 12 }, () => ({ suitId: rng.pick(pool), ace: rng.chance(0.1) })),
    ];
    const p1allies = [
      ...Array.from({ length: 30 }, () => ({ suitId: rng.chance(0.4) ? 'rgm79sp' : 'gm' })),
      ...Array.from({ length: 20 }, () => ({ suitId: 'guncannon' })),
      ...Array.from({ length: 20 }, () => ({ suitId: rng.chance(0.5) ? 'gmspartan' : 'gm' })),
    ];
    d.contracts.push(mk('SOLOMON', 'OPERATION SOLOMON — THE FINAL HAMMER',
      `The decisive blow. Phase one: smash the Zeon fleet screening the fortress — a 30-ship battle line of 8 Magellan battleships, 18 Salamis cruisers and 4 Columbus carriers at your back, against 15 Musai, 4 Chivvay cruisers, ${zf} fighters and the Red Comet himself. Phase two: storm Solomon and break its garrison. End it here.`,
      'space', p1enemies, p1allies, 80000, { fed: 50, zeon: -100 }, 5,
      { type: 'fleet', allyShips: { magellan: 8, salamis: 18, columbus: 4 }, enemyShips: { musai: 15, chivvay: 4 },
        fighters: { fed: ff, zeon: zf }, fleetLoseFrac: 0.34, // lose if the battle line is smashed to <1/3
        winMsg: 'THE ZEON FLEET IS SHATTERED — DROP ON SOLOMON' }));
  }

  // planetary air raid: a GAW carrier sweeps the sector behind a ten-fighter screen — flown SOLO, big purse
  if (w.type === 'planet' && w.zeon > 15){
    d.contracts.push(mk('AIRRAID', 'AIR SUPERIORITY — DOWN THE GAW',
      'A Zeon GAW attack carrier is prowling the lowlands behind a ten-fighter screen. Every friendly unit is committed elsewhere — you fly this one ALONE. Shoot down the screen, sink the carrier, and mop up everything it drops. Command pays a premium for lone-wolf work.',
      'ground',
      [...Array.from({ length: 5 }, () => ({ suitId: 'dopp' })),
       ...Array.from({ length: 5 }, () => ({ suitId: 'gattle' })),
       { suitId: 'gaw', name: 'GAW CARRIER' }],
      [], 21000, { fed: 8, zeon: -14 }, 4, { aircraftCore: true, solo: true }));
  }

  if (w.finale && S.flags.finaleOpen){
    d.contracts.push(mk('FINALE', 'OPERATION STARDUST DAWN — FINAL ASSAULT',
      'Break the A Baoa Qu defense line. Destroy the fortress garrison and its commander to end the One Year War.',
      'space',
      [...enemies(4), { suitId: 'gelgoogs', ace: true, name: 'FORTRESS COMMANDER' }],
      ['gm', 'gm', 'guncannon'], 60000, { fed: 40, zeon: -120 }, 5));
  } else if (ctl === 'FED'){
    d.contracts.push(mk('DEFEND', 'BASE DEFENSE — REPEL THE RAID',
      'Zeon raiders are converging on the garrison base in attack waves. Keep its structures standing and wipe the raiders out.',
      envFor(w, rng), enemies(Math.min(eN + 1, 6)), w.fed > 60 ? ['gm'] : [],
      2600 + eN * 800, { fed: 4, zeon: -8 }, 2, { type: 'defend' }));
    d.contracts.push(mk('PATROL', 'SECTOR SWEEP',
      'Recon flights report a Zeon scout lance operating nearby. Hunt it down.',
      'space', enemies(2), [], 1800, { zeon: -5 }, 1));
    if (rng.chance(0.6)) d.contracts.push(mk('SKIRMISH', 'FORWARD PICKET — FIRST CONTACT',
      'A Zeon probe-in-force is testing the picket line. Meet them at the wire and turn them back — a clean, contained engagement.',
      envFor(w, rng), enemies(Math.min(eN, 3)), [],
      1900 + Math.min(eN, 3) * 250, { fed: 2, zeon: -4 }, 1)); // pay tracks the ACTUAL capped force
    if (w.type === 'planet' && rng.chance(0.55)) d.contracts.push(mk('AIRCOVER', 'AIR DEFENSE — CLEAR THE SKIES',
      'Zeon Dopp and Gattle squadrons are working over our supply routes from a lowland airstrip. Take the sky back — every hostile airframe splashes or the route stays closed.',
      'ground',
      [...Array.from({ length: 4 }, () => ({ suitId: 'dopp' })),
       ...Array.from({ length: 3 }, () => ({ suitId: 'gattle' }))],
      ['saberfish', 'saberfish'],
      4400, { fed: 5, zeon: -8 }, 2, { aircraftCore: true }));
    if (rng.chance(0.6)) d.contracts.push(mk('ESCORT', 'SUPPLY CONVOY ESCORT',
      'A relief convoy must cross open terrain to the forward beacon. Ride shotgun and get the transports through alive.',
      envFor(w, rng), enemies(Math.min(eN, 4)), [],
      3000 + eN * 700, { fed: 5, zeon: -6 }, 2, { type: 'escort' }));
    if (rng.chance(0.1)) d.contracts.push(mk('ARMADA', 'FLEET DEFENSE — SHIELD THE SALAMIS',
      'The EFSF cruiser Salamis is holding station with her engines down for emergency repairs. Three full Zeon attack waves are inbound — keep her alive until the last one breaks.',
      'space', enemies(7), ['gm', 'gm', 'guncannon', 'gm', 'guncannon', 'gm'],
      18500, { fed: 14, zeon: -20 }, 5,  // pay balanced up: 31 hostiles across three waves
      { type: 'shipdefend', ship: 'salamis', waves: [enemies(10), enemies(14)] }));
  } else if (ctl === 'CONTESTED'){
    d.contracts.push(mk('ASSAULT', 'FRONTLINE ASSAULT' + (odessa > 1 ? ' · OPERATION ODESSA (3× PAY)' : ''),
      'Joint push against the Zeon line. Allied units sortie with you — break the garrison and level their forward base.',
      envFor(w, rng), enemies(eN), ['gm', 'gm'],
      (3200 + eN * 1000) * odessa, { fed: 10, zeon: -16 }, Math.min(2 + Math.floor(eN / 2), 5), { type: 'assault' })); // danger tracks force size, capped at 5
    d.contracts.push(mk('HOLD', 'COUNTERATTACK — HOLD THE LINE',
      'Zeon is pushing back hard. Hold your ground against successive assault waves until the relief force arrives.',
      envFor(w, rng), enemies(Math.min(eN, 4)), ['gm'],
      (2600 + eN * 800) * odessa, { fed: 6, zeon: -10 }, 2 + Math.floor(eN / 2),
      { type: 'survive', time: 90 + eN * 12 }));
    if (rng.chance(0.55)) d.contracts.push(aceHunt({ fed: 3, zeon: -8 }));
    if (onLand && rng.chance(0.6)) d.contracts.push(mk('ARMOR', 'TANK COLUMN INTERCEPT',
      'A Zeon armored column — Magella Attacks and fast Weasel APCs screened by Zaku Tanks and ground-type Zakus — is rolling on the forward depots. Meet it in the open with our own armor and break it before it reaches the wire.',
      'ground',
      [...Array.from({ length: 8 }, () => ({ suitId: 'magella' })),
       ...Array.from({ length: 3 }, () => ({ suitId: 'weasel' })),
       ...Array.from({ length: 2 }, () => ({ suitId: 'zakutank' })),
       ...Array.from({ length: 2 }, () => ({ suitId: 'zaku2g' }))],
      ['type61', 'type61', 'guntankmk1'],
      4300, { fed: 6, zeon: -9 }, 3, { type: 'destroy' })); // Zaku Tank AP cannons hit hard — honest label
    if (rng.chance(0.5)) d.contracts.push(mk('MEDEVAC', 'MEDEVAC COLUMN — BRING THEM HOME',
      'Ambulance transports loaded with wounded are crossing the contested zone to the field hospital. Zeon hunters are already vectoring in. Every truck that arrives is a crew that fights again.',
      envFor(w, rng), enemies(Math.min(eN, 4)), [],
      3400 + eN * 650, { fed: 7, zeon: -5 }, 2, { type: 'escort' }));
    if (rng.chance(0.5)) d.contracts.push(mk('WOLFPACK', 'WOLF-PACK SWEEP — BREAK THE HUNTERS',
      'A veteran Zeon hunter-killer lance — two confirmed aces flying lead — is picking off patrols in this sector. Take a wing out and kill the pack before it kills again.',
      'space',
      [...enemies(5), { suitId: rng.pick(pool), ace: true }, { suitId: aceSuit, ace: true }],
      ['gm', 'gm'],
      9800 + (S.day >= 335 ? 1200 : 0), { fed: 8, zeon: -12 }, 4, { type: 'destroy' })); // full-clear of 7 incl 2 aces > a vip snipe
    if (w.type === 'planet' && S.day >= 300 && rng.chance(0.3)) d.contracts.push(mk('REDWOLVES', 'RED WOLVES — DUEL THE SQUADRON',
      'Captain Iria Solari\'s Red Wolf Squadron — the pack that has been gutting the European front — is operating from a forward camp in this sector. Kill the captain and the Red Wolves die with her. Her escorts are secondary.',
      'ground',
      [
        { suitId: aceSuit, ace: true, vip: true, name: 'CAPT. IRIA SOLARI' },   // her machine upgrades late-war, like every hunt vip
        { suitId: 'zaku2g', ace: true, name: 'RED WOLF TWO' },
        { suitId: 'zaku2g', ace: true, name: 'RED WOLF THREE' },
        { suitId: 'zaku2g', ace: true, name: 'RED WOLF FOUR' },
        { suitId: 'goufnh', ace: true, name: 'RED WOLF FIVE' },
        { suitId: 'goufnh', ace: true, name: 'RED WOLF SIX' },
      ], [],
      14000, { fed: 14, zeon: -22 }, 5, { type: 'hunt' })); // six aces on the field — top ace-hunt purse even if the vip falls early
    const chivvay = rng.chance(0.4);
    d.contracts.push(mk('FLEET', `FLEET STRIKE — SINK THE ${chivvay ? 'CHIVVAY' : 'MUSAI'}`,
      `A Zeon ${chivvay ? 'Chivvay-class heavy cruiser' : 'Musai-class light cruiser'} is anchoring the enemy line from high orbit. Cut through the escort screen and put her guns to silence for good.`,
      'space', enemies(chivvay ? 8 : 6), chivvay ? ['gm', 'gm', 'guncannon', 'gm'] : ['gm', 'gm', 'guncannon'],
      (chivvay ? 8400 : 6400) * odessa, { fed: 12, zeon: -22 }, chivvay ? 4 : 3, // hulls are fragile — the escort screen is the actual fight
      { type: 'shipkill', ship: chivvay ? 'chivvay' : 'musai' }));
  } else if (ctl === 'ZEON'){
    d.contracts.push(mk('RAID', 'DEEP RAID — GARRISON STRIKE',
      'Covert insertion into Zeon-held territory. Hit the garrison and withdraw before reinforcements arrive.',
      envFor(w, rng), enemies(eN), [],
      4200 + eN * 1100, { fed: 5, zeon: -14 }, Math.min(2 + Math.floor(eN / 2), 5))); // danger tracks force size, capped at 5
    if (rng.chance(0.7)) d.contracts.push(mk('AMBUSH', 'CONVOY AMBUSH — CUT THE SUPPLY LINE',
      'A Zeon supply column is crossing the sector under escort. Destroy every transport before they reach the garrison perimeter.',
      envFor(w, rng), enemies(Math.min(eN, 4)), [],
      3800 + eN * 900, { zeon: -12 }, 3, { type: 'ambush', transports: 3 }));
    if (rng.chance(0.4)) d.contracts.push(aceHunt({ zeon: -6 }));
    // deep-strike work: at most a couple of these stack per visit (chances tuned so a Zeon board
    // carries 3-4 cards like the other control states, not a wall of contracts)
    if (rng.chance(0.45)) d.contracts.push(mk('DEPOT', 'MUNITIONS DUMP DEMOLITION',
      'Deep-penetration strike on a Zeon rear-area supply complex. Level the command post and both storage silos, then fight your way home through whatever the garrison scrambles. No support this far in.',
      envFor(w, rng), enemies(eN), [],
      5400 + eN * 1100, { fed: 6, zeon: -13 }, Math.min(2 + Math.floor(eN / 2), 5), { type: 'assault' })); // harder than RAID: same force + structures
    if (rng.chance(0.35)) d.contracts.push(mk('PICKET', 'BLOCKADE RUNNER — SILENCE THE PICKET',
      'A lone Musai picket controls the only clean transit lane out of this sector, and a task group this size would be seen coming a system away. One machine slips through. Yours. Sink her and open the lane — lone-wolf premium applies.',
      'space', enemies(4), [],
      8800, { fed: 6, zeon: -12 }, 4, { type: 'shipkill', ship: 'musai', solo: true })); // the pay is for going in ALONE — the Musai itself is the easy part
    if (rng.chance(0.35)) d.contracts.push(mk('SIEGE', 'SIEGE BREAKER — CRACK THE FORTIFIED LINE',
      'Zeon has fortified a strongpoint behind hardened structures and a heavy garrison, Gouf shock troops holding the line. A Guntank siege battery deploys with you: keep the artillery alive, grind the line open, and leave nothing standing.',
      onLand ? 'ground' : 'colony',
      [...enemies(Math.min(eN + 2, 8)), { suitId: 'gouf' }, { suitId: 'gouf' }],
      ['guntankmk1', 'guntankmk2', 'gm'],
      7400 + eN * 1100, { fed: 12, zeon: -18 }, Math.min(3 + Math.floor(eN / 2), 5), { type: 'assault' })); // pay & danger scale with the garrison
    if (onLand && rng.chance(0.5)){
      const gallop = w.zeon > 55;
      d.contracts.push(mk('LANDSHIP', `LANDSHIP HUNT — SINK THE ${gallop ? 'GALLOP' : 'DABUDE'}`,
        gallop
          ? 'A Gallop-class heavy hover-battleship is shelling Federation positions from behind the horizon, screened by an armored escort. Take a tank section in, get under her long guns, and burn her down.'
          : 'A Dabude-class land battleship anchors the Zeon line in this sector — a rolling fortress with its own escort. Take a tank section in and put her on the ground for good.',
        'ground',
        [...enemies(Math.min(eN + 1, 6)),
         ...Array.from({ length: 4 }, () => ({ suitId: 'magella' }))],
        ['type61', 'type61'],
        gallop ? 14500 : 11500, { fed: 10, zeon: -20 }, gallop ? 5 : 4,
        { customShips: [{ kind: gallop ? 'gallop' : 'dabude', team: 'ZEON' }] }));
    }
    if ((w.type === 'planet' || w.type === 'moon') && rng.chance(0.6))
      d.contracts.push(mk('INVASION', 'OPERATION DOWNFALL — PLANETARY INVASION',
        'Full-scale liberation in two phases. Phase one: break the orbital blockade — sink the Musai picket with the Salamis at your side. Phase two: drop to the surface with Type 61 armor support and crush the occupation garrison.',
        'space', enemies(7), ['gm', 'gm', 'guncannon', 'gm', 'guncannon'].slice(0, rng.int(4, 5)),
        22000, { fed: 30, zeon: -45 }, 5, { type: 'invasion' }));
  } else {
    d.contracts.push(mk('PIRATES', 'PIRATE SUPPRESSION',
      'Deserters in stolen mobile suits are shaking down freighters. The local administrator pays well.',
      'space', [{ suitId: 'zaku2' }, { suitId: 'acguy' }], [],
      2400, {}, 1));
    if (rng.chance(0.5)) d.contracts.push(mk('ESCORT', 'MERCHANT CONVOY ESCORT',
      'Neutral haulers want a gun riding alongside through pirate space. Get the transports to the far beacon intact.',
      'space', [{ suitId: 'zaku2' }, { suitId: 'zaku2' }, { suitId: 'acguy' }], [],
      3200, {}, 2, { type: 'escort' }));
  }

  // -- market --
  if (ctl === 'FED' || ctl === 'NEUTRAL'){
    const markup = ctl === 'NEUTRAL' ? 1.35 : 1;
    for (const s of SUITS){
      if (s.cost <= 0) continue;
      const sellable = ctl === 'NEUTRAL' ? true : s.faction === 'FED';
      // the GM Spartan stocks twice as often as other frames
      const stockChance = (s.id === 'gmspartan' || s.id === 'rgm79sp') ? Math.min(1, 0.55 * 2) : 0.55;
      if (sellable && rng.chance(stockChance)) d.market.push({ suitId: s.id, price: Math.round(s.cost * markup) });
    }
  }

  // -- recruits --
  if (ctl !== 'ZEON'){
    const n = rng.int(1, 3);
    const roles = Object.keys(CREW_ROLES);
    for (let i = 0; i < n; i++){
      const role = rng.pick(roles), skill = rng.int(1, 5);
      d.recruits.push({
        name: rng.pick(CREW_FIRST) + ' ' + rng.pick(CREW_LAST),
        role, skill, wage: 60 + skill * 45, fee: 200 + skill * 260,
        job: CREW_ROLES[role].jobs[0],
      });
    }
  }

  details.set(w.id, d);
  return d;
}

export function dematerialize(w){ details.delete(w.id); }
export function clearDetails(){ details.clear(); }

function describe(w, ctl){
  const t = { planet: 'terrestrial world', moon: 'cratered moon', colony: 'O’Neill cylinder cluster', station: 'orbital station', asteroid: 'hollowed asteroid base', fortress: 'space fortress' }[w.type] || 'outpost';
  const c = { FED: 'under Federation control', ZEON: 'occupied by the Principality of Zeon', CONTESTED: 'an active war front', NEUTRAL: 'neutral territory' }[ctl];
  return `A ${t} of ${w.pop.toLocaleString()}k souls, currently ${c}. Biome: ${w.biome}.`;
}

// ---------- battle outcome → world state ----------
// how much harder each world type is to take: a victory's control swing is divided
// by this, so a planet needs ~3x the victories to conquer, a colony/station ~2x, etc.
const CONQUEST_RESIST = { planet: 3, moon: 3, colony: 2, station: 2, asteroid: 1.5 };

export function applyOutcome(S, w, contract, res){
  if (res.victory){
    S.credits += contract.pay + res.kills * 120;
    S.renown += contract.danger;
    S.kills += res.kills;
    if (contract.shift){
      const resist = CONQUEST_RESIST[w.type] || 1;
      w.fed = Math.max(2, w.fed + (contract.shift.fed || 0) / resist);
      w.zeon = Math.max(2, w.zeon + (contract.shift.zeon || 0) / resist);
    }
    news(S, `${contract.title} at ${w.name}: VICTORY. ${res.kills} enemy units destroyed. +${(contract.pay + res.kills * 120).toLocaleString()} cr`, 'good');
    dematerialize(w); // contracts/garrison regenerate from the new statistics
    if (contract.kind === 'FINALE'){ S.flags.victory = true; }
    if (contract.kind === 'ODESSA'){
      S.flags.odessaWon = true;
      news(S, 'Operation Odessa succeeds — Zeon ground forces begin a general retreat from Earth.', 'good');
    }
    if (contract.kind === 'ODESSA2'){
      S.flags.odessa2Count = (S.flags.odessa2Count || 0) + 1;
      const left = 5 - S.flags.odessa2Count;
      news(S, left > 0
        ? `Zeon counterstrike wave ${S.flags.odessa2Count} repelled at Odessa. ${left} more ${left === 1 ? 'assault is' : 'assaults are'} massing.`
        : 'The final Zeon counterstrike at Odessa is shattered. The sector is secured for good.', 'good');
    }
    if (contract.kind === 'SOLOMON'){
      S.flags.solomonWon = true; S.renown += 20;
      news(S, 'SOLOMON HAS FALLEN. The fortress is broken and the Zeon space fleet is in ruins — the road to A Baoa Qu is open.', 'good');
    }
  } else if (res.retreat){
    news(S, `${contract.title} at ${w.name}: WITHDREW from combat.`, 'warn');
  } else {
    news(S, `${contract.title} at ${w.name}: SORTIE FAILED. Suit recovered by salvage crew.`, 'warn');
    S.credits -= 1500; // recovery fee
  }
  observe(S);
}

// salvage roll after a victory: chance to capture an intact enemy frame
// post-victory salvage sweep: a bigger victory leaves a bigger field of wrecks to pick over.
// One recovery attempt per battle plus one per 10 confirmed kills (max 6), each at 35% — PLUS a
// guaranteed floor so a massive field always yields a haul: 10+ kills ≥1, 20+ ≥2, 30+ kills ≥3
// recoveries. Every recovery pulls a DIFFERENT wreck. Returns { captured:[names], scrapped:[names], cr }.
export function rollSalvage(S, enemySuitIds, rng){
  const n = enemySuitIds.length;
  if (!n) return null;
  const pool = enemySuitIds.slice();
  const attempts = Math.min(1 + Math.floor(n / 10), 6);
  let wins = 0;
  for (let a = 0; a < attempts; a++) if (rng.chance(0.35)) wins++;
  wins = Math.min(Math.max(wins, Math.min(Math.floor(n / 10), 3)), pool.length);
  const captured = [], scrapped = [];
  let cr = 0;
  const scrap = def => { const c = Math.round(def.cost * 0.25); S.credits += c; cr += c; scrapped.push(def.name); };
  for (let k = 0; k < wins; k++){
    const def = suitById(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
    if (def.air){
      // downed AIRCRAFT never enter the MS hangar: recovered airframes join the air wing if a slot
      // is free — yes, even a captured GAW carrier flies for you now — else they're scrapped
      if ((S.air || (S.air = [])).length < airCap(S)) S.air.push({ id: def.id, hp: 0.3 });
      else { scrap(def); continue; }
    } else if (S.suits.length < hangarBays(S)){
      S.suits.push({ id: def.id, hp: 0.3 });
    } else { scrap(def); continue; }
    captured.push(def.name);
  }
  return (captured.length || scrapped.length) ? { captured, scrapped, cr } : null;
}
