import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOVER_CRAFT_MAX_HP,
  HOVER_CRAFT_EXPLOSION_DAMAGE,
  HOVER_CRAFT_EXPLOSION_RADIUS,
  canUseHoverCraft,
  hoverCraftEquipped,
  hoverCraftSpaceCapable,
} from '../js/hovercraft.js';

test('hover craft has the requested independent health and a damaging blast', () => {
  assert.equal(HOVER_CRAFT_MAX_HP, 5000);
  assert.ok(HOVER_CRAFT_EXPLOSION_DAMAGE > 0);
  assert.ok(HOVER_CRAFT_EXPLOSION_RADIUS > 0);
});

test('standing mobile suits can equip the craft while vehicles and aircraft cannot', () => {
  assert.equal(canUseHoverCraft({ style: 'gm' }), true);
  assert.equal(canUseHoverCraft({ style: 'gouf', groundOnly: true }), true);
  assert.equal(canUseHoverCraft({ style: 'tank' }), false);
  assert.equal(canUseHoverCraft({ style: 'apc', vehicle: true }), false);
  assert.equal(canUseHoverCraft({ style: 'fighter', air: true }), false);
});

test('an equipped craft allows a ground-only mobile suit to launch in space', () => {
  const gouf = { style: 'gouf', groundOnly: true };
  assert.equal(hoverCraftSpaceCapable(gouf, false), false);
  assert.equal(hoverCraftSpaceCapable(gouf, true), true);
  assert.equal(hoverCraftEquipped({ style: 'tank' }, true), false);
});
