// ---------- mission objectives ----------
// Pure rules for the staged contract types and the optional secondary objectives that ride on every
// campaign contract. The battle engine owns spawning and rendering; this module owns the bookkeeping,
// so the rules can be unit-tested without a WebGL context.
//
// Staged contract types
//   recon         survey three sites (hold inside each scan radius), then reach the extraction point
//   sabotage      plant demolition charges on each target (hold beside it), then clear the blast
//   extraction    reach a downed pilot, hold the landing zone until the rescue craft arrives
//   breakthrough  three-phase push: silence the AA sites → hold the drop zone → kill the commander

export const STAGED_MISSION_TYPES = Object.freeze(['recon', 'sabotage', 'extraction', 'breakthrough']);
export const isStagedMission = type => STAGED_MISSION_TYPES.includes(type);

export const OBJECTIVE_TUNING = Object.freeze({
  scanRadius: 150,        // metres from a survey site where the sensors resolve it
  scanTime: 4.5,          // seconds of dwell to complete a survey
  extractRadius: 130,
  plantRadius: 70,        // metres from a target to set charges
  plantTime: 5,           // seconds of work per target
  plantMaxSpeed: 18,      // m/s — the suit must be nearly still to place charges
  fuseTime: 12,           // seconds from the last charge to detonation
  blastSafeDistance: 220, // metres the player should be clear of any charge at detonation
  pilotRadius: 140,       // metres from the downed pilot that counts as "on site"
  lzHoldTime: 60,         // seconds to hold the landing zone for the rescue craft
  dropHoldTime: 45,       // seconds to hold the breakthrough drop zone
  dropRadius: 220,
});

// Hold-to-progress: progress only builds while the condition holds and never regresses, so a pilot
// who is driven off a site can come back and finish the job.
export function advanceHold(progress, { inside, dt, duration }){
  if (!inside || !(duration > 0)) return Math.min(1, Math.max(0, progress || 0));
  return Math.min(1, Math.max(0, progress || 0) + dt / duration);
}

// Stage lists drive the HUD line and the win/lose check.
export function missionStages(type){
  switch (type){
    case 'recon': return ['survey', 'exfil'];
    case 'sabotage': return ['plant', 'fuse'];
    case 'extraction': return ['reach', 'hold'];
    case 'breakthrough': return ['aa', 'drop', 'commander'];
    default: return [];
  }
}

export const STAGE_LABELS = Object.freeze({
  survey: 'SURVEY THE SITES',
  exfil: 'RETURN TO THE EXTRACTION POINT',
  plant: 'SET DEMOLITION CHARGES',
  fuse: 'CHARGES ARMED — CLEAR THE BLAST ZONE',
  reach: 'REACH THE DOWNED PILOT',
  hold: 'HOLD THE LANDING ZONE',
  aa: 'SILENCE THE AA SITES',
  drop: 'HOLD THE DROP ZONE',
  commander: 'KILL THE SECTOR COMMANDER',
});

export function stageLabel(stage){ return STAGE_LABELS[stage] || String(stage || '').toUpperCase(); }

// ---------- secondary objectives ----------
// Optional goals printed on the contract card. Each one met adds a share of the base pay.
export const SECONDARY_CATALOG = Object.freeze({
  integrity: { bonus: 0.15, label: t => `FINISH ABOVE ${t}% INTEGRITY` },
  wing:      { bonus: 0.15, label: () => 'BRING EVERY WINGMAN HOME' },
  clock:     { bonus: 0.2,  label: t => `COMPLETE WITHIN ${formatClock(t)}` },
  aces:      { bonus: 0.2,  label: () => 'DOWN EVERY ENEMY ACE' },
});

export function formatClock(seconds){
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Mission types where finishing fast is in the pilot's hands (not a fixed hold timer or a
// grand battle whose pace is set by the armies).
const CLOCKABLE = new Set(['destroy', 'assault', 'ambush', 'hunt', 'shipkill', 'recon', 'sabotage', 'breakthrough']);

// Deterministic pick of up to two secondaries for a contract. `random` is a () => [0,1) source.
export function pickSecondaries(contract, random = Math.random){
  const mission = contract?.mission || {};
  const type = mission.type || 'destroy';
  // multi-phase operations settle through their own hand-built results, so they carry no bonus goals
  if (['odessa', 'fleet', 'pvp', 'invasion'].includes(type) || mission.challenge) return [];
  const enemies = contract?.enemies || [];
  const danger = contract?.danger || 2;
  const pool = [];
  pool.push({ id: 'integrity', target: danger >= 4 ? 40 : danger >= 3 ? 50 : 65 });
  if (!mission.solo) pool.push({ id: 'wing' });
  if (CLOCKABLE.has(type)){
    const base = type === 'recon' ? 240 : type === 'sabotage' ? 270 : type === 'breakthrough' ? 420 : 120;
    pool.push({ id: 'clock', target: Math.round((base + enemies.length * 22) / 15) * 15 });
  }
  const aces = enemies.filter(e => e && typeof e === 'object' && e.ace && !e.vip).length;
  if (aces > 0) pool.push({ id: 'aces' });
  // shuffle deterministically, keep two
  for (let i = pool.length - 1; i > 0; i--){
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 2).map(s => ({ ...s, label: SECONDARY_CATALOG[s.id].label(s.target) }));
}

// Evaluate secondaries against a battle result:
//   { victory, hpFrac, wingLost, wingTotal, elapsed, acesTotal, acesDown }
export function evaluateSecondaries(list, result){
  return (list || []).map(s => {
    const spec = SECONDARY_CATALOG[s.id];
    let met = false;
    if (result?.victory){
      switch (s.id){
        case 'integrity': met = (result.hpFrac ?? 0) * 100 >= s.target; break;
        case 'wing': met = (result.wingLost ?? 0) === 0; break;
        case 'clock': met = (result.elapsed ?? Infinity) <= s.target; break;
        case 'aces': met = (result.acesTotal ?? 0) > 0 && (result.acesDown ?? 0) >= result.acesTotal; break;
      }
    }
    return { id: s.id, label: s.label || spec?.label(s.target) || s.id, target: s.target, met, bonus: spec?.bonus || 0 };
  });
}

export function secondaryPay(pay, evaluated){
  const share = (evaluated || []).reduce((sum, e) => sum + (e.met ? e.bonus : 0), 0);
  return Math.round((pay || 0) * share);
}
