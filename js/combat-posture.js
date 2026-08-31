export const KNEEL_TRANSITION_SECONDS = 2;

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export function advanceKneelBlend(value, target, dt){
  const step = Math.max(0, Number(dt) || 0) / KNEEL_TRANSITION_SECONDS;
  const current = clamp01(value);
  return target ? Math.min(1, current + step) : Math.max(0, current - step);
}

export function kneelSpreadMultiplier(blend){
  return 1 - clamp01(blend) * 0.58;
}

export function kneelAimErrorMultiplier(blend){
  return 1 - clamp01(blend) * 0.5;
}

export function kneelState(blend, target){
  const value = clamp01(blend);
  if (target && value < 1) return 'kneeling';
  if (!target && value > 0) return 'rising';
  return value >= 1 ? 'kneeling' : 'standing';
}

export function shouldAiKneel({
  range,
  preferredRange,
  currentlyKneeling = false,
  eligible = true,
  ranged = true,
  hasTarget = true,
  hasLineOfSight = true,
  repositioning = false,
  meleeRun = false,
} = {}){
  if (!eligible || !ranged || !hasTarget || !hasLineOfSight || repositioning || meleeRun) return false;
  const distance = Math.max(0, Number(range) || 0);
  const preferred = Math.max(1, Number(preferredRange) || 1);
  const near = currentlyKneeling ? 0.5 : 0.65;
  const far = currentlyKneeling ? 1.35 : 1.15;
  return distance >= preferred * near && distance <= preferred * far;
}
