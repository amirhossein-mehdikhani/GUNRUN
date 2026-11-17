import {ABILITIES} from '../public/js/abilities.js';
export function activateAbility(room,player,now=performance.now()) {
  const spec=ABILITIES[player?.characterType];
  if(room.status!=='in-game' || !player?.isAlive || !spec || now<(player.ability?.readyAt??0) || (spec.heal && player.health>=100)) return null;
  player.ability={readyAt:now+spec.cooldown*1000,activeUntil:now+spec.duration*1000};
  if(spec.heal) player.health=Math.min(100,player.health+spec.heal);
  const marks=player.characterType==='scout'?Object.values(room.players).filter(other=>other.id!==player.id && other.isAlive &&
    !(room.settings.gameMode==='tdm' && other.team===player.team) && Math.hypot(other.position.x-player.position.x,other.position.y-player.position.y,other.position.z-player.position.z)<=18)
    .map(other=>({position:{...other.position}})):[];
  return {name:spec.name,cooldown:spec.cooldown,duration:spec.duration,health:player.health,marks};
}
export function reduceAbilityDamage(player,damage,now=performance.now()) {
  const spec=ABILITIES[player.characterType];
  return spec?.reduction && player.ability?.activeUntil>now?Math.max(damage>0?1:0,Math.round(damage*(1-spec.reduction))):damage;
}
