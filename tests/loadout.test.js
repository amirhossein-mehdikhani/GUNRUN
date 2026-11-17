import test from 'node:test';
import assert from 'node:assert/strict';
import { validLoadout, fullMagazines, GUN_IDS } from '../public/js/loadout.js';
import { WEAPON_TYPES } from '../public/js/weapons.js';
import { OPERATORS } from '../public/js/operators.js';
import { resetInventory, switchGun, validateShot, startReload, finishReload } from '../server/combat.js';
import { validatePacket } from '../server/validation.js';
import { TriangleIndex } from '../public/js/spatial-index.js';

test('loadouts require exactly two distinct firearms and exclude the knife', () => {
  assert.equal(validLoadout([5,7]),true);
  for(const value of [[1],[1,1],[1,2,3],[1,4],['1',2],[1,99],null]) assert.equal(validLoadout(value),false);
  for(const a of GUN_IDS) for(const b of GUN_IDS.filter(id=>id!==a)) {
    const magazines=fullMagazines([a,b]);
    assert.equal(Object.keys(magazines).length,3);
    assert.equal(magazines[a],WEAPON_TYPES[a].maxAmmo);
    assert.equal(magazines[b],WEAPON_TYPES[b].maxAmmo);
  }
});
test('server refuses a third gun and refills only the chosen pair on respawn', () => {
  const player={id:'p',isAlive:true,loadout:[5,7],position:{x:0,y:1.6,z:0}};
  resetInventory(player);
  assert.equal(player.combat.slot,5);
  assert.equal(switchGun(player,8,1000),false);
  assert.equal(player.combat.slot,5);
  player.combat.slot=8;
  const room={status:'in-game',settings:{gameMode:'ffa'},players:{p:player}};
  assert.equal(validateShot(room,player,{weaponSlot:8,origin:player.position,direction:{x:0,y:0,z:1}},new TriangleIndex([]),2000),null);
  resetInventory(player); assert.deepEqual(Object.keys(player.combat.ammo).sort(),['4','5','7']);
});
test('new operators and loadouts survive input validation; invalid pairs are rejected', () => {
  for(const characterType of Object.keys(OPERATORS)) {
    const packet=['create-room',{characterType,loadout:[6,8]}];
    assert.equal(validatePacket(packet),true);assert.equal(packet[1].characterType,characterType);
  }
  assert.equal(validatePacket(['join-room',{roomId:'x',loadout:[5,5]}]),false);
});

test('every firearm can fire and reload with its own server-owned magazine and timing', () => {
  for (const id of GUN_IDS) {
    const player={id:'p',isAlive:true,loadout:[id,id===1?2:1],position:{x:0,y:1.6,z:0},rotation:{yaw:0}};
    resetInventory(player);
    const room={status:'in-game',settings:{gameMode:'ffa'},players:{p:player}};
    const shot=validateShot(room,player,{weaponSlot:id,origin:player.position,direction:{x:0,y:0,z:1}},new TriangleIndex([]),1000);
    assert.ok(shot,WEAPON_TYPES[id].name);
    assert.equal(player.combat.ammo[id],WEAPON_TYPES[id].maxAmmo-1);
    assert.equal(startReload(player,1100),true);
    finishReload(player,1100+WEAPON_TYPES[id].reloadDuration-1);
    assert.equal(player.combat.ammo[id],WEAPON_TYPES[id].maxAmmo-1);
    finishReload(player,1100+WEAPON_TYPES[id].reloadDuration);
    assert.equal(player.combat.ammo[id],WEAPON_TYPES[id].maxAmmo);
  }
});
