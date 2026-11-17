import { finiteVector } from './combat.js';
export const FIRE_RADIUS=3.2, FIRE_DURATION=6;
export function acceptMolotov(player,data,index) {
  if(!player?.isAlive || !index || !player.combat || player.combat.molotov<=0 ||
    !finiteVector(data.origin) || !finiteVector(data.velocity) || typeof data.id!=='string' || data.id.length>64 ||
    Math.hypot(data.origin.x-player.position.x,data.origin.y-player.position.y,data.origin.z-player.position.z)>1.5 ||
    Math.hypot(data.velocity.x,data.velocity.y,data.velocity.z)>35) return false;
  const delta={x:data.origin.x-player.position.x,y:data.origin.y-player.position.y,z:data.origin.z-player.position.z};
  const length=Math.hypot(delta.x,delta.y,delta.z);
  if(length && index.raycast(player.position,{x:delta.x/length,y:delta.y/length,z:delta.z/length},length)!==null) return false;
  player.combat.molotov--; return true;
}
export function stepBottle(bottle,index,dt) {
  bottle.age+=dt;bottle.velocity.y-=(bottle.gravity??24)*dt;
  const speed=Math.hypot(bottle.velocity.x,bottle.velocity.y,bottle.velocity.z);
  const dir={x:bottle.velocity.x/speed,y:bottle.velocity.y/speed,z:bottle.velocity.z/speed};
  const hit=index.raycast(bottle.position,dir,speed*dt+.14);
  const distance=hit===null?speed*dt:Math.max(0,hit-.14);
  for(const axis of ['x','y','z']) bottle.position[axis]+=dir[axis]*distance;
  return hit!==null || bottle.age>=2.5;
}
export function inFire(position,victim,index) {
  const feet=victim.position.y-(victim.isCrouching?1.05:1.6);
  if(!victim.isAlive || Math.abs(feet-position.y)>1.2 || Math.hypot(victim.position.x-position.x,victim.position.z-position.z)>FIRE_RADIUS) return false;
  const origin={...position,y:position.y+.4};
  const delta={x:victim.position.x-origin.x,y:feet+.5-origin.y,z:victim.position.z-origin.z};
  const distance=Math.hypot(delta.x,delta.y,delta.z);
  return !distance || index.raycast(origin,{x:delta.x/distance,y:delta.y/distance,z:delta.z/distance},distance)===null;
}
