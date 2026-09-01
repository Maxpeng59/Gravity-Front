export const HOVER_CRAFT_MAX_HP = 5000;
export const HOVER_CRAFT_EXPLOSION_DAMAGE = 900;
export const HOVER_CRAFT_EXPLOSION_RADIUS = 24;

const UNSUPPORTED_STYLES = new Set(['tank', 'guntank', 'zakutank', 'crane', 'apc', 'fighter']);

// The support deck is built for standing mobile suits. Aircraft, wheeled armor,
// tracked chassis and the RTX crane/guntank families cannot mount its foot locks.
export function canUseHoverCraft(suit){
  return !!suit && !suit.air && !suit.vehicle && !UNSUPPORTED_STYLES.has(suit.style);
}

export function hoverCraftEquipped(suit, selected){
  return canUseHoverCraft(suit) && selected === true;
}

export function hoverCraftSpaceCapable(suit, selected){
  return !suit?.groundOnly || hoverCraftEquipped(suit, selected);
}
