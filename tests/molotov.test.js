import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptMolotov,stepBottle,inFire} from '../server/molotov.js';
import {resetInventory} from '../server/combat.js';
const clear={raycast:()=>null};
const player=()=>({isAlive:true,position:{x:0,y:1.6,z:0},loadout:[1,5]});
test('Molotov supply is limited to two per life and rejects invalid or obstructed throws',()=>{
  const p=player();resetInventory(p);const data={id:'bottle',origin:{...p.position},velocity:{x:0,y:3,z:22}};
  assert.equal(acceptMolotov(p,{...data,origin:{x:5,y:1.6,z:0}},clear),false);
  assert.equal(acceptMolotov(p,{...data,velocity:{x:0,y:100,z:0}},clear),false);
  assert.equal(acceptMolotov(p,{...data,origin:{x:0,y:1.6,z:.5}},{raycast:()=>.2}),false);
  assert.equal(acceptMolotov(p,data,clear),true);assert.equal(acceptMolotov(p,data,clear),true);
  assert.equal(acceptMolotov(p,data,clear),false);resetInventory(p);assert.equal(p.combat.molotov,2);
  p.isAlive=false;assert.equal(acceptMolotov(p,data,clear),false);
});
test('server bottle sweeps stop at walls and detonate at the fuse limit',()=>{
  const b={position:{x:0,y:1,z:0},velocity:{x:0,y:0,z:22},age:0};
  assert.equal(stepBottle(b,{raycast:()=>.3},1/30),true);
  assert.ok(b.position.z<.3);
  const fuse={position:{x:0,y:10,z:0},velocity:{x:0,y:1,z:22},age:2.49};
  assert.equal(stepBottle(fuse,clear,1/30),true);
});
test('fire excludes distant, dead, elevated and wall-shielded players',()=>{
  const p=player(), fire={x:0,y:.03,z:0};assert.equal(inFire(fire,p,clear),true);
  assert.equal(inFire(fire,p,{raycast:()=>.1}),false);
  p.position.x=4;assert.equal(inFire(fire,p,clear),false);
  p.position.x=0;p.position.y=5;assert.equal(inFire(fire,p,clear),false);
  p.position.y=1.6;p.isAlive=false;assert.equal(inFire(fire,p,clear),false);
});
