import test from 'node:test';
import assert from 'node:assert/strict';
import { genGalaxy, materialize, clearDetails } from '../js/galaxy.js';
import { START_DAY } from '../js/data.js';
import { suitById } from '../js/data.js';
import { isStagedMission } from '../js/mission-objectives.js';

test('campaign boards offer the staged operations with valid rosters and bonus goals', () => {
  const kinds = new Set();
  for (let seed = 0; seed < 6; seed++){
    clearDetails();
    const S = { seed: `contracts-${seed}`, day: START_DAY + seed * 20, flags: {}, mods: { fed: 1, zeon: 1 }, worlds: genGalaxy(`contracts-${seed}`) };
    for (const w of S.worlds){
      const d = materialize(S, w);
      for (const c of d.contracts){
        assert.ok(Array.isArray(c.secondary), c.kind);
        for (const g of c.secondary) assert.ok(g.label, c.kind);
        if (!isStagedMission(c.mission?.type)) continue;
        kinds.add(c.mission.type);
        assert.ok(c.enemies.length > 0, c.kind);
        for (const e of c.enemies) assert.ok(suitById(e.suitId), `${c.kind}: ${e.suitId}`);
        if (['sabotage', 'extraction', 'breakthrough'].includes(c.mission.type)) assert.equal(c.env, 'ground');
        assert.ok(c.pay > 0 && c.desc.length > 80);
      }
    }
  }
  for (const type of ['recon', 'sabotage', 'extraction', 'breakthrough']) assert.ok(kinds.has(type), `no ${type} contract generated`);
});
