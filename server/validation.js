import { validLoadout } from '../public/js/loadout.js';
import { OPERATORS } from '../public/js/operators.js';
import { WEAPON_TYPES } from '../public/js/weapons.js';
import {PLAYABLE_MAPS} from '../public/js/arena-catalog.js';
const maps = [...PLAYABLE_MAPS, 'shuffle'];
export const cleanName = (value, fallback, length) => typeof value === 'string'
  ? value.replace(/[<>\x00-\x1f\x7f]/g, '').trim().slice(0,length) || fallback : fallback;
export function cleanSettings(value = {}) {
  const result = {};
  if (!value || typeof value !== 'object') return result;
  if (maps.includes(value.mapId)) result.mapId = value.mapId;
  if (['ffa','tdm','zombies'].includes(value.gameMode)) result.gameMode = value.gameMode;
  if (['easy','normal','hard'].includes(value.zombieDifficulty)) result.zombieDifficulty = value.zombieDifficulty;
  if (['normal','low','antigravity'].includes(value.gravity)) result.gravity = value.gravity;
  if (Number.isFinite(value.scoreLimit) || (typeof value.scoreLimit === 'string' && /^\d+$/.test(value.scoreLimit))) {
    result.scoreLimit = Math.min(50,Math.max(5,Number(value.scoreLimit)));
  }
  return result;
}
export function validatePacket(packet) {
  const [event, payload] = packet;
  if (['create-room','join-room','update-room-settings','switch-team','weapon-switch','player-movement','player-shoot','throw-projectile','grenade-explode','flash-detonate'].includes(event)) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  }
  if (event === 'create-room' || event === 'join-room') {
    payload.playerName = cleanName(payload.playerName,'Player',16);
    payload.roomName = cleanName(payload.roomName,'Tactical Arena',24);
    payload.playerColor = typeof payload.playerColor === 'string' && /^#[a-fA-F0-9]{6}$/.test(payload.playerColor) ? payload.playerColor : '#3b82f6';
    if (payload.loadout !== undefined && !validLoadout(payload.loadout)) return false;
    payload.characterType = typeof payload.characterType === 'string' && Object.hasOwn(OPERATORS,payload.characterType) ? payload.characterType : 'soldier';
  }
  if (event === 'create-room' || event === 'update-room-settings') payload.settings = cleanSettings(payload.settings);
  if (event === 'join-room' && (typeof payload.roomId !== 'string' || payload.roomId.length > 40)) return false;
  if (event === 'weapon-switch' && (!Number.isInteger(payload.slot) || !Object.hasOwn(WEAPON_TYPES,payload.slot))) return false;
  return true;
}
