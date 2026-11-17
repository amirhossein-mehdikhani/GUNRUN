import test from 'node:test';
import assert from 'node:assert/strict';
import { TriangleIndex } from '../public/js/spatial-index.js';
import { resetInventory, validateShot, startReload, switchGun, finishReload } from '../server/combat.js';

function fixture() {
  const shooter={id:'a',isAlive:true,position:{x:0,y:1.6,z:0},rotation:{yaw:0}};
  const victim={id:'b',isAlive:true,position:{x:0,y:1.6,z:5},rotation:{yaw:0}};
  resetInventory(shooter); resetInventory(victim);
  return {shooter,victim,room:{status:'in-game',settings:{gameMode:'ffa'},players:{a:shooter,b:victim}},
    data:{origin:{...shooter.position},direction:{x:0,y:0,z:1},weaponSlot:1,isHeadshot:false,hitPlayerId:'fake'},
    empty:new TriangleIndex(new Float32Array())};
}
test('server finds the actual victim/headshot and consumes ammo independently of claims', () => {
  const f=fixture(), hit=validateShot(f.room,f.shooter,f.data,f.empty,1000);
  assert.equal(hit.victim,f.victim); assert.equal(hit.headshot,true); assert.equal(hit.damage,100);
  assert.equal(f.shooter.combat.ammo[1],29);
  assert.equal(validateShot(f.room,f.shooter,f.data,f.empty,1050),null);
});
test('walls stop bullets on both windings and range limits prevent distant claims', () => {
  for (const coords of [[-5,-5,2,5,-5,2,0,10,2],[0,10,2,5,-5,2,-5,-5,2]]) {
    const f=fixture(), wall=new TriangleIndex(new Float32Array(coords));
    assert.equal(validateShot(f.room,f.shooter,f.data,wall,1000).victim,null);
  }
  const f=fixture(); f.victim.position.z=130;
  assert.equal(validateShot(f.room,f.shooter,f.data,f.empty,1000).victim,null);
});
test('rejects invalid origin, dead shooters, missing map data, wrong slot and empty magazines', () => {
  for (const mutate of [f=>f.data.origin.x=99,f=>f.shooter.isAlive=false,f=>f.data.weaponSlot=3,
    f=>f.shooter.combat.ammo[1]=0,f=>f.data.direction.x=NaN,f=>f.room.status='lobby']) {
    const f=fixture(); mutate(f); assert.equal(validateShot(f.room,f.shooter,f.data,f.empty,1000),null);
  }
  const f=fixture(); assert.equal(validateShot(f.room,f.shooter,f.data,null,1000),null);
});
test('reload timing is authoritative, switches cancel reload and respawn preserves selected gun', () => {
  const f=fixture(); f.shooter.combat.ammo[1]=0;
  assert.equal(startReload(f.shooter,1000),true);
  assert.equal(startReload(f.shooter,1001),false);
  finishReload(f.shooter,2499); assert.equal(f.shooter.combat.ammo[1],0);
  finishReload(f.shooter,2500); assert.equal(f.shooter.combat.ammo[1],30);
  f.shooter.combat.ammo[1]=4; startReload(f.shooter,3000); switchGun(f.shooter,3,3100);
  finishReload(f.shooter,5000); assert.equal(f.shooter.combat.ammo[1],4);
  resetInventory(f.shooter); assert.equal(f.shooter.combat.slot,3); assert.equal(f.shooter.combat.ammo[1],30);
});
test('friendly players block hits and rewind uses server history rather than client timestamp', () => {
  const f=fixture(); f.room.settings.gameMode='tdm'; f.shooter.team=f.victim.team='blue';
  assert.equal(validateShot(f.room,f.shooter,f.data,f.empty,1000).victim,null);
  f.room.settings.gameMode='ffa'; f.victim.history=[{time:900,position:{x:0,y:1.6,z:5},isCrouching:false}];
  f.victim.position.x=20;
  assert.equal(validateShot(f.room,f.shooter,f.data,f.empty,1200).victim,f.victim);
});
