import { allowedWeapon, fullMagazines, playerLoadout } from '../public/js/loadout.js';
import { TriangleIndex } from '../public/js/spatial-index.js';
import { WEAPON_TYPES } from '../public/js/weapons.js';

export const finiteVector = v => v && [v.x, v.y, v.z].every(n => Number.isFinite(n) && Math.abs(n) < 10000);
const distance = (a, b) => Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z);
export function resetInventory(player, slot = player.combat?.slot || playerLoadout(player.loadout)[0]) {
  if (!allowedWeapon(player,slot)) slot = playerLoadout(player.loadout)[0];
  player.combat = { slot, ammo: fullMagazines(player.loadout), nextShot: 0, switchUntil: 0, reload: null };
  player.history = [];
  player.lastMove = null;
  player.safePosition = null;
}
export function finishReload(player, now) {
  const state = player.combat;
  if (state?.reload && now >= state.reload.until) {
    state.ammo[state.reload.slot] = WEAPON_TYPES[state.reload.slot].maxAmmo;
    state.reload = null;
  }
}
export function startReload(player, now) {
  const state = player.combat;
  if (!state || !player.isAlive) return false;
  finishReload(player, now);
  const config = WEAPON_TYPES[state.slot];
  if (config.isMelee || state.reload || now < state.switchUntil || state.ammo[state.slot] === config.maxAmmo) return false;
  state.reload = { slot: state.slot, until: now + config.reloadDuration };
  return true;
}
export function switchGun(player, slot, now) {
  if (!WEAPON_TYPES[slot] || !player.combat || !allowedWeapon(player,slot)) return false;
  finishReload(player, now);
  if (player.combat.slot === slot) return;
  player.combat.reload = null;
  player.combat.slot = slot;
  player.combat.switchUntil = now + 120;
  return true;
}

function boxHit(o, d, min, max, limit) {
  let near = 0, far = limit;
  for (const axis of ['x','y','z']) {
    if (Math.abs(d[axis]) < 1e-10) { if (o[axis] < min[axis] || o[axis] > max[axis]) return null; }
    else {
      let a=(min[axis]-o[axis])/d[axis], b=(max[axis]-o[axis])/d[axis];
      if(a>b) [a,b]=[b,a]; near=Math.max(near,a); far=Math.min(far,b);
      if(near>far) return null;
    }
  }
  return near;
}

export function validateShot(room, shooter, data, index, now = performance.now()) {
  if (room.status !== 'in-game' || !shooter.isAlive || !shooter.combat || !index ||
    !finiteVector(data?.direction) || !finiteVector(data?.origin)) return null;
  const state = shooter.combat;
  finishReload(shooter, now);
  const config = WEAPON_TYPES[state.slot];
  if (!allowedWeapon(shooter,data.weaponSlot) || data.weaponSlot !== state.slot || state.reload || now < state.switchUntil || now < state.nextShot || state.ammo[state.slot] <= 0) return null;
  if (distance(data.origin, shooter.position) > 1.5) return null;
  const len = Math.hypot(data.direction.x, data.direction.y, data.direction.z);
  if (len < 0.99 || len > 1.01) return null;
  const direction = {x:data.direction.x/len,y:data.direction.y/len,z:data.direction.z/len};
  // Allow modest network timing differences while rejecting backward/sideways forged rays.
  const yaw = shooter.rotation?.yaw || 0;
  if (Math.abs(direction.y) < 0.98 && (Math.sin(yaw)*direction.x + Math.cos(yaw)*direction.z) < -0.1) return null;
  const origin = {...shooter.position};
  state.nextShot = now + config.fireRate - 10;
  if (!config.isMelee) state.ammo[state.slot]--;
  let nearest = index.raycast(origin, direction, config.range) ?? config.range;
  let victim = null, headshot = false;
  for (const target of Object.values(room.players)) {
    if (target.id === shooter.id || !target.isAlive) continue;
    // Fixed server-controlled rewind matches the browser's 75ms interpolation delay.
    const history = target.history || [];
    const pose = history.findLast(p => p.time <= now - 75) || target;
    const p = pose.position;
    const scale = pose.isCrouching ? 0.625 : 1;
    const feet = p.y - 1.6 * scale;
    const body = boxHit(origin, direction, {x:p.x-.42,y:feet,z:p.z-.42}, {x:p.x+.42,y:p.y-.15*scale,z:p.z+.42}, nearest);
    const center = {x:p.x,y:p.y+.03*scale,z:p.z};
    const ox=origin.x-center.x, oy=(origin.y-center.y)/scale, oz=origin.z-center.z;
    const dy=direction.y/scale;
    const a=direction.x**2+dy**2+direction.z**2;
    const b=ox*direction.x+oy*dy+oz*direction.z;
    const discriminant=b*b-a*(ox*ox+oy*oy+oz*oz-.25**2);
    const head = discriminant >= 0 ? (-b-Math.sqrt(discriminant))/a : -1;
    const hitHead = head >= 0 && head < nearest && (body === null || head <= body);
    const hit = hitHead ? head : body;
    if (hit !== null && hit >= 0 && hit < nearest - 0.001) {
      nearest = hit; victim = target; headshot = hitHead;
    }
  }
  if (victim && room.settings.gameMode === 'tdm' && shooter.team === victim.team) victim = null;
  const backstab = config.isMelee && victim &&
    (Math.sin(victim.rotation?.yaw || 0)*direction.x+Math.cos(victim.rotation?.yaw || 0)*direction.z) > .5;
  return { victim, headshot, damage: headshot || backstab ? config.damageHead : config.damageBody,
    weaponName: config.name, slot: state.slot, origin, direction,
    hitPoint: {x:origin.x+direction.x*nearest,y:origin.y+direction.y*nearest,z:origin.z+direction.z*nearest} };
}

export async function loadCollisionIndexes(publicPath, readFile) {
  const indexes = new Map();
  await Promise.all(['dust2','stalkyard','turbine','frenzy','italy'].map(async id => {
    const bytes = await readFile(`${publicPath}/assets/collision/${id}.bin`);
    indexes.set(id, new TriangleIndex(new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))));
  }));
  return indexes;
}
