import test from 'node:test';
import assert from 'node:assert/strict';
import {activateAbility,reduceAbilityDamage} from '../server/abilities.js';
import {resetInventory} from '../server/combat.js';
const player=(type,id='a')=>({id,characterType:type,isAlive:true,health:50,position:{x:0,y:1.6,z:0},team:'blue'});
const room=p=>({status:'in-game',settings:{gameMode:'ffa'},players:{[p.id]:p}});
test('healing caps at 100 and abilities enforce cooldown, death and match state',()=>{
  const p=player('ranger'),r=room(p);p.health=85;assert.equal(activateAbility(r,p,100).health,100);
  assert.equal(activateAbility(r,p,200),null);p.health=30;assert.equal(activateAbility(r,p,25100).health,60);
  p.isAlive=false;assert.equal(activateAbility(r,p,60000),null);p.isAlive=true;r.status='lobby';assert.equal(activateAbility(r,p,60000),null);
});
test('guard absorbs damage only during its duration and respawn preserves cooldown but clears armor',()=>{
  const p=player('sentinel');activateAbility(room(p),p,100);assert.equal(reduceAbilityDamage(p,100,200),75);
  assert.equal(reduceAbilityDamage(p,100,5100),100);resetInventory(p);assert.equal(p.ability.readyAt,22100);assert.equal(p.ability.activeUntil,0);
  const heavy=player('heavy');activateAbility(room(heavy),heavy,100);assert.equal(reduceAbilityDamage(heavy,100,200),60);
});
test('only Pathfinder reveals the nearest living enemy at unlimited range and returns a frozen position',()=>{
  const p=player('scout'),r=room(p);r.settings.gameMode='tdm';
  const enemy=player('ranger','b');enemy.team='red';const friend=player('ranger','c');const distant=player('ranger','d');distant.team='red';distant.position.x=20;
  r.players={a:p,b:enemy,c:friend,d:distant};const result=activateAbility(r,p,100);assert.equal(result.marks.length,1);
  enemy.position.x=5;assert.equal(result.marks[0].position.x,0);
  enemy.isAlive=false;distant.position.x=2000;p.ability=null;
  assert.equal(activateAbility(r,p,30000).marks[0].position.x,2000);
  distant.isAlive=false;p.ability=null;assert.equal(activateAbility(r,p,60000).marks.length,0);
  const guard=player('sentinel','e');r.players.e=guard;enemy.isAlive=true;
  assert.equal(activateAbility(r,guard,100).marks.length,0);
});
