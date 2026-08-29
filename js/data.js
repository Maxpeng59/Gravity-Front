// ---------- static game data: mobile suits, weapons, ships, crew, UC 0079 timeline ----------

export const TEAM = { FED: 'FED', ZEON: 'ZEON' };

// weapon types: beam (hitscan-ish fast bolt), mg (rapid bullets), bazooka (slow + splash), saber (melee via RMB or its weapon slot)
// weapon mount flags: head (head sensor/bank) · integrated (built into body/arm rather than handheld)
// unit flags: groundOnly (cannot deploy in space) · landType (ground-specialized MS travel bonus)
// · hover (Dom-style ground glide) · noJump · ace
// Federation rifle baseline = RX-78-2 beam rifle at 420 dmg; GM kinetic rifles deal ~60% of that (≈250).
export const SUITS = [
  {
    id: 'rx78', name: 'RX-78-2 Gundam', code: 'RX-78-2', faction: 'FED', style: 'gundam',
    hp: 5200, armor: 12, walk: 30, boost: 95, boostFuel: 100, scale: 1.0,
    colors: { main: 0xf2f2f0, chest: 0x1b4a9c, accent: 0xc8232c, trim: 0xf2c53d },
    weapons: [
      { name: 'XBR-M-79-07G BEAM RIFLE', type: 'beam', dmg: 420, rof: 1.4, clip: 16, reload: 2.6, speed: 1500, spread: 0.004 },
      { name: '60MM VULCAN GUNS', type: 'mg', dmg: 14, rof: 20, clip: 200, reload: 2.6, speed: 1500, spread: 0.022, head: true },
      { name: 'BLASH 380MM HYPER BAZOOKA', type: 'bazooka', dmg: 560, rof: 0.7, clip: 5, reload: 3.4, speed: 260, spread: 0.012, splash: 16 },
    ],
    saber: { name: 'BEAM SABER', dmg: 620 }, cost: 0,
  },
  // ---- Gundam variants (RX-78 derivatives — same frame, distinct colours & loadouts) ----
  {
    id: 'fa78', name: 'FA-78 Full Armor Gundam (Thunderbolt)', code: 'FA-78', faction: 'FED', style: 'gundam',
    hp: 6800, armor: 20, walk: 22, boost: 70, boostFuel: 95, scale: 1.02,
    colors: { main: 0xe9edf1, chest: 0x263b67, accent: 0xc42f32, trim: 0xe0b83c },
    weapons: [
      { name: 'TWIN BEAM RIFLE', type: 'beam', dmg: 520, rof: 1.0, clip: 10, reload: 3.0, speed: 1600, spread: 0.005 },
      { name: '60MM VULCAN GUNS', type: 'mg', dmg: 14, rof: 20, clip: 200, reload: 2.6, speed: 1500, spread: 0.022, head: true },
      { name: '6-TUBE MISSILE POD', type: 'bazooka', dmg: 580, rof: 0.7, clip: 6, reload: 3.4, speed: 270, spread: 0.012, splash: 16, integrated: true },
    ],
    saber: { name: 'BEAM SABER', dmg: 600 }, cost: 30000,
  },
  {
    id: 'rx79g', name: 'RX-79[G] Gundam Ground Type', code: 'RX-79[G]', faction: 'FED', style: 'gundam', landType: true,
    hp: 4600, armor: 13, walk: 33, boost: 86, boostFuel: 88, scale: 1.0,
    colors: { main: 0xcfd6d8, chest: 0x2c5a8a, accent: 0x9aa6b2, trim: 0xc8b24a },
    weapons: [
      { name: 'XBR-M-79E BEAM RIFLE', type: 'beam', dmg: 380, rof: 1.4, clip: 16, reload: 2.6, speed: 1450, spread: 0.005 },
      { name: 'YF-MG100 100MM MACHINE GUN', type: 'mg', dmg: 60, rof: 7, clip: 60, reload: 2.6, speed: 1000, spread: 0.02 },
      { name: 'CHEST VULCAN GUNS', type: 'mg', dmg: 14, rof: 20, clip: 200, reload: 2.6, speed: 1500, spread: 0.024, integrated: true },
    ],
    saber: { name: 'BEAM SABER', dmg: 520 }, cost: 18000,
  },
  {
    id: 'ez8', name: 'RX-79[G]Ez-8 Gundam EZ-8', code: 'RX-79[G]Ez-8', faction: 'FED', style: 'gundam', landType: true,
    hp: 4600, armor: 12, walk: 34, boost: 90, boostFuel: 90, scale: 1.0,
    colors: { main: 0xd8cdb0, chest: 0x4a5560, accent: 0xc23a30, trim: 0xc8b24a },
    weapons: [
      { name: 'XBR-M-79E BEAM RIFLE', type: 'beam', dmg: 390, rof: 1.5, clip: 16, reload: 2.6, speed: 1450, spread: 0.005 },
      { name: '35MM VULCAN GUNS', type: 'mg', dmg: 14, rof: 20, clip: 200, reload: 2.6, speed: 1500, spread: 0.024, head: true },
      { name: 'BLASH 380MM HYPER BAZOOKA', type: 'bazooka', dmg: 540, rof: 0.7, clip: 5, reload: 3.4, speed: 260, spread: 0.013, splash: 15 },
    ],
    saber: { name: 'BEAM SABER', dmg: 540 }, cost: 19000,
  },
  {
    id: 'nt1', name: 'RX-78NT-1 Gundam "Alex"', code: 'RX-78NT-1', faction: 'FED', style: 'gundam',
    hp: 5000, armor: 12, walk: 34, boost: 106, boostFuel: 100, scale: 1.0, ace: true,
    colors: { main: 0xdfe6ef, chest: 0x2456b8, accent: 0xc8232c, trim: 0xe6e6ee },
    weapons: [
      { name: 'BEAM RIFLE', type: 'beam', dmg: 430, rof: 1.5, clip: 16, reload: 2.5, speed: 1550, spread: 0.004 },
      { name: '90MM GATLING GUNS', type: 'mg', dmg: 24, rof: 18, clip: 180, reload: 2.8, speed: 1100, spread: 0.02, integrated: true },
      { name: '60MM VULCAN GUNS', type: 'mg', dmg: 14, rof: 20, clip: 200, reload: 2.6, speed: 1500, spread: 0.022, head: true },
    ],
    saber: { name: 'BEAM SABER', dmg: 620 }, cost: 32000,
  },
  {
    id: 'gp01', name: 'RX-78GP01 "Zephyranthes"', code: 'RX-78GP01', faction: 'FED', style: 'gundam',
    hp: 5400, armor: 12, walk: 31, boost: 98, boostFuel: 100, scale: 1.0,
    colors: { main: 0xf2f2f0, chest: 0x2456c8, accent: 0xc8232c, trim: 0xf2c53d },
    weapons: [
      { name: 'XBR-M-82-05H BEAM RIFLE', type: 'beam', dmg: 440, rof: 1.4, clip: 16, reload: 2.6, speed: 1550, spread: 0.004 },
      { name: '60MM VULCAN GUNS', type: 'mg', dmg: 14, rof: 20, clip: 200, reload: 2.6, speed: 1500, spread: 0.022, head: true },
      { name: 'BLASH 380MM HYPER BAZOOKA', type: 'bazooka', dmg: 560, rof: 0.7, clip: 6, reload: 3.4, speed: 270, spread: 0.012, splash: 16 },
    ],
    saber: { name: 'BEAM SABER', dmg: 640 }, cost: 34000,
  },
  {
    id: 'mk2', name: 'RX-178 Gundam Mk-II', code: 'RX-178', faction: 'FED', style: 'gundam',
    hp: 5600, armor: 13, walk: 33, boost: 104, boostFuel: 105, scale: 1.01, ace: true,
    colors: { main: 0xe8ecf2, chest: 0x2a3550, accent: 0xc8232c, trim: 0xe2c24a },
    weapons: [
      { name: 'XBR-M-86-C2 BEAM RIFLE', type: 'beam', dmg: 460, rof: 1.4, clip: 16, reload: 2.6, speed: 1600, spread: 0.004 },
      { name: '60MM VULCAN POD', type: 'mg', dmg: 14, rof: 20, clip: 200, reload: 2.6, speed: 1500, spread: 0.022, head: true },
      { name: '360MM HYPER BAZOOKA', type: 'bazooka', dmg: 560, rof: 0.7, clip: 6, reload: 3.4, speed: 270, spread: 0.012, splash: 16 },
    ],
    saber: { name: 'BEAM SABER', dmg: 660 }, cost: 44000,
  },
  // ---- legendary frames from other eras (bonus — built on the Gundam frame) ----
  {
    id: 'gundamx', name: 'GX-9900 Gundam X', code: 'GX-9900', faction: 'FED', style: 'gundam',
    hp: 6200, armor: 13, walk: 32, boost: 102, boostFuel: 110, scale: 1.02, ace: true,
    colors: { main: 0xeef0f3, chest: 0x214a86, accent: 0xb02828, trim: 0xd9a72f },
    weapons: [
      { name: 'SATELLITE CANNON', type: 'beam', dmg: 1200, rof: 0.35, clip: 3, reload: 4.2, speed: 2200, spread: 0.001, integrated: true },
      { name: 'SHIELD BUSTER RIFLE', type: 'beam', dmg: 420, rof: 1.4, clip: 16, reload: 2.6, speed: 1500, spread: 0.005 },
      { name: 'BREAST VULCAN GUNS', type: 'mg', dmg: 14, rof: 20, clip: 200, reload: 2.6, speed: 1500, spread: 0.022, integrated: true },
    ],
    saber: { name: 'LARGE BEAM SWORD', dmg: 680 }, cost: 60000,
  },
  {
    // Standard RGM-79: beam spray gun and beam saber.  Kinetic rifles belong
    // to their dedicated GM variants, not the ordinary production machine.
    id: 'gm', name: 'RGM-79 GM', code: 'RGM-79', faction: 'FED', style: 'gm',
    hp: 3400, armor: 8, walk: 28, boost: 82, boostFuel: 85, scale: 0.98,
    colors: { main: 0xf2f2ec, chest: 0xc0202b, accent: 0x3a4250, trim: 0xe8b81c },
    weapons: [
      // BOWA BR-M-79C-1 beam spray gun: a short-range beam SHOTGUN — one pull looses 6 weak bolts in a wide
      // spread; devastating point-blank, harmless past ~600m (low per-bolt dmg, short life). AI closes to use it.
      { name: 'BEAM SPRAY GUN', type: 'beam', dmg: 46, rof: 2.6, clip: 18, reload: 2.4, speed: 720, spread: 0.11, life: 0.85, pellets: 6, pref: 210 },
    ],
    saber: { name: 'BEAM SABER', dmg: 420 }, cost: 9000,
  },
  {
    // GM bazooka loadout: shoulder-fed GM cannon, a 20-round kinetic rifle and a beam saber
    id: 'gmbazooka', name: 'RGM-79 GM (Bazooka)', code: 'RGM-79', faction: 'FED', style: 'gm',
    hp: 3600, armor: 9, walk: 27, boost: 80, boostFuel: 85, scale: 0.98,
    colors: { main: 0xeaeae0, chest: 0xc0202b, accent: 0x33506e, trim: 0xe8b81c },
    weapons: [
      { name: 'BLASH 380MM HYPER BAZOOKA', type: 'bazooka', dmg: 480, rof: 0.9, clip: 6, reload: 3.2, speed: 320, spread: 0.012, splash: 13 },
      { name: 'HWF MG79 90MM MACHINE GUN', type: 'mg', dmg: 250, rof: 5, clip: 20, reload: 2.6, speed: 1400, spread: 0.012 },
    ],
    saber: { name: 'BEAM SABER', dmg: 420 }, cost: 11000,
  },
  {
    // GM Ground Type, assault: Dom-style hover, faster, high 1.5x jump; can reach space but is sluggish there
    id: 'gmg_a', name: 'RGM-79[G] GM Ground (Assault)', code: 'RGM-79[G]', faction: 'FED', style: 'gm',
    groundOnly: true, landType: true,
    hp: 3500, armor: 9, walk: 40, boost: 116, boostFuel: 95, scale: 0.99,
    colors: { main: 0xc7b48a, chest: 0x7d6644, accent: 0x5d4a30, trim: 0xd9caa2 },
    weapons: [
      { name: 'YF-MG100 100MM MACHINE GUN', type: 'mg', dmg: 250, rof: 7.5, clip: 50, reload: 2.6, speed: 1400, spread: 0.012 },
    ],
    saber: { name: 'BEAM SABER', dmg: 420 }, cost: 12000,
  },
  {
    // GM Ground Type, bazooka: Dom-style hover, faster, high 1.5x jump; can reach space but is sluggish there
    id: 'gmg_b', name: 'RGM-79[G] GM Ground (Bazooka)', code: 'RGM-79[G]', faction: 'FED', style: 'gm',
    groundOnly: true, landType: true,
    hp: 3700, armor: 10, walk: 38, boost: 112, boostFuel: 95, scale: 0.99,
    colors: { main: 0xc7b48a, chest: 0x6f5a3c, accent: 0x5d4a30, trim: 0xd9caa2 },
    weapons: [
      { name: 'YHI 380MM BAZOOKA', type: 'bazooka', dmg: 480, rof: 0.9, clip: 6, reload: 3.2, speed: 320, spread: 0.012, splash: 13 },
      { name: 'YF-MG100 100MM MACHINE GUN', type: 'mg', dmg: 250, rof: 7.5, clip: 20, reload: 2.6, speed: 1400, spread: 0.012 },
    ],
    saber: { name: 'BEAM SABER', dmg: 420 }, cost: 14000,
  },
  {
    id: 'rgm79sp', name: 'RGM-79SP GM Sniper II', code: 'RGM-79SP', faction: 'FED', style: 'gm',
    hp: 3900, armor: 10, walk: 29, boost: 92, boostFuel: 92, scale: 1.0,
    colors: { main: 0xaebdd0, chest: 0x33415c, accent: 0x33415c, trim: 0xd7dee8 },
    weapons: [
      { name: 'EF-KAR98K 75MM SNIPER RIFLE', type: 'beam', dmg: 720, rof: 0.5, clip: 6, reload: 3.4, speed: 2200, spread: 0.001 },
      { name: 'HEAD VULCAN GUNS', type: 'mg', dmg: 14, rof: 20, clip: 200, reload: 2.6, speed: 1500, spread: 0.024, head: true },
    ],
    saber: { name: 'BEAM SABER', dmg: 460 }, cost: 24000,
  },
  {
    // close-assault GM Spartan: its signature 3-barrel minigun (100-round drum) and a heat knife
    id: 'gmspartan', name: 'RGM-79S GM Spartan', code: 'RGM-79S', faction: 'FED', style: 'gm',
    hp: 3700, armor: 9, walk: 31, boost: 90, boostFuel: 92, scale: 0.99,
    colors: { main: 0x59654a, chest: 0x30392f, accent: 0x242b27, trim: 0x9ea783 },
    weapons: [
      { name: '3-BARREL MINIGUN', type: 'mg', dmg: 34, rof: 10, clip: 100, reload: 3.2, speed: 1250, spread: 0.016 },
    ],
    saber: { name: 'HEAT KNIFE', dmg: 420 }, cost: 21600, // 90% of the GM Sniper II
  },
  {
    id: 'guncannon', name: 'RX-77-2 Guncannon', code: 'RX-77-2', faction: 'FED', style: 'guncannon',
    hp: 4500, armor: 15, walk: 22, boost: 68, boostFuel: 70, scale: 1.02,
    colors: { main: 0xb71c1c, chest: 0xb71c1c, accent: 0x39435a, trim: 0xf2c14e },
    weapons: [
      { name: '240MM CANNONS', type: 'bazooka', dmg: 410, rof: 1.0, clip: 12, reload: 3.0, speed: 300, spread: 0.01, splash: 12 },
      { name: 'HWF 90MM BULLPUP MG', type: 'mg', dmg: 30, rof: 9, clip: 120, reload: 2.6, speed: 850, spread: 0.026 },
    ],
    saber: { name: 'STRIKE', dmg: 300 }, cost: 16000,
  },
  {
    id: 'guntank', name: 'RX-75-4 Guntank', code: 'RX-75-4', faction: 'FED', style: 'guntank',
    hp: 5000, armor: 18, walk: 17, boost: 46, boostFuel: 55, scale: 1.05, noJump: true, groundOnly: true,
    colors: { main: 0xe8e4d8, chest: 0xb71c1c, accent: 0x39435a, trim: 0xf2c14e },
    weapons: [
      { name: '120MM LOW-RECOIL CANNONS', type: 'bazooka', dmg: 470, rof: 0.8, clip: 16, reload: 3.2, speed: 320, spread: 0.008, splash: 14 },
      { name: 'QUAD BOP MISSILE LAUNCHER', type: 'mg', dmg: 42, rof: 6, clip: 80, reload: 3.0, speed: 500, spread: 0.04 },
    ],
    saber: { name: 'RAM', dmg: 200 }, cost: 14000,
  },
  {
    id: 'guntankaa', name: 'RX-75 Guntank Anti-Air [GF CUSTOM]', code: 'RX-75[AA] / GF', faction: 'FED', style: 'guntank', aa: true,
    hp: 4800, armor: 17, walk: 17, boost: 44, boostFuel: 55, scale: 1.05, noJump: true, groundOnly: true,
    colors: { main: 0xb9b8a8, chest: 0x4a5a3a, accent: 0x39435a, trim: 0xf2c14e },
    weapons: [
      { name: 'TWIN 75MM AA FLAK CANNON', type: 'mg', dmg: 80, rof: 9, clip: 120, reload: 3.4, speed: 1800, spread: 0.013, splash: 9 },
      { name: 'QUAD 35MM AA GUN', type: 'mg', dmg: 34, rof: 18, clip: 240, reload: 2.6, speed: 1550, spread: 0.022 },
    ],
    saber: { name: 'RAM', dmg: 180 }, cost: 17000,
  },
  {
    // The Origin's early-production Guntank: wide articulated tracks, low sensor head, huge shoulders,
    // outward-canted artillery and quad arm autocannons. Previously mislabeled RTX-44 / "MK-I".
    id: 'guntankmk1', name: 'RTX-65 Guntank Early Type', code: 'RTX-65', faction: 'FED', style: 'guntank', noJump: true, groundOnly: true,
    hp: 3200, armor: 14, walk: 26, boost: 72, boostFuel: 60, scale: 1.2,
    colors: { main: 0xb7bbc4, chest: 0x9aa0a9, accent: 0x7d838c, trim: 0x3a3f46 }, // light grey per reference
    weapons: [
      { name: 'QUAD-BARREL AUTOCANNONS', type: 'mg', dmg: 40, rof: 12, clip: 140, reload: 3.0, speed: 1250, spread: 0.02 },
      { name: 'TWIN 155MM BACK ARTILLERY', type: 'bazooka', dmg: 300, rof: 0.7, clip: 8, reload: 4.0, speed: 540, spread: 0.02, splash: 30, arc: true, shell: true, life: 9, pref: 950 },
    ],
    saber: { name: 'NONE', dmg: 0 }, cost: 13000,
  },
  {
    // Requiem for Vengeance's RTX-440-B: headless casemate, rear-rising tracks, right-torso 220 mm
    // cannon, asymmetrical Bop-gun arms, twin rear fuel packs and a rear bulldozer blade.
    id: 'guntankmk2', name: 'Guntank Ground Assault Type B', code: 'RTX-440-B', faction: 'FED', style: 'crane', noJump: true, groundOnly: true,
    hp: 4200, armor: 16, walk: 11, boost: 28, boostFuel: 45, scale: 1.0,
    colors: { main: 0x514d42, chest: 0x5e594d, accent: 0x45484a, trim: 0x8d8a80 },
    weapons: [
      { name: '220MM CANNON', type: 'bazooka', dmg: 640, rof: 0.34, clip: 4, reload: 5.6, speed: 560, spread: 0.014, splash: 46, arc: true, shell: true, recoil: 1.4, life: 9, pref: 1250 },
    ],
    saber: { name: 'NONE', dmg: 0 }, cost: 16000,
  },
  {
    // Zaku assault: just the 50-round low-damage machine gun and a heat hawk
    id: 'zaku2', name: 'MS-06F Zaku II (Assault)', code: 'MS-06F', faction: 'ZEON', style: 'zaku',
    hp: 3200, armor: 8, walk: 27, boost: 78, boostFuel: 80, scale: 0.99,
    colors: { main: 0x9aaa8f, chest: 0x3b3e46, accent: 0x66715e, trim: 0xaeb9a5 },
    weapons: [
      { name: 'ZMP-50D 120MM MACHINE GUN', type: 'mg', dmg: 44, rof: 8, clip: 50, reload: 2.8, speed: 840, spread: 0.024 },
    ],
    saber: { name: 'HEAT HAWK TYPE-5', dmg: 380 }, cost: 7000,
  },
  {
    // MS-06J Zaku II Ground Type — terrestrial cooling and mobility changes; it still walks/runs (no hover system).
    id: 'zaku2g', name: 'MS-06J Zaku II (Ground Type)', code: 'MS-06J', faction: 'ZEON', style: 'zaku',
    groundOnly: true, landType: true,
    hp: 3200, armor: 9, walk: 30, boost: 84, boostFuel: 86, scale: 0.99,
    colors: { main: 0x9aaa8f, chest: 0x3b3e46, accent: 0x66715e, trim: 0xaeb9a5 },
    weapons: [
      { name: 'ZMP-50D 120MM MACHINE GUN', type: 'mg', dmg: 44, rof: 8, clip: 50, reload: 2.8, speed: 840, spread: 0.024 },
    ],
    saber: { name: 'HEAT HAWK TYPE-5', dmg: 380 }, cost: 8000,
  },
  {
    // Zaku bazooka: Zaku bazooka + a 3-round grenade launcher + heat hawk
    id: 'zaku2b', name: 'MS-06F Zaku II (Bazooka)', code: 'MS-06F', faction: 'ZEON', style: 'zaku',
    hp: 3300, armor: 9, walk: 26, boost: 76, boostFuel: 80, scale: 0.99,
    colors: { main: 0x9aaa8f, chest: 0x3b3e46, accent: 0x66715e, trim: 0xaeb9a5 },
    weapons: [
      { name: 'H&L-SB25K ZAKU BAZOOKA', type: 'bazooka', dmg: 460, rof: 0.7, clip: 5, reload: 3.4, speed: 250, spread: 0.014, splash: 14 },
      { name: 'MIP-B6 CRACKER GRENADE', type: 'bazooka', dmg: 330, rof: 1.4, clip: 3, reload: 3.0, speed: 360, spread: 0.02, splash: 11 },
    ],
    saber: { name: 'HEAT HAWK TYPE-5', dmg: 380 }, cost: 8500,
  },
  {
    id: 'zaku2s', name: "MS-06S Zaku II (Cmdr)", code: 'MS-06S', faction: 'ZEON', style: 'zaku',
    hp: 3700, armor: 9, walk: 33, boost: 100, boostFuel: 95, scale: 1.0, ace: true,
    commander: true, spaceDoctrine: 'red_comet', spaceThrustMul: 1.3, spaceBoostDrainMul: 1.2,
    colors: { main: 0xd75d68, chest: 0x67262b, accent: 0xa72d31, trim: 0x393c42 },
    weapons: [
      { name: 'ZMP-50D 120MM MACHINE GUN', type: 'mg', dmg: 52, rof: 9, clip: 50, reload: 2.6, speed: 870, spread: 0.02 },
      { name: 'H&L-SB25K ZAKU BAZOOKA', type: 'bazooka', dmg: 480, rof: 0.8, clip: 5, reload: 3.2, speed: 260, spread: 0.012, splash: 14 },
    ],
    saber: { name: 'HEAT HAWK TYPE-5', dmg: 430 }, cost: 12000,
  },
  {
    // Zaku Tank: a Zaku upper body on a tracked lower body — slow, tough fire-support with a shoulder bazooka
    id: 'zakutank', name: 'MS-06V Zaku Tank', code: 'MS-06V', faction: 'ZEON', style: 'zakutank', groundOnly: true, noJump: true,
    hp: 4400, armor: 15, walk: 30, boost: 41, boostFuel: 55, scale: 1.0,
    colors: { main: 0x4f5948, chest: 0x28302d, accent: 0x68715d, trim: 0x8b9185 },
    weapons: [
      // [1] DIRECT: high-velocity anti-materiel cannon — flat, precise, punishing single shots with a huge recoil kick
      { name: '580MM ANTI-MATERIEL CANNON', type: 'bazooka', dmg: 760, rof: 0.6, clip: 5, reload: 4.6, speed: 1150, spread: 0.004, splash: 9, shell: true, ap: true, recoil: 1.0, pref: 360, life: 4 },
      // [2] ARTILLERY: the cannon swings up over the back and LOBS a bombardment shell on a high arc — for far targets
      { name: 'ARTILLERY BOMBARDMENT', type: 'bazooka', dmg: 680, rof: 0.4, clip: 4, reload: 5.4, speed: 560, spread: 0.016, splash: 46, arc: true, shell: true, recoil: 1.35, pref: 1150, life: 9 },
    ],
    saber: { name: 'RAM', dmg: 0 }, cost: 13000,
  },
  {
    id: 'gouf', name: 'MS-07B Gouf', code: 'MS-07B', faction: 'ZEON', style: 'gouf', groundOnly: true, landType: true,
    hp: 3900, armor: 11, walk: 30, boost: 86, boostFuel: 85, scale: 1.0,
    colors: { main: 0x2869a9, chest: 0x182b45, accent: 0x245181, trim: 0xd88a2d },
    weapons: [
      { name: '5-BARREL 75MM FINGER GUN', type: 'mg', dmg: 34, rof: 11, clip: 130, reload: 2.6, speed: 800, spread: 0.028, integrated: true },
      { name: 'HEAT ROD', type: 'beam', dmg: 300, rof: 0.8, clip: 8, reload: 2.0, speed: 700, spread: 0.006, integrated: true },
    ],
    saber: { name: 'HEAT SWORD', dmg: 560 }, cost: 11000,
  },
  {
    // Canonical RfV/08th MS Team Gouf Custom; the old "Night Hawk" identity was game-original.
    id: 'goufnh', name: 'MS-07B-3 Gouf Custom', code: 'MS-07B-3', faction: 'ZEON', style: 'gouf',
    groundOnly: true, landType: true,
    hp: 3900, armor: 11, walk: 36, boost: 100, boostFuel: 90, scale: 1.0,
    colors: { main: 0x465666, chest: 0x1c2730, accent: 0x293b4c, trim: 0x8a9296 },
    weapons: [
      { name: '75MM GATLING SHIELD', type: 'mg', dmg: 28, rof: 18, clip: 200, reload: 3.0, speed: 1100, spread: 0.011, integrated: true },
      { name: '3-BARREL 35MM GUN', type: 'mg', dmg: 34, rof: 11, clip: 90, reload: 2.6, speed: 900, spread: 0.018, integrated: true },
    ],
    saber: { name: 'HEAT SWORD TYPE-D III', dmg: 560 }, cost: 16000,
  },
  {
    // Dom: a single 7-round Giant Bazooka and a heat saber
    id: 'dom', name: 'MS-09 Dom', code: 'MS-09', faction: 'ZEON', style: 'dom',
    hp: 4300, armor: 12, walk: 42, boost: 112, boostFuel: 90, scale: 1.05, hover: true, landType: true,
    colors: { main: 0x756594, chest: 0x202129, accent: 0x34313f, trim: 0xa5a7ad },
    weapons: [
      { name: 'H&L-GB03K GIANT BAZOOKA', type: 'bazooka', dmg: 540, rof: 0.6, clip: 7, reload: 3.6, speed: 270, spread: 0.012, splash: 17 },
    ],
    saber: { name: 'HEAT SABER', dmg: 520 }, cost: 15000,
  },
  {
    id: 'gelgoog', name: 'MS-14 Gelgoog', code: 'MS-14', faction: 'ZEON', style: 'gelgoog',
    hp: 4700, armor: 12, walk: 31, boost: 96, boostFuel: 95, scale: 1.03,
    colors: { main: 0x66745f, chest: 0x404b41, accent: 0x555c64, trim: 0x70787a },
    weapons: [
      { name: 'GELGOOG BEAM RIFLE', type: 'beam', dmg: 400, rof: 1.3, clip: 14, reload: 2.8, speed: 1400, spread: 0.005 },
      { name: 'MISSILE LAUNCHER', type: 'bazooka', dmg: 320, rof: 1.2, clip: 8, reload: 3.0, speed: 300, spread: 0.02, splash: 10 },
    ],
    saber: { name: 'BEAM NAGINATA', dmg: 580 }, cost: 21000,
  },
  {
    id: 'gelgoogs', name: "MS-14S Gelgoog (Cmdr)", code: 'MS-14S', faction: 'ZEON', style: 'gelgoog', ace: true,
    hp: 5100, armor: 13, walk: 35, boost: 108, boostFuel: 100, scale: 1.03,
    commander: true, spaceDoctrine: 'gelgoog_duelist', spaceThrustMul: 1.12, spaceBoostDrainMul: 0.92,
    colors: { main: 0xd25a64, chest: 0x65131c, accent: 0xad2733, trim: 0xe07c84 },
    weapons: [
      { name: 'GELGOOG BEAM RIFLE', type: 'beam', dmg: 430, rof: 1.4, clip: 14, reload: 2.6, speed: 1450, spread: 0.004 },
      { name: 'MISSILE LAUNCHER', type: 'bazooka', dmg: 330, rof: 1.2, clip: 8, reload: 3.0, speed: 300, spread: 0.018, splash: 10 },
    ],
    saber: { name: 'BEAM NAGINATA', dmg: 640 }, cost: 28000,
  },
  // ---- ground vehicles: tiny, fragile, rapid-firing support armor ----
  {
    id: 'type61', name: 'Type 61 Tank', code: 'M61A5', faction: 'FED', style: 'tank',
    hp: 750, armor: 4, walk: 16, boost: 26, boostFuel: 30, scale: 0.956, noJump: true, groundOnly: true,
    colors: { main: 0x5e6b54, chest: 0x4a553f, accent: 0x3c4534, trim: 0x8a9379 },
    weapons: [
      { name: 'TWIN 155MM SMOOTHBORE CANNON', type: 'mg', dmg: 85, rof: 3.3, clip: 24, reload: 2.6, speed: 620, spread: 0.02 },
    ],
    saber: { name: 'RAM', dmg: 90 }, cost: 1800,
  },
  {
    id: 'magella', name: 'Magella Attack', code: 'HT-01B', faction: 'ZEON', style: 'tank',
    hp: 700, armor: 4, walk: 15, boost: 24, boostFuel: 30, scale: 1.0125, noJump: true, groundOnly: true,
    colors: { main: 0x64764a, chest: 0x435139, accent: 0x7c8b5c, trim: 0x9b9d8c },
    weapons: [
      { name: '175MM MAGELLA TOP CANNON', type: 'mg', dmg: 90, rof: 3.3, clip: 20, reload: 2.8, speed: 600, spread: 0.022 },
    ],
    saber: { name: 'RAM', dmg: 80 }, cost: 1500,
  },
  {
    // RfV's PVN.44/1 is canonically a six-wheel amphibious scout/APC with a 37mm cannon.
    // This explicit 30mm field refit keeps the screen-accurate carrier but follows the requested balance:
    // every cannon hit deals exactly half the Zaku II assault gun's 44 damage.
    id: 'weasel', name: 'PVN.44/1 Weasel APC (30mm Refit)', code: 'PVN.44/1-30', faction: 'ZEON', style: 'apc',
    hp: 550, armor: 6, walk: 52, boost: 118, boostFuel: 80, scale: 1.0, // thin-skinned troop carrier — quartered from 2200, it dies like the truck it is
    noJump: true, groundOnly: true, vehicle: true, agile: true, amphibious: true, apc: true, troopCapacity: 8,
    groundAccel: 145, aiAccel: 5.5, groundTurn: 14, aiTurn: 4.2,
    aimHeight: 1.35, weaponHeight: 2.46, collisionRadius: 3.55,
    dimensions: { length: 6.9, width: 3.8, height: 2.7 },
    hitSpheres: [
      { x: 0, y: 1.05, z: -2.15, r: 1.65 },
      { x: 0, y: 1.05, z: 0, r: 1.7 },
      { x: 0, y: 0.95, z: 2.15, r: 1.5 },
      { x: 0, y: 2.15, z: 0.75, r: 0.7 },
    ],
    weakPoints: [
      { x: -0.72, y: 1.5, z: 2.25, r: 0.48, mult: 2.5 },
      { x: 0, y: 1.0, z: -2.7, r: 0.6, mult: 2.0 },
    ],
    colors: { main: 0x4d5d40, chest: 0x2c382c, accent: 0x6b5139, trim: 0xa5a795 },
    weapons: [
      { name: '30MM MACHINE CANNON (FIELD REFIT)', type: 'mg', dmg: 13, rof: 8, clip: 90, reload: 2.4, speed: 1050, spread: 0.016, pref: 280, integrated: true }, // suppression fire, not an MS-killer (was 22)
    ],
    saber: { name: 'NONE', dmg: 0 }, cost: 3200,
  },
  {
    id: 'acguy', name: 'MSM-04 Acguy', code: 'MSM-04', faction: 'ZEON', style: 'acguy',
    hp: 3600, armor: 10, walk: 24, boost: 72, boostFuel: 75, scale: 0.95,
    colors: { main: 0x8a705e, chest: 0x4b111b, accent: 0x6d5248, trim: 0x999ba5 },
    weapons: [
      { name: '105MM VULCAN GUN', type: 'mg', dmg: 40, rof: 10, clip: 110, reload: 2.6, speed: 800, spread: 0.026, integrated: true },
      { name: '6-TUBE ROCKET LAUNCHER', type: 'bazooka', dmg: 300, rof: 1.0, clip: 6, reload: 3.0, speed: 260, spread: 0.02, splash: 10, integrated: true },
    ],
    saber: { name: 'IRON NAIL', dmg: 480 }, cost: 9500,
  },
];

// ---------- air forces (One Year War fighters) ----------
// Independent of the MS hangar. Fast, fragile, missile/vulcan armed, no melee.
// They fly their own strafing-run AI (see aircraftUpdate in battle.js).
// FED craft are purchasable into the air wing; ZEON craft appear as enemies.
export const AIRCRAFT = [
  {
    id: 'saberfish', name: 'FF-S3 Saberfish', code: 'FF-S3', faction: 'FED', style: 'fighter', air: true,
    hp: 1500, armor: 4, walk: 95, boost: 210, boostFuel: 100, scale: 0.62, turn: 1.7,
    colors: { main: 0xdfe4ea, chest: 0x33415c, accent: 0xc23a30, trim: 0x9aa6b2 },
    weapons: [
      { name: '25MM VULCANS', type: 'mg', dmg: 18, rof: 16, clip: 320, reload: 3.0, speed: 1300, spread: 0.02 },
      { name: 'MISSILE PODS', type: 'bazooka', dmg: 230, rof: 1.3, clip: 12, reload: 4.2, speed: 620, spread: 0.012, splash: 9 },
    ],
    saber: { name: '—', dmg: 0 }, cost: 6500,
  },
  {
    // Gravity Front-original heavy upgrade, explicitly separated from official Saberfish variants.
    id: 'saberfish5000', name: 'Saberfish 5000 [GF CUSTOM]', code: 'FF-S3-AGL / GF', faction: 'FED', style: 'fighter', air: true,
    hp: 1900, armor: 5, walk: 105, boost: 231, boostFuel: 100, scale: 0.64, turn: 1.75,
    colors: { main: 0xeef2f6, chest: 0x2b4a86, accent: 0xd24a2e, trim: 0xe6c24a },
    weapons: [
      { name: '25MM VULCANS', type: 'mg', dmg: 22, rof: 16, clip: 320, reload: 3.0, speed: 1350, spread: 0.018 },
      { name: 'AGL MISSILE PODS', type: 'bazooka', dmg: 340, rof: 1.5, clip: 18, reload: 3.8, speed: 700, spread: 0.01, splash: 11 },
      { name: 'LOCK-ON MISSILE', type: 'lockmissile', dmg: 560, rof: 0.7, clip: 6, reload: 5.0, speed: 480, spread: 0, splash: 16, lockTime: 3, turn: 4.0 },
    ],
    saber: { name: '—', dmg: 0 }, cost: 13000,
  },
  {
    id: 'corefighter', name: 'FF-X7 Core Fighter', code: 'FF-X7', faction: 'FED', style: 'fighter', air: true,
    hp: 1100, armor: 3, walk: 100, boost: 232, boostFuel: 100, scale: 0.55, turn: 2.0,
    colors: { main: 0xe8e8ee, chest: 0x2456b8, accent: 0xd23030, trim: 0xf2c94c },
    weapons: [
      { name: 'VULCANS', type: 'mg', dmg: 16, rof: 18, clip: 300, reload: 2.8, speed: 1300, spread: 0.022 },
      { name: 'MISSILES', type: 'bazooka', dmg: 200, rof: 1.4, clip: 8, reload: 4.0, speed: 640, spread: 0.012, splash: 8 },
    ],
    saber: { name: '—', dmg: 0 }, cost: 5000,
  },
  {
    id: 'flymanta', name: 'FF/B-2 Fly Manta', code: 'FF/B-2', faction: 'FED', style: 'fighter', air: true,
    hp: 1850, armor: 5, walk: 85, boost: 185, boostFuel: 100, scale: 0.72, turn: 1.45,
    colors: { main: 0xd9ccad, chest: 0x6b5d44, accent: 0xd2622e, trim: 0x3a3f48 },
    weapons: [
      { name: 'VULCANS', type: 'mg', dmg: 22, rof: 13, clip: 280, reload: 3.0, speed: 1200, spread: 0.02 },
      { name: 'BOMB / MISSILES', type: 'bazooka', dmg: 320, rof: 1.0, clip: 10, reload: 4.4, speed: 560, spread: 0.014, splash: 12 },
    ],
    saber: { name: '—', dmg: 0 }, cost: 8000,
  },
  {
    id: 'dopp', name: 'DFA-03 Dopp', code: 'DFA-03', faction: 'ZEON', style: 'fighter', air: true,
    hp: 900, armor: 2, walk: 78, boost: 176, boostFuel: 100, scale: 0.64, turn: 1.95,
    colors: { main: 0x6e7a52, chest: 0x4c5438, accent: 0x3a4030, trim: 0xd0c85a },
    weapons: [
      { name: '20MM VULCANS', type: 'mg', dmg: 18, rof: 15, clip: 300, reload: 3.0, speed: 1250, spread: 0.022 },
      { name: '30MM MISSILES', type: 'bazooka', dmg: 220, rof: 1.3, clip: 12, reload: 4.0, speed: 600, spread: 0.013, splash: 9 },
    ],
    saber: { name: '—', dmg: 0 }, cost: 5500,
  },
  {
    id: 'gattle', name: 'Gattle', code: 'Gattle B', faction: 'ZEON', style: 'fighter', air: true,
    hp: 1700, armor: 5, walk: 84, boost: 196, boostFuel: 100, scale: 0.72, turn: 1.5,
    colors: { main: 0xb33a2a, chest: 0x8a2a1e, accent: 0xcdb98f, trim: 0x9b8a74 },
    weapons: [
      { name: '30MM VULCANS', type: 'mg', dmg: 22, rof: 14, clip: 300, reload: 3.0, speed: 1250, spread: 0.02 },
      { name: 'A-SHIP MISSILES', type: 'bazooka', dmg: 340, rof: 0.9, clip: 10, reload: 4.5, speed: 560, spread: 0.014, splash: 12 },
    ],
    saber: { name: '—', dmg: 0 }, cost: 7000,
  },
  {
    // GAW: huge Zeon flying-wing attack carrier — ~10x a Gundam (scale 7.3 → ~182m span). Lumbering, heavily armoured.
    id: 'gaw', name: 'GAW Attack Carrier', code: 'GAW', faction: 'ZEON', style: 'fighter', air: true, carrier: true,
    hp: 14000, armor: 30, walk: 28, boost: 60, boostFuel: 100, scale: 7.3, turn: 0.22,
    colors: { main: 0x8d78a4, chest: 0x55436c, accent: 0xb64b36, trim: 0xd18a43 },
    weapons: [
      { name: 'TWIN MEGA CANNON', type: 'beam', dmg: 480, rof: 0.8, clip: 24, reload: 4.2, speed: 1600, spread: 0.01 },
      { name: 'AA FLAK BATTERY', type: 'mg', dmg: 52, rof: 14, clip: 320, reload: 3.4, speed: 1500, spread: 0.03 },
      { name: 'CARPET BOMB', type: 'bomb', dmg: 200, rof: 0.3, clip: 4, reload: 6, speed: 60, spread: 0, splash: 22, bombs: 12 },
    ],
    saber: { name: '—', dmg: 0 }, cost: 80000,
  },
  {
    // Canonical G-Parts support craft / flying tank with visible tracks and twin beam cannons.
    id: 'gfighter', name: 'G-Fighter', code: 'FF-X7-G', faction: 'FED', style: 'fighter', air: true,
    hp: 2600, armor: 14, walk: 57, boost: 126, boostFuel: 100, scale: 1.05, turn: 1.05,
    colors: { main: 0x2c4fa8, chest: 0x1e3a86, accent: 0xc62f2f, trim: 0xe0b428 },
    weapons: [
      { name: 'TWIN MEGA-PARTICLE CANNONS', type: 'beam', dmg: 360, rof: 1.1, clip: 18, reload: 3.2, speed: 1500, spread: 0.006 },
      { name: 'MISSILE LAUNCHERS', type: 'bazooka', dmg: 260, rof: 1.1, clip: 8, reload: 4.0, speed: 600, spread: 0.014, splash: 10 },
    ],
    saber: { name: '—', dmg: 0 }, cost: 22000,
  },
];

export const suitById = id => SUITS.find(s => s.id === id) || AIRCRAFT.find(a => a.id === id);
export const isAircraft = id => AIRCRAFT.some(a => a.id === id);

export const ENVIRONMENTS = [
  { id: 'space', name: 'OPEN SPACE' },
  { id: 'ground', name: 'PLANETARY SURFACE' },
  { id: 'colony', name: 'COLONY INTERIOR' },
];

// ---------- ship modules (level 0..3 each) ----------
export const SHIP_MODULES = {
  engine:   { name: 'DRIVE BLOCK',    desc: 'Interplanetary cruise speed', base: 55, per: 22, costs: [0, 6000, 14000, 30000] },
  armor:    { name: 'HULL PLATING',   desc: 'Ship hull integrity',          base: 100, per: 60, costs: [0, 5000, 12000, 26000] },
  radar:    { name: 'SENSOR ARRAY',   desc: 'Intel radius on the star map', base: 130, per: 110, costs: [0, 4500, 11000, 24000] },
  hangar:   { name: 'MS HANGAR',      desc: 'Mobile suit bays (storage)',   base: 3, per: 2, levels: [3, 9, 14, 20], costs: [0, 7000, 16000, 34000] },
  quarters: { name: 'CREW QUARTERS',  desc: 'Maximum crew size',            base: 3, per: 2, costs: [0, 4000, 10000, 22000] },
  guns:     { name: 'SHIP BATTERIES', desc: 'Escort fire support in battle',base: 0, per: 1, costs: [0, 6500, 15000, 32000] },
};

// ---------- crew ----------
export const CREW_ROLES = {
  engineer:      { name: 'ENGINEER',      jobs: ['REPAIR SHIP', 'TUNE DRIVE'],     desc: 'Repairs hull daily / +travel speed' },
  mechanic:      { name: 'MS MECHANIC',   jobs: ['MAINTAIN MS', 'FIELD KIT'],      desc: 'Repairs your suits daily / cheaper repairs' },
  scout:         { name: 'RECON OFFICER', jobs: ['SECTOR SCAN', 'ROUTE PLOTTING'], desc: 'Reveals nearby worlds / fewer ambushes' },
  gunner:        { name: 'SHIP GUNNER',   jobs: ['FIRE SUPPORT', 'POINT DEFENSE'], desc: 'Ship batteries aid you in combat' },
  quartermaster: { name: 'QUARTERMASTER', jobs: ['TRADE RUNS', 'PROCUREMENT'],     desc: 'Earns credits daily / cheaper purchases' },
};

export const CREW_FIRST = ['Kai', 'Hayato', 'Sayla', 'Mirai', 'Fraw', 'Ryu', 'Job', 'Marker', 'Oscar', 'Omur', 'Lena', 'Anna', 'Bright', 'Reed', 'Tem', 'Hugh', 'Cameron', 'Sleggar', 'Lila', 'Matilda'];
export const CREW_LAST = ['Shiden', 'Kobayashi', 'Yashima', 'Bow', 'Jose', 'Clan', 'Marcus', 'Riddle', 'Vega', 'Holt', 'Iwasa', 'Dren', 'Calloway', 'Noa', 'Ajan', 'Kirks', 'Bloom', 'Law', 'Milla', 'Onda'];

// ---------- UC 0079 timeline (day 0 = 0079.01.01) ----------
// Campaign starts day 260 = Sept 18, the Side 7 attack.
export const START_DAY = 260;
export const TIMELINE = [
  { day: 262, id: 'whitebase', title: 'PEGASUS-CLASS UNDERWAY', text: 'Your carrier escapes Side 7 with refugees aboard. Federation command grants you independent operating authority across the Frontier Sphere.' },
  { day: 275, id: 'garma', title: 'GARMA ZABI KILLED IN ACTION', text: 'Zeon commander Garma Zabi dies in a colony drop intercept. Zeon morale wavers; Dozle Zabi vows reprisals.', zeonProd: -0.05 },
  { day: 290, id: 'maychar', title: 'RED COMET SIGHTED', text: 'A crimson MS-06S has been reported hunting Federation aces in frontier space. Watch your back.', flag: 'charHunts' },
  { day: 312, id: 'odessa', title: 'OPERATION ODESSA', text: 'The Federation launches its grand counter-offensive against Zeon mining territories. Join the assault at any CONTESTED world for triple pay. Federation production surges.', fedProd: 0.5 },
  { day: 330, id: 'jaburo', title: 'ZEON ASSAULT REPELLED AT JABURO', text: 'Zeon\'s strike on Federation HQ fails. New GM lines reach full production — Federation garrisons strengthen.', fedProd: 0.3 },
  { day: 357, id: 'solomon', title: 'BATTLE OF SOLOMON', text: 'The Federation fleet storms the fortress of Solomon. The tide of the war has turned.', fedProd: 0.4, zeonProd: -0.2 },
  { day: 362, id: 'abq_warn', title: 'FINAL OPERATION ORDERS', text: 'All forces converge on A BAOA QU. Travel there and win the final battle to end the One Year War.', finale: true },
];

export const FINAL_DAY = 364; // Dec 31 — A Baoa Qu

// planet name generator parts
export const NAME_A = ['Ari', 'Bel', 'Cas', 'Dor', 'Eri', 'Fal', 'Gan', 'Hel', 'Ish', 'Jun', 'Kel', 'Lor', 'Mar', 'Nov', 'Ode', 'Pel', 'Quo', 'Ras', 'Sol', 'Tor', 'Ume', 'Ver', 'Wis', 'Xan', 'Yor', 'Zef'];
export const NAME_B = ['ana', 'bos', 'cara', 'dia', 'enne', 'fara', 'gora', 'hama', 'ina', 'kara', 'lios', 'mira', 'nara', 'osa', 'peia', 'ros', 'sara', 'tara', 'una', 'vera'];
export const NAME_C = ['', '', '', ' II', ' III', ' IV', ' Prime', ' Minor', ' Reach', ' Verge'];

// canonical anchor worlds (placed deterministically; rest of the 150 are procedural)
export const CANON_WORLDS = [
  // Earth begins the campaign under Zeon occupation — Operation Odessa liberates it
  { name: 'Earth',       type: 'planet',   control: 'ZEON', pop: 9000, x: 0,    z: 0,    fixed: { fed: 30, zeon: 85 } },
  { name: 'Luna — Granada', type: 'moon',  control: 'ZEON', pop: 900,  x: 60,   z: -45,  fixed: { fed: 10, zeon: 70 } },
  { name: 'Side 7',      type: 'colony',   control: 'FED',  pop: 300,  x: 230,  z: 180,  fixed: { fed: 30, zeon: 15 } },
  { name: 'Side 6 — Riah', type: 'colony', control: 'NEUTRAL', pop: 800, x: -150, z: 200, fixed: { fed: 5, zeon: 5 } },
  { name: 'Side 5 — Loum', type: 'colony', control: 'CONTESTED', pop: 200, x: -260, z: -60, fixed: { fed: 35, zeon: 35 } },
  { name: 'Side 3 — Zeon Homeland', type: 'colony', control: 'ZEON', pop: 1500, x: 120, z: -330, fixed: { fed: 5, zeon: 100 }, zeonHome: true },
  { name: 'Solomon',     type: 'fortress', control: 'ZEON', pop: 120,  x: -40,  z: -240, fixed: { fed: 10, zeon: 85 }, zeonHome: true },
  { name: 'A Baoa Qu',   type: 'fortress', control: 'ZEON', pop: 150,  x: 280,  z: -420, fixed: { fed: 5, zeon: 100 }, zeonHome: true, finale: true },
];
