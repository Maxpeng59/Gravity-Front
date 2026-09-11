// ---------------------------------------------------------------------------
// NAMED BATTLE MAPS — authored battlefields, including locations inspired by
// "Mobile Suit Gundam: Requiem for Vengeance" (2024), European front, U.C. 0079.
//
// A map defines the ARENA a custom sortie is fought on: a biome palette, a
// parametric terrain shape, atmospheric fog + light, and an authored layout of
// STRUCTURES (kind, x, z, rotY, scale, variant and optional dimensions). battle.js reads MAPS when
// opts.mapId is set: it paints the terrain, drapes the fog/light, then builds
// each structure — military kinds (wall/gate/guntower/hangar/…) become
// destructible props (batteries retain their authored faction), landmark kinds
// (churchtower/townhouse) become indestructible solid cover. Rubble, tree trunks,
// rocks and river embankments also carry matching colliders; only flat roads,
// landing pads and river water remain traversable ground dressing.
//
// Coordinates: X = east/west, Z = NORTH (forward, +Z), Y = up; 1 unit ≈ 1 m,
// a Gundam ~18 m. Player deploys at origin facing +Z; hostiles enter from +Z.
// So a base you DEFEND sits near origin / −Z; a town you ASSAULT sits at +Z.
// ---------------------------------------------------------------------------

export const MAPS = [
  {
    id: 'cluj',
    name: 'CLUJ-NAPOCA',
    subtitle: 'The white demon in the pre-dawn fog — a Zeon base that changes hands overnight.',
    faction: 'ZEON',
    // deep pre-dawn: churned brown mud lows, wet forest-grey highs, night-blue sky, pale valley smoke
    biome: { lo: 0x433b2c, hi: 0x4e5647, sky: 0x242c3a, fog: 0x9a968b, airless: false },
    fog: { near: 230, far: 1500 },                 // heavy valley fog + battle smoke
    light: { sun: 0xb7a488, intensity: 0.9, ambient: 0.5 }, // dim, cold amber sun barely over the ridge
    terrain: { style: 'valley', rollingAmp: 60, ridgeAmp: 74, flattenRadius: 340 },
    mission: { type: 'defend', playerFaction: 'ZEON', enemyFaction: 'FED',
      summary: 'CLUJ-NAPOCA · Hold the Someșul Mic base at pre-dawn — the Federation raids down out of the Hoia forest across the river bridges.' },
    structures: [
      { kind: 'churchtower', x: -150, z: -70, rotY: 0, scale: 1.0, variant: 'spire' }, // St. Michael's — the 80 m navigation spire
      { kind: 'churchtower', x: 180, z: -150, rotY: 0.5, scale: 0.62, variant: 'dome' }, // Orthodox cathedral dome
      { kind: 'townhouse', x: -245, z: -55, rotY: 0.4, scale: 1.0 },
      { kind: 'townhouse', x: -125, z: -160, rotY: 1.3, scale: 1.0 },
      { kind: 'rubble', x: -135, z: 25, rotY: 0.2, scale: 1.2 },     // Unirii plaza rubble
      { kind: 'commandpost', x: 100, z: -140, rotY: 0, scale: 1.0 }, // Zeon 1st Terrestrial Div HQ — the deep objective
      { kind: 'hangar', x: -240, z: 55, rotY: 0, scale: 1.0 },
      { kind: 'hangar', x: 240, z: 35, rotY: 0, scale: 1.0 },
      { kind: 'fueltank', x: 155, z: -70, rotY: 0, scale: 1.0 },
      { kind: 'depot', x: -170, z: -110, rotY: 0.3, scale: 1.0 },
      { kind: 'radar', x: 40, z: -195, rotY: 0, scale: 1.0 },
      { kind: 'gate', x: 0, z: 185, rotY: 0, scale: 1.0 },           // north rampart sortie gate
      { kind: 'wall', x: -95, z: 185, rotY: 0, scale: 1.0 },
      { kind: 'guntower', x: -225, z: 195, rotY: 0, scale: 1.0 },
      { kind: 'guntower', x: 225, z: 195, rotY: 0, scale: 1.0 },
      { kind: 'battery', team: 'ZEON', x: -145, z: 150, rotY: 0, scale: 1.0 },
      { kind: 'battery', team: 'ZEON', x: 145, z: 150, rotY: 0, scale: 1.0 },
      { kind: 'river', x: -160, z: 310, rotY: 0, scale: 1.8 },       // Someșul Mic, west reach
      { kind: 'river', x: 160, z: 310, rotY: 0, scale: 1.8 },        // east reach — open center forces the bridges
      { kind: 'road', x: -160, z: 310, rotY: 0, scale: 1.0 },        // west stone bridge (crosses the E-W river N-S)
      { kind: 'road', x: 160, z: 310, rotY: 0, scale: 1.0 },         // east stone bridge
      { kind: 'bunker', x: 0, z: 470, rotY: 0, scale: 1.15 },        // Cetățuia citadel star-fort strongpoint
      { kind: 'wall', x: -85, z: 445, rotY: 0.5, scale: 1.1 },
      { kind: 'wall', x: 85, z: 445, rotY: -0.5, scale: 1.1 },
      { kind: 'treecluster', x: -420, z: 620, rotY: 0, scale: 1.4 }, // Hoia forest — enemy's left approach
      { kind: 'treecluster', x: 400, z: 610, rotY: 0, scale: 1.4 },  // eastern wooded ridge
    ],
  },

  {
    id: 'medias',
    name: 'MEDIAȘ',
    subtitle: 'The leaning tower keeps its vigil over the fog-drowned Târnava valley.',
    faction: 'ZEON',
    // damp leaden Saxon town: wet dark cobble lows, warm ochre/terracotta highs, pale grey sky, warm milky fog
    biome: { lo: 0x4e463a, hi: 0xa9764b, sky: 0xa6a290, fog: 0xcabfa6, airless: false },
    fog: { near: 300, far: 1700 },
    light: { sun: 0xcdcabb, intensity: 0.6, ambient: 0.72 }, // weak diffuse overcast
    terrain: { style: 'valley', rollingAmp: 38, ridgeAmp: 55, flattenRadius: 420 },
    mission: { type: 'assault', playerFaction: 'FED', enemyFaction: 'ZEON',
      summary: 'MEDIAȘ · Storm the fog-drowned Saxon town — breach the curtain wall, grind up the market-square kill-zone, take the leaning tower.' },
    structures: [
      { kind: 'landingpad', x: -180, z: -340, rotY: 0, scale: 1.1 },  // Federation staging flat
      { kind: 'commandpost', x: 170, z: -360, rotY: 3.14159, scale: 1.0 },
      { kind: 'radar', x: -330, z: -420, rotY: 0, scale: 1.0 },
      { kind: 'treecluster', x: 470, z: -230, rotY: 0, scale: 1.2 },
      { kind: 'river', x: 40, z: 180, rotY: 0, scale: 2.2 },          // Târnava Mare (E-W) — exposed crossing
      { kind: 'road', x: 0, z: 320, rotY: 0, scale: 1.7 },            // cobbled approach up the assault axis
      { kind: 'rockcluster', x: -330, z: 150, rotY: 0, scale: 1.1 },
      { kind: 'wall', x: -175, z: 435, rotY: 0, scale: 1.4 },         // 15th-c curtain wall, west span
      { kind: 'gate', x: 0, z: 440, rotY: 0, scale: 1.0 },            // main town gate — primary chokepoint
      { kind: 'wall', x: 180, z: 435, rotY: 0, scale: 1.4 },          // curtain wall, east span
      { kind: 'guntower', x: -275, z: 455, rotY: 0, scale: 1.0 },     // Forkesch gate tower
      { kind: 'guntower', x: 275, z: 455, rotY: 0, scale: 1.0 },      // east gate tower — crossfire
      { kind: 'battery', team: 'ZEON', x: -205, z: 500, rotY: 3.14159, scale: 1.0 },
      { kind: 'battery', team: 'ZEON', x: 205, z: 500, rotY: 3.14159, scale: 1.0 },
      { kind: 'townhouse', x: -95, z: 545, rotY: 1.5708, scale: 1.0 }, // Saxon burgher-house street canyon
      { kind: 'townhouse', x: 100, z: 545, rotY: -1.5708, scale: 1.0 },
      { kind: 'townhouse', x: -100, z: 650, rotY: 1.5708, scale: 1.05 },
      { kind: 'townhouse', x: 105, z: 650, rotY: -1.5708, scale: 1.0 },
      { kind: 'townhouse', x: -95, z: 755, rotY: 1.5708, scale: 1.0 },
      { kind: 'townhouse', x: 100, z: 755, rotY: -1.5708, scale: 1.05 },
      { kind: 'rubble', x: 5, z: 655, rotY: 0, scale: 1.3 },          // market-square kill-zone cover
      { kind: 'gate', x: 0, z: 860, rotY: 0, scale: 1.0 },            // Castle Square inner gate
      { kind: 'wall', x: -120, z: 915, rotY: 0.8, scale: 1.3 },       // triangular precinct wall, west
      { kind: 'wall', x: 120, z: 915, rotY: -0.8, scale: 1.3 },       // precinct wall, east
      { kind: 'churchtower', x: 0, z: 975, rotY: 0.1, scale: 1.0, variant: 'lean' }, // Leaning Trumpeters' Tower
      { kind: 'base', x: -55, z: 915, rotY: 0.3, scale: 1.0 },        // Zeon garrison strongpoint — the objective
    ],
  },

  {
    id: 'esff',
    name: 'FEDERATION FRONT BASE',
    subtitle: 'A dug-in Federation hill-fort on the European front — the Red Wolves are coming through the fog.',
    faction: 'FED',
    // cold steel overcast: churned grey-clay lows, rust-ochre earthwork highs, bluish-grey sky, cool ground fog
    biome: { lo: 0x382f25, hi: 0x6c6244, sky: 0x8f9aa6, fog: 0xa9b4bc, airless: false },
    fog: { near: 360, far: 2200 },
    light: { sun: 0xd6dbdf, intensity: 1.0, ambient: 0.9 },  // flat lidded steel daylight
    terrain: { style: 'rolling', rollingAmp: 105, ridgeAmp: 34, flattenRadius: 320 },
    mission: { type: 'defend', playerFaction: 'FED', enemyFaction: 'ZEON',
      summary: 'FRONT BASE · Hold the rampart and the command post — Iria Solari\'s Red Wolves counter-attack out of the fog-choked forest to the north.' },
    structures: [
      { kind: 'gate', x: 0, z: 285, rotY: 0, scale: 1.0 },            // main gate on the mud road
      { kind: 'wall', x: -150, z: 285, rotY: 0, scale: 2.0 },         // sandbagged ring-wall, west
      { kind: 'wall', x: 165, z: 285, rotY: 0, scale: 2.0 },          // ring-wall, east
      { kind: 'guntower', x: -255, z: 300, rotY: 0, scale: 1.0 },     // west anti-MS bastion
      { kind: 'guntower', x: 255, z: 300, rotY: 0, scale: 1.0 },      // east bastion — crossfire
      { kind: 'battery', team: 'FED', x: -170, z: 240, rotY: 0, scale: 1.0 },
      { kind: 'battery', team: 'FED', x: 170, z: 240, rotY: 0, scale: 1.0 },
      { kind: 'bunker', x: -80, z: 248, rotY: 0, scale: 1.0 },        // gate pillbox
      { kind: 'rubble', x: -40, z: 293, rotY: 0.4, scale: 1.0 },      // pre-collapsed wall gap
      { kind: 'road', x: 0, z: 205, rotY: 0, scale: 2.8 },            // churned approach road
      { kind: 'river', x: 0, z: 515, rotY: 0, scale: 3.4 },           // the Someșul Mic — the ford
      { kind: 'radar', x: 435, z: 150, rotY: -0.5, scale: 1.0 },      // ridge-crest radar — priority target
      { kind: 'watchtower', x: 458, z: 214, rotY: -0.5, scale: 1.0 }, // comms mast on the skyline
      { kind: 'treecluster', x: -360, z: 700, rotY: 0, scale: 1.6 },  // Haunted Forest — enemy jump-off
      { kind: 'treecluster', x: 120, z: 775, rotY: 0, scale: 1.8 },
      { kind: 'treecluster', x: 445, z: 730, rotY: 0, scale: 1.5 },
      { kind: 'treecluster', x: -150, z: 995, rotY: 0, scale: 1.6 },  // far treeline the attack emerges from
      { kind: 'hangar', x: -190, z: -150, rotY: 0.28, scale: 1.0 },   // dug-in MS hangar, west flank
      { kind: 'hangar', x: 188, z: -155, rotY: -0.28, scale: 1.0 },   // east flank
      { kind: 'landingpad', x: 0, z: -165, rotY: 0, scale: 1.0 },     // repair apron
      { kind: 'barracks', x: -250, z: -270, rotY: 0.1, scale: 1.0 },
      { kind: 'depot', x: -360, z: -420, rotY: 0.2, scale: 1.0 },     // rear fuel/ammo dump
      { kind: 'fueltank', x: -312, z: -466, rotY: 0, scale: 1.0 },
      { kind: 'rockcluster', x: -475, z: -418, rotY: 0, scale: 1.3 }, // quarry-wall defilade
      { kind: 'commandpost', x: 0, z: -430, rotY: 0, scale: 1.0 },    // hill-fort C2 bunker — the objective
      { kind: 'churchtower', x: 68, z: -458, rotY: 0, scale: 1.0, variant: 'keep' }, // repurposed watchtower keep
    ],
  },

  {
    id: 'clearcity',
    name: 'CLEAR-SKY CITY',
    subtitle: 'A bright midday urban combat zone with broad avenues, long sightlines and destructible city blocks.',
    faction: 'NEUTRAL',
    urban: true,
    // Clean blue noon sky, neutral concrete and green-grey verge terrain. Fog starts beyond the
    // playable city so the full boulevard remains readable without exposing the terrain edge.
    biome: { lo: 0x78877a, hi: 0xaeb5aa, sky: 0x72c4f2, fog: 0xb9dcf0, airless: false },
    fog: { near: 1350, far: 2900 },
    light: { sun: 0xfff1d2, intensity: 1.6, ambient: 0.92 },
    terrain: { style: 'flat', rollingAmp: 1, ridgeAmp: 0, flattenRadius: 2100 },
    mission: { type: 'destroy', playerFaction: 'FED', enemyFaction: 'ZEON',
      summary: 'CLEAR-SKY CITY · Engage hostile mobile suits along the central boulevard and surrounding blocks.' },
    structures: [
      // A clear 2.5 km north/south attack lane contains both default deployment points.
      { kind: 'cityroad', x: 0, z: 450, rotY: 0, length: 2500, width: 140, variant: 'boulevard' },
      { kind: 'cityroad', x: -520, z: 450, rotY: 0, length: 2400, width: 70 },
      { kind: 'cityroad', x: 520, z: 450, rotY: 0, length: 2400, width: 70 },
      // Cross streets form large MS-scale blocks and multiple flanking routes.
      { kind: 'cityroad', x: 0, z: -650, rotY: 1.5708, length: 1500, width: 72 },
      { kind: 'cityroad', x: 0, z: -200, rotY: 1.5708, length: 1500, width: 72 },
      { kind: 'cityroad', x: 0, z: 250, rotY: 1.5708, length: 1500, width: 72 },
      { kind: 'cityroad', x: 0, z: 700, rotY: 1.5708, length: 1500, width: 72 },
      { kind: 'cityroad', x: 0, z: 1150, rotY: 1.5708, length: 1500, width: 72 },
      { kind: 'cityroad', x: 0, z: 1600, rotY: 1.5708, length: 1500, width: 72 },

      // Southern blocks frame the player approach without crowding the deployment intersection.
      { kind: 'cityblock', x: -350, z: -425, w: 112, d: 150, h: 84, variant: 'tower' },
      { kind: 'cityblock', x: -170, z: -425, w: 98, d: 148, h: 54, variant: 'office' },
      { kind: 'cityblock', x: 170, z: -425, w: 104, d: 146, h: 62, variant: 'apartment' },
      { kind: 'cityblock', x: 350, z: -425, w: 116, d: 152, h: 92, variant: 'tower' },
      // A low civic pair and two pocket parks open the first major engagement square.
      { kind: 'cityblock', x: -350, z: 25, w: 124, d: 156, h: 46, variant: 'civic' },
      { kind: 'cityblock', x: 350, z: 25, w: 108, d: 150, h: 66, variant: 'office' },
      { kind: 'treecluster', x: -170, z: 25, rotY: 0, scale: 0.72 },
      { kind: 'treecluster', x: 170, z: 25, rotY: 0, scale: 0.72 },
      // Mid-city high-rise canyon.
      { kind: 'cityblock', x: -350, z: 475, w: 106, d: 148, h: 72, variant: 'office' },
      { kind: 'cityblock', x: -170, z: 475, w: 96, d: 142, h: 105, variant: 'tower' },
      { kind: 'cityblock', x: 170, z: 475, w: 98, d: 144, h: 96, variant: 'tower' },
      { kind: 'cityblock', x: 350, z: 475, w: 118, d: 154, h: 55, variant: 'apartment' },
      // Northern blocks surround the hostile approach while keeping the boulevard open.
      { kind: 'cityblock', x: -350, z: 925, w: 110, d: 150, h: 88, variant: 'tower' },
      { kind: 'cityblock', x: -170, z: 925, w: 102, d: 146, h: 60, variant: 'apartment' },
      { kind: 'cityblock', x: 170, z: 925, w: 104, d: 148, h: 80, variant: 'office' },
      { kind: 'cityblock', x: 350, z: 925, w: 110, d: 150, h: 100, variant: 'tower' },
      { kind: 'cityblock', x: -350, z: 1375, w: 120, d: 156, h: 52, variant: 'apartment' },
      { kind: 'cityblock', x: -170, z: 1375, w: 100, d: 146, h: 72, variant: 'office' },
      { kind: 'cityblock', x: 170, z: 1375, w: 98, d: 142, h: 90, variant: 'tower' },
      { kind: 'cityblock', x: 350, z: 1375, w: 126, d: 158, h: 42, variant: 'civic' },
      // Outer skyline masses make the playable grid read as part of a larger city.
      { kind: 'cityblock', x: -700, z: -425, w: 130, d: 170, h: 70, variant: 'apartment' },
      { kind: 'cityblock', x: 700, z: -425, w: 122, d: 168, h: 82, variant: 'office' },
      { kind: 'cityblock', x: -700, z: 475, w: 128, d: 172, h: 95, variant: 'tower' },
      { kind: 'cityblock', x: 700, z: 475, w: 132, d: 174, h: 58, variant: 'apartment' },
      { kind: 'cityblock', x: -700, z: 1375, w: 126, d: 170, h: 64, variant: 'office' },
      { kind: 'cityblock', x: 700, z: 1375, w: 134, d: 176, h: 88, variant: 'tower' },
      // A little battle damage provides low cover without closing either spawn lane.
      { kind: 'rubble', x: -92, z: 680, rotY: 0.35, scale: 0.82 },
      { kind: 'rubble', x: 96, z: 1110, rotY: -0.2, scale: 0.78 },
      { kind: 'battery', team: 'FED', x: -245, z: -665, rotY: 0, scale: 1.0 },
      { kind: 'battery', team: 'FED', x: 245, z: -665, rotY: 0, scale: 1.0 },
      { kind: 'battery', team: 'ZEON', x: -245, z: 1565, rotY: 3.14159, scale: 1.0 },
      { kind: 'battery', team: 'ZEON', x: 245, z: 1565, rotY: 3.14159, scale: 1.0 },
    ],
  },

  {
    id: 'odessa',
    name: 'OPERATION ODESSA',
    subtitle: 'Clear-sky mining basin warfare — rail cuts, refinery stacks, armored ridges and the Zeon landship line.',
    faction: 'NEUTRAL',
    // The Odessa offensive is staged as a dry Black Sea mining district: pale
    // steppe, exposed ore, deep blue sky and long combined-arms sightlines.
    biome: { lo: 0x8b7655, hi: 0xb9a47a, sky: 0x63b8ee, fog: 0xc8d8da, airless: false },
    fog: { near: 1600, far: 3400 },
    light: { sun: 0xffedc3, intensity: 1.72, ambient: 0.9 },
    terrain: { style: 'valley', rollingAmp: 46, ridgeAmp: 72, flattenRadius: 520 },
    mission: { type: 'odessa', playerFaction: 'FED', enemyFaction: 'ZEON',
      summary: 'OPERATION ODESSA · Break through the open-pit mine, destroy the Zeon landship line and seize the ore-processing stronghold.' },
    spawn: { player: { x: 0, z: -980 } },
    recommendedForces: {
      playerSuitId: 'rx78',
      allies: [
        { id: 'gm', n: 12, pos: { x: -360, z: -760 } },
        { id: 'rgm79sp', n: 3, pos: { x: 330, z: -720 } },
        { id: 'guncannon', n: 3, pos: { x: -80, z: -850 } },
        { id: 'guntank', n: 2, pos: { x: 440, z: -900 } },
        { id: 'type61', n: 12, pos: { x: -520, z: -900 } },
        { id: 'bigtray', n: 2, pos: { x: 0, z: -1250 } },
      ],
      enemies: [
        { id: 'zaku2g', n: 16, pos: { x: 0, z: 1150 } },
        { id: 'gouf', n: 4, pos: { x: -430, z: 1050 } },
        { id: 'dom', n: 3, pos: { x: 430, z: 1050 } },
        { id: 'magella', n: 10, pos: { x: 520, z: 850 } },
        { id: 'weasel', n: 4, pos: { x: -560, z: 820 } },
        { id: 'dabude', n: 2, pos: { x: 0, z: 1480 } },
      ],
    },
    structures: [
      // South: Federation assembly area and Big Tray approach lanes.
      { kind: 'road', x: -250, z: -1020, rotY: 0, scale: 3.8 },
      { kind: 'road', x: 250, z: -1020, rotY: 0, scale: 3.8 },
      { kind: 'landingpad', x: 0, z: -1180, rotY: 0, scale: 1.4 },
      { kind: 'commandpost', x: -360, z: -1220, rotY: 0.2, scale: 1.05 },
      { kind: 'depot', x: 370, z: -1200, rotY: -0.2, scale: 1.15 },
      { kind: 'fueltank', x: 470, z: -1150, rotY: 0, scale: 1.0 },
      { kind: 'battery', team: 'FED', x: -540, z: -1020, rotY: 0, scale: 1.15 },
      { kind: 'battery', team: 'FED', x: 540, z: -1020, rotY: 0, scale: 1.15 },

      // The open-pit bowl: broken benches and haul roads create cover without
      // closing the long north/south fire lanes.
      { kind: 'rockcluster', x: -620, z: -520, rotY: 0.1, scale: 2.0 },
      { kind: 'rockcluster', x: -690, z: -120, rotY: -0.2, scale: 1.8 },
      { kind: 'rockcluster', x: -640, z: 310, rotY: 0.4, scale: 2.1 },
      { kind: 'rockcluster', x: 640, z: -470, rotY: -0.2, scale: 2.0 },
      { kind: 'rockcluster', x: 700, z: -40, rotY: 0.3, scale: 1.8 },
      { kind: 'rockcluster', x: 630, z: 390, rotY: 0, scale: 2.15 },
      { kind: 'road', x: -210, z: -420, rotY: 0.08, scale: 4.6 },
      { kind: 'road', x: 210, z: 210, rotY: -0.08, scale: 4.6 },
      { kind: 'rubble', x: -180, z: -80, rotY: 0.3, scale: 1.25 },
      { kind: 'rubble', x: 210, z: 340, rotY: -0.4, scale: 1.15 },
      { kind: 'bunker', x: -470, z: 250, rotY: 0.7, scale: 1.1 },
      { kind: 'bunker', x: 470, z: 40, rotY: -0.7, scale: 1.1 },

      // Ore railway and processing complex on the northern high ground.
      { kind: 'cityroad', x: 0, z: 650, rotY: 1.5708, length: 1650, width: 34, variant: 'rail-cut' },
      { kind: 'hangar', x: -420, z: 700, rotY: 1.5708, scale: 1.25 },
      { kind: 'hangar', x: -250, z: 700, rotY: 1.5708, scale: 1.25 },
      { kind: 'depot', x: 300, z: 690, rotY: 0, scale: 1.35 },
      { kind: 'fueltank', x: 470, z: 720, rotY: 0, scale: 1.25 },
      { kind: 'radar', x: 610, z: 790, rotY: -0.25, scale: 1.2 },
      { kind: 'watchtower', x: -600, z: 820, rotY: 0.2, scale: 1.2 },
      { kind: 'commandpost', x: 0, z: 930, rotY: 3.14159, scale: 1.35 },
      { kind: 'barracks', x: -230, z: 940, rotY: 0.05, scale: 1.15 },
      { kind: 'barracks', x: 230, z: 940, rotY: -0.05, scale: 1.15 },

      // Zeon defensive belt and landship departure gate.
      { kind: 'wall', x: -360, z: 1080, rotY: 0.1, scale: 2.4 },
      { kind: 'wall', x: 360, z: 1080, rotY: -0.1, scale: 2.4 },
      { kind: 'gate', x: 0, z: 1080, rotY: 0, scale: 1.35 },
      { kind: 'guntower', x: -570, z: 1110, rotY: 0, scale: 1.25 },
      { kind: 'guntower', x: 570, z: 1110, rotY: 0, scale: 1.25 },
      { kind: 'battery', team: 'ZEON', x: -420, z: 1140, rotY: 3.14159, scale: 1.2 },
      { kind: 'battery', team: 'ZEON', x: 420, z: 1140, rotY: 3.14159, scale: 1.2 },
      { kind: 'bunker', x: -180, z: 1160, rotY: 3.14159, scale: 1.2 },
      { kind: 'bunker', x: 180, z: 1160, rotY: 3.14159, scale: 1.2 },
      { kind: 'base', x: 0, z: 1390, rotY: 3.14159, scale: 1.45 },
      { kind: 'rockcluster', x: -710, z: 1390, rotY: 0, scale: 1.8 },
      { kind: 'rockcluster', x: 710, z: 1390, rotY: 0, scale: 1.8 },
    ],
  },
];

export const MAP_BY_ID = Object.fromEntries(MAPS.map(m => [m.id, m]));
