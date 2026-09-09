import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PVP_PLAYERS, PvpRoom, pvpSeatId, pvpSpawnPoint } from '../js/pvp.js';

test('browser PvP room exposes sixteen unique pilot seats', () => {
  assert.equal(MAX_PVP_PLAYERS, 16);
  const ids = Array.from({ length: MAX_PVP_PLAYERS }, (_, index) => pvpSeatId(index));
  assert.equal(new Set(ids).size, MAX_PVP_PLAYERS);
  assert.throws(() => pvpSeatId(MAX_PVP_PLAYERS), RangeError);
});

test('PvP spawns form separated rings on both selectable maps', () => {
  for (const mapId of ['clearcity', 'odessa']){
    const points = Array.from({ length: MAX_PVP_PLAYERS }, (_, index) => pvpSpawnPoint(index, MAX_PVP_PLAYERS, mapId));
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++)
      assert.ok(Math.hypot(points[i].x - points[j].x, points[i].z - points[j].z) > 300);
  }
});

test('host room relays one guest combat packet to every other guest with its sender seat', () => {
  class FakeLink extends EventTarget {
    constructor(){ super(); this.connected = true; this.sent = []; }
    send(message){ this.sent.push(message); }
  }
  const room = new PvpRoom('host');
  const a = new FakeLink(), b = new FakeLink(), c = new FakeLink();
  room._wire(a, 'pilot-2'); room._wire(b, 'pilot-3'); room._wire(c, 'pilot-4');
  room.links.set('pilot-2', a); room.links.set('pilot-3', b); room.links.set('pilot-4', c);
  room.beginBattle();
  let received = null;
  room.addEventListener('message', event => { received = event.detail; });
  a.dispatchEvent(new MessageEvent('message', { data: '' }));
  a.dispatchEvent(new CustomEvent('message', { detail: { type: 'state', seq: 7 } }));
  assert.equal(received.senderId, 'pilot-2');
  assert.equal(b.sent[0].senderId, 'pilot-2');
  assert.equal(c.sent[0].payload.seq, 7);
  assert.equal(a.sent.length, 0);
});
