import { spawn } from 'node:child_process';
import { mkdtemp, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const binary = path.resolve('dist', process.env.BUILD_BINARY || 'fps-lan-server-win.exe');
const cwd = await mkdtemp(path.join(tmpdir(), 'rungun-smoke-'));
if (process.platform !== 'win32') await chmod(binary, 0o755);
const port = '31879';
const child = spawn(binary, [], { cwd, env: { ...process.env, PORT: port, NO_BROWSER: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
let spawnError;
child.on('error', error => { spawnError = error; });
child.stdout.on('data', data => { logs += data; });
child.stderr.on('data', data => { logs += data; });
let socket;
try {
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`Executable exited: ${child.exitCode}`);
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(1000) });
      ready = response.ok && (await response.text()).includes('RUNGUN');
      if (ready) break;
    } catch { /* Await startup. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, 'Standalone server did not start');
  for (const asset of ['/style.css', '/js/game.js', '/js/graphics.js', '/js/weapons.js', '/js/resources.js', '/js/spatial-index.js', '/assets/collision/dust2.bin', '/js/movement-buffer.js', '/socket.io/socket.io.js', '/node_modules/three/build/three.module.js', '/node_modules/three/examples/jsm/controls/PointerLockControls.js', '/assets/models/Soldier.glb', '/assets/models/Pathfinder.glb', '/assets/models/TitanMech.glb', '/assets/models/AnimationRig.glb', '/assets/models/VectorSMG.glb', '/assets/images/characters/cyborg.png', '/assets/images/characters/soldier.png', '/js/projectiles.js', '/js/model-utils.js', '/js/camera-motion.js', '/js/abilities.js', '/js/killhouse.js', '/assets/images/maps/killhouse.png', '/assets/collision/killhouse.bin']) {
    const response = await fetch(base + asset);
    assert.equal(response.status, 200, asset);
    assert.ok((await response.arrayBuffer()).byteLength > 100, `${asset} was empty`);
  }
  socket = io(base, { transports: ['websocket'], reconnection: false });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket ping timed out')), 5000);
    socket.on('connect', () => socket.emit('client-ping', 42));
    socket.on('server-pong', value => { clearTimeout(timer); value === 42 ? resolve() : reject(new Error('Invalid pong')); });
    socket.on('connect_error', error => { clearTimeout(timer); reject(error); });
  });
  // Match start must succeed with embedded server collision data, not just static assets.
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Packaged match start timed out')), 5000);
    socket.on('room-created', () => socket.emit('start-match'));
    socket.on('join-error', error => { clearTimeout(timer); reject(new Error(error)); });
    socket.on('match-started', () => { clearTimeout(timer); resolve(); });
    socket.emit('create-room', {playerName:'Smoke test',characterType:'sentinel',settings:{mapId:'killhouse'}});
  });
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Packaged ability activation timed out')),5000);
    socket.once('ability-state',data=>{clearTimeout(timer);data.name==='Guard'?resolve():reject(new Error('Invalid packaged ability'));});
    socket.emit('use-ability');
  });
  console.log('Standalone binary: HTTP, embedded assets and WebSocket passed.');
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  socket?.disconnect();
  if (child.exitCode === null && !spawnError) {
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill();
    await exited;
  }
  await rm(cwd, { recursive: true, force: true });
}
