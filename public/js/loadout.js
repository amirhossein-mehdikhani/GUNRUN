import { WEAPON_TYPES } from './weapons.js';
export const GUN_IDS = [1,2,3,5,6,7,8];
export function validLoadout(value) {
  return Array.isArray(value) && value.length === 2 && value[0] !== value[1] && value.every(id => GUN_IDS.includes(id));
}
export function playerLoadout(value) { return validLoadout(value) ? [...value] : [1,2]; }
export function allowedWeapon(player, id) { return id === 4 || playerLoadout(player.loadout).includes(id); }
export function fullMagazines(loadout) {
  return Object.fromEntries([...playerLoadout(loadout),4].map(id=>[id,WEAPON_TYPES[id].maxAmmo]));
}
