const clean = value => String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();

export function formatKillNotice(killer, weapon, victim){
  return `${clean(killer) || 'UNKNOWN'} killed (${clean(weapon) || 'UNKNOWN WEAPON'}) ${clean(victim) || 'UNKNOWN'}`;
}
