import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import { io } from 'socket.io-client';

let server, base, logs='', host, guest;
function event(socket, name, timeout=5000) {
  return new Promise((resolve,reject) => {
    const listener=value=>{clearTimeout(timer);resolve(value);};
    const timer=setTimeout(()=>{socket.off(name,listener);reject(new Error(`Timed out: ${name}\n${logs}`));},timeout);
    socket.once(name,listener);
  });
}
before(async () => {
  const reservation=net.createServer(); reservation.listen(0,'127.0.0.1'); await once(reservation,'listening');
  const port=reservation.address().port; await new Promise(resolve=>reservation.close(resolve));
  base=`http://127.0.0.1:${port}`;
  server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),NO_BROWSER:'1'},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',d=>logs+=d); server.stderr.on('data',d=>logs+=d);
  for(let i=0;i<100;i++) {
    try { if((await fetch(base)).ok) return; } catch {}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error(logs);
});
after(async () => {
  host?.disconnect(); guest?.disconnect();
  if(server && server.exitCode===null) { const ended=once(server,'exit');server.kill();await ended; }
});

test('async assets return valid bytes, ETags, HEAD and reject traversal/preview writes', async () => {
  const response=await fetch(base+'/js/game.js'); const text=await response.text();
  assert.equal(response.status,200); assert.ok(text.includes('GameApp'));
  const cached=await fetch(base+'/js/game.js',{headers:{'If-None-Match':response.headers.get('etag')}});
  assert.equal(cached.status,304);
  const head=await fetch(base+'/js/game.js',{method:'HEAD'});
  assert.equal(Number(head.headers.get('content-length')),Buffer.byteLength(text)); assert.equal(await head.text(),'');
  assert.equal((await fetch(base+'/%2e%2e%2fserver.js')).status,400);
  assert.equal((await fetch(base+'/api/save-preview',{method:'POST'})).status,404);
  assert.equal((await fetch(base+'/missing-file.js')).status,404);
});

test('room validation, active match, malformed packets, concurrent asset loading and session recovery', async () => {
  host=io(base,{autoConnect:false,transports:['websocket'],reconnectionDelay:20});
  guest=io(base,{autoConnect:false,transports:['websocket'],reconnectionDelay:20});
  const connected=[event(host,'connect'),event(guest,'connect')]; host.connect();guest.connect(); await Promise.all(connected);
  let pending=event(host,'room-created');
  host.emit('create-room',{playerName:42,roomName:'<img> Test',playerColor:'bad',loadout:[1,5],settings:{mapId:'INVALID',scoreLimit:'NaN'}});
  const created=await pending; assert.equal(created.room.settings.mapId,'dust2'); assert.equal(created.room.hostName,'Player');
  pending=event(guest,'room-joined'); guest.emit('join-room',{roomId:created.room.id,playerName:'Guest'}); await pending;
  // Collision indexes build during server startup; by this point they must be ready.
  pending=event(host,'match-started'); host.emit('start-match'); const match=await pending;
  const fired=event(guest,'player-shot-effect');
  host.emit('player-shoot',{origin:match.room.players[host.id].position,direction:{x:0,y:1,z:0},weaponSlot:1,hitPlayerId:guest.id,isHeadshot:true});
  assert.equal((await fired).shooterId,host.id);
  pending=event(host,'movement-corrected');
  host.emit('player-movement',{position:{x:999,y:999,z:999},rotation:{yaw:0,pitch:0}});
  assert.deepEqual((await pending).position,match.room.players[host.id].position);
  for(const type of ['create-room','update-room-settings','player-shoot','grenade-explode','weapon-switch']) host.emit(type,null);
  const downloads=Array.from({length:8},()=>fetch(base+'/assets/models/de_dust2_-_cs_map.glb').then(r=>r.arrayBuffer()));
  pending=event(host,'server-pong'); host.emit('client-ping',123); assert.equal(await pending,123); await Promise.all(downloads);
  const oldId=host.id;
  pending=event(host,'session-restored'); host.io.engine.close();
  const restored=await pending;
  assert.equal(host.id,oldId); assert.equal(restored.playerId,oldId); assert.equal(restored.room.status,'in-game');
  assert.ok(restored.room.players[oldId]); assert.equal(host.recovered,true);
  assert.equal(restored.room.players[oldId].combat.ammo[1],29);
  assert.deepEqual(restored.room.players[oldId].loadout,[1,5]);
  assert.equal(restored.room.players[oldId].combat.ammo[5],32);
  assert.equal(restored.room.players[oldId].combat.ammo[2],undefined);
  assert.equal(restored.room.players[guest.id].health,100,'Forged headshot claim applied');
  // Server owns Molotov flight, ignition and supply, and broadcasts it to both clients.
  const origin=restored.room.players[oldId].position;
  const ignited=event(host,'molotov-ignited');
  const relayed=event(guest,'projectile-thrown');
  host.emit('throw-projectile',{id:'test-fire',type:'molotov',origin,velocity:{x:0,y:-4,z:0}});
  assert.equal((await relayed).type,'molotov');
  const fire=await ignited;assert.equal(fire.id,'test-fire');assert.equal(fire.duration,6);assert.equal(fire.radius,3.2);
  const damaged=await event(host,'player-damaged');assert.equal(damaged.damage,12);
  pending=event(guest,'player-left-room'); host.emit('leave-room'); assert.equal((await pending).playerId,oldId);
});
