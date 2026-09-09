import test from 'node:test';
import assert from 'node:assert/strict';
import { formatKillNotice } from '../js/kill-feed.js';

test('kill notice uses the compact killer, weapon, victim grammar', () => {
  assert.equal(formatKillNotice('AMURO', 'BEAM RIFLE', 'CHAR'), 'AMURO killed (BEAM RIFLE) CHAR');
});
