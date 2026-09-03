import {
  canModifyWeapons, mobilityPercent, normalizeRestrictedWeaponLoadout, normalizeWeaponLoadout,
  weaponAimProfile, weaponLoadoutOptions, weaponLoadoutProfile,
} from './loadouts.js';

const node = (tag, cls, text = '') => {
  const element = document.createElement(tag);
  if (cls) element.className = cls;
  if (text) element.textContent = text;
  return element;
};

const loadClass = mobility => mobility >= 1.07 ? 'LIGHT LOAD' : mobility < 0.92 ? 'HEAVY LOAD' : 'MEDIUM LOAD';

function slot(container, label, value, empty = false){
  const row = node('div', `equipment-slot${empty ? ' empty' : ''}`);
  row.appendChild(node('span', 'equipment-slot-label', label));
  row.appendChild(node('b', 'equipment-slot-value', value));
  container.appendChild(row);
}

function action(label, selected, disabled, onClick){
  const button = node('button', `small equipment-action${selected ? ' equipped' : ''}`, selected ? 'EQUIPPED' : label);
  button.type = 'button';
  button.disabled = disabled || selected;
  button.onclick = event => { event.stopPropagation(); onClick(); };
  return button;
}

export function renderEquipmentPanel(container, suit, loadout, onChange, config = {}){
  container.replaceChildren();
  container.classList.toggle('fixed', !canModifyWeapons(suit));
  if (!canModifyWeapons(suit)){
    container.appendChild(node('div', 'equipment-fixed-title', 'FIXED ARMAMENT'));
    container.appendChild(node('div', 'equipment-fixed-copy', suit.air
      ? 'Aircraft weapon stations cannot be changed in the mobile-suit equipment bay.'
      : 'This specialist frame uses integrated weapons with no compatible hand-equipment slots.'));
    return;
  }

  const options = weaponLoadoutOptions(suit);
  const restricted = config.unlockedIds != null;
  const unlocked = config.unlockedIds instanceof Set ? config.unlockedIds : new Set(config.unlockedIds || []);
  const current = restricted
    ? normalizeRestrictedWeaponLoadout(suit, loadout, unlocked)
    : normalizeWeaponLoadout(suit, loadout);
  const profile = weaponLoadoutProfile(suit, current);
  const head = node('div', 'equipment-head');
  const title = node('div', 'equipment-title');
  title.appendChild(node('span', '', 'EQUIPMENT LOAD'));
  title.appendChild(node('b', '', `${profile.mass.toFixed(1)} t`));
  head.appendChild(title);
  const track = node('div', 'equipment-load-track');
  const fill = node('i');
  fill.style.width = `${Math.min(100, profile.mass / Math.max(1, profile.stockMass, 20) * 100)}%`;
  track.appendChild(fill); head.appendChild(track);
  head.appendChild(node('div', `equipment-burden ${loadClass(profile.mobility).toLowerCase().replaceAll(' ', '-')}`,
    `${loadClass(profile.mobility)} · MOVEMENT ${mobilityPercent(profile)}% · STOCK ${profile.stockMass.toFixed(1)} t`));
  container.appendChild(head);

  const slots = node('div', 'equipment-slots');
  slot(slots, 'RIGHT HAND', profile.stock ? 'STOCK COMPLETE RACK' : profile.primary.name);
  slot(slots, 'SUPPORT RACK', profile.stock ? 'INCLUDED IN STOCK RACK' : (profile.support?.name || '— EMPTY —'), !profile.stock && !profile.support);
  container.appendChild(slots);

  const inventoryTitle = node('div', 'equipment-inventory-title', 'ARMAMENT INVENTORY');
  container.appendChild(inventoryTitle);
  const inventory = node('div', 'equipment-inventory');

  const stock = node('div', `equipment-item${profile.stock ? ' selected' : ''}`);
  const stockCopy = node('div', 'equipment-item-copy');
  stockCopy.appendChild(node('b', '', 'STOCK COMPLETE RACK'));
  stockCopy.appendChild(node('span', '', `${profile.stockMass.toFixed(1)} t · factory configuration`));
  stock.appendChild(stockCopy);
  stock.appendChild(action('RESTORE', profile.stock, false, () => onChange(null)));
  inventory.appendChild(stock);

  const inventoryItems = [...options.primary, ...options.support.filter(item => !options.primary.some(primary => primary.id === item.id))];
  for (const item of inventoryItems){
    const inPrimary = current.primary === item.id;
    const inSupport = current.support === item.id;
    const locked = restricted && !unlocked.has(item.id);
    const card = node('div', `equipment-item${inPrimary || inSupport ? ' selected' : ''}${locked ? ' locked' : ''}`);
    const copy = node('div', 'equipment-item-copy');
    copy.appendChild(node('b', '', item.name));
    const w = item.weapon;
    const aim = weaponAimProfile(w);
    copy.appendChild(node('span', '', `${item.mass.toFixed(1)} t · ${String(w.type || 'weapon').toUpperCase()} · DMG ${w.dmg} · RNG ${w.pref || w.speed || '—'}${aim ? ` · ${aim.label} ×${aim.coefficient.toFixed(2)}` : ''}`));
    if (locked) copy.appendChild(node('span', 'equipment-lock-note', config.lockedLabel?.(item) || 'LOCKED · CLEAR A CAMPAIGN CHALLENGE RUN'));
    card.appendChild(copy);
    const actions = node('div', 'equipment-actions');
    if (item.slots.includes('primary')) actions.appendChild(action(locked ? 'LOCKED' : 'EQUIP R', inPrimary, locked, () => onChange({
        primary: item.id,
        support: current.support === 'stock' || current.support === item.id ? 'none' : current.support,
      })));
    if (item.slots.includes('support')) actions.appendChild(action(locked ? 'LOCKED' : 'EQUIP S', inSupport, locked || profile.stock || inPrimary, () => onChange({
      primary: current.primary,
      support: item.id,
    })));
    card.appendChild(actions); inventory.appendChild(card);
  }

  if (!profile.stock){
    const empty = node('div', `equipment-item support-empty${!profile.support ? ' selected' : ''}`);
    const copy = node('div', 'equipment-item-copy');
    copy.appendChild(node('b', '', 'EMPTY SUPPORT RACK'));
    copy.appendChild(node('span', '', '0.0 t · maximum mobility'));
    empty.appendChild(copy);
    empty.appendChild(action('UNEQUIP S', !profile.support, false, () => onChange({ primary: current.primary, support: 'none' })));
    inventory.appendChild(empty);
  }
  container.appendChild(inventory);
}
