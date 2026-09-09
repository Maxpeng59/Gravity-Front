import test from 'node:test';
import assert from 'node:assert/strict';
import { AIRCRAFT, SUITS, deriveUnitValue } from '../js/data.js';

test('every mobile suit and aircraft has a positive tactical value', () => {
  for (const unit of [...SUITS, ...AIRCRAFT]){
    assert.ok(Number.isFinite(unit.value) && unit.value > 0, unit.id);
    assert.equal(unit.value, deriveUnitValue(unit), unit.id);
  }
});

test('the free campaign Gundam is valued by combat capability, not zero purchase cost', () => {
  const gundam = SUITS.find(unit => unit.id === 'rx78');
  const gm = SUITS.find(unit => unit.id === 'gm');
  assert.ok(gundam.value > gm.value);
});
