import {EXTRA_ARENAS, PLAYABLE_MAPS, arenaSpawns} from './public/js/arena-catalog.js';
import {activateAbility,reduceAbilityDamage} from './server/abilities.js';
import {KILLHOUSE_SPAWNS} from './public/js/killhouse-spawns.js';
import { acceptMolotov, stepBottle, inFire, FIRE_RADIUS, FIRE_DURATION } from './server/molotov.js';
import { playerLoadout, allowedWeapon } from './public/js/loadout.js';
// server.js - RUNGUN LAN Multiplayer FPS Server
import express from 'express';
import { assetHandler } from './server/assets.js';
import { validatePacket } from './server/validation.js';
import { resetInventory, finishReload, startReload, switchGun, validateShot, loadCollisionIndexes, finiteVector } from './server/combat.js';
import http from 'node:http';
import { Server } from 'socket.io';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const isPkg = typeof process.pkg !== 'undefined';
const exeDir = path.dirname(process.execPath);
let appDir;
try {
  appDir = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
} catch {
  appDir = process.cwd();
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 64 * 1024,
  connectionStateRecovery: { maxDisconnectionDuration: 30000, skipMiddlewares: false }
});

const PORT = process.env.PORT || 3000;

// Helper to resolve static directories whether running from source or inside packaged pkg binary
function resolveAssetPath(...subpaths) {
  // 1. Snapshot path (__dirname / virtual snapshot)
  const insideSnapshot = path.join(appDir, ...subpaths);
  if (fs.existsSync(insideSnapshot)) {
    return insideSnapshot;
  }
  // 2. Next to executable (portable launcher or dist directory)
  const nextToExe = path.join(exeDir, ...subpaths);
  if (fs.existsSync(nextToExe)) {
    return nextToExe;
  }
  // 3. Current working directory
  const inCwd = path.join(process.cwd(), ...subpaths);
  if (fs.existsSync(inCwd)) {
    return inCwd;
  }
  return insideSnapshot;
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.map': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const publicPath = resolveAssetPath('public');
const collisionReady = loadCollisionIndexes(publicPath, fs.promises.readFile);
let collisionIndexes = null;
collisionReady.then(value => { collisionIndexes = value; }).catch(error => console.error('Collision data unavailable:', error.message));
app.get('/socket.io/socket.io.js', assetHandler(publicPath, mimeTypes, () => '/js/socket.io.min.js'));
app.use('/node_modules/three', assetHandler(resolveAssetPath('node_modules', 'three'), mimeTypes));
app.use('/node_modules/three', assetHandler(path.join(publicPath, 'vendor', 'three'), mimeTypes, value => value.replace('/examples/jsm/', '/jsm/')));
app.use(assetHandler(publicPath, mimeTypes));

// API endpoint to give client the exact LAN IPs
app.get('/api/lan-info', (req, res) => {
  res.json({
    port: PORT,
    addresses: getLanIpAddresses()
  });
});

// Thumbnail writing is a local development tool, disabled for distributed builds.
if (process.env.ENABLE_PREVIEW_WRITE === '1' && !isPkg) {
  app.post('/api/save-preview', express.json({ limit: '2mb' }), async (req, res) => {
    const { category, name, dataUrl } = req.body || {};
    if (!['maps', 'characters'].includes(category) || typeof name !== 'string' || !/^[a-zA-Z0-9_-]{1,60}$/.test(name) ||
      typeof dataUrl !== 'string' || !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) return res.sendStatus(400);
    const targetDir = path.join(publicPath, 'assets', 'images', category);
    try {
      await fs.promises.mkdir(targetDir, { recursive: true });
      await fs.promises.writeFile(path.join(targetDir, name + '.jpg'), Buffer.from(dataUrl.split(',')[1], 'base64'));
      res.json({ ok: true });
    } catch { res.sendStatus(500); }
  });
}
app.use((req, res) => res.sendStatus(404));

// Helper: Get LAN IP address
function getLanIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Filter out internal (i.e. 127.0.0.1) and non-ipv4
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ iface: name, address: iface.address });
      }
    }
  }
  return addresses;
}

// ==========================================
// GAME STATE & ROOM MANAGEMENT
// ==========================================
const rooms = new Map();

// Map-specific arena spawn points (8 Octree-verified open & mutually reachable spawns per GLB map)
const importedKillhousePath=resolveAssetPath('public','assets','models','killhouse-import.json');
const importedKillhouse=fs.existsSync(importedKillhousePath)?JSON.parse(fs.readFileSync(importedKillhousePath,'utf8')):null;
const MAP_SPAWNS = {
  ...Object.fromEntries(Object.keys(EXTRA_ARENAS).map(id => [id, arenaSpawns(id)])),
  killhouse: importedKillhouse?.spawns || KILLHOUSE_SPAWNS,
  dust2: [
    { x: 34.0, y: 9.28, z: -40.0 },
    { x: -47.72, y: 10.16, z: 53.88 },
    { x: -45.4, y: 6.72, z: -27.49 },
    { x: 24.46, y: 6.72, z: 34.26 },
    { x: -3.23, y: 3.31, z: -7.46 },
    { x: 46.5, y: 6.72, z: 0.0 },
    { x: -38.21, y: 7.57, z: 14.78 },
    { x: -7.72, y: 10.16, z: 53.88 }
  ],
  stalkyard: [
    { x: 20.5, y: 1.81, z: -16.0 },
    { x: -26.84, y: 1.81, z: 16.46 },
    { x: 15.5, y: 1.81, z: 21.5 },
    { x: -12.0, y: 1.81, z: -13.5 },
    { x: 0.5, y: 1.81, z: 4.0 },
    { x: -19.5, y: 1.81, z: 1.5 },
    { x: 25.5, y: 1.81, z: 9.0 },
    { x: -9.36, y: 2.66, z: 16.53 }
  ],
  turbine: [
    { x: 15.5, y: 8.56, z: -39.5 },
    { x: -4.21, y: 9.03, z: 45.44 },
    { x: -26.65, y: 9.79, z: -4.41 },
    { x: 16.96, y: 12.03, z: 5.04 },
    { x: -34.13, y: 6.16, z: 28.05 },
    { x: 26.86, y: 8.96, z: 33.28 },
    { x: -4.5, y: 8.67, z: -19.5 },
    { x: -6.67, y: 6.07, z: 10.51 }
  ],
  frenzy: [
    { x: 28.0, y: 1.88, z: -20.0 },
    { x: -30.32, y: 6.75, z: 14.99 },
    { x: 11.97, y: 6.71, z: 22.29 },
    { x: -13.8, y: 1.91, z: -23.88 },
    { x: 4.38, y: 1.8, z: -3.66 },
    { x: -26.3, y: 1.81, z: -6.38 },
    { x: -10.32, y: 6.71, z: 22.49 },
    { x: 23.12, y: 6.81, z: 3.22 }
  ],
  italy: [
    { x: 15.5, y: 3.68, z: -17.5 },
    { x: -11.98, y: 1.6, z: 51.74 },
    { x: -26.92, y: 3.89, z: -42.62 },
    { x: 30.5, y: 11.17, z: -62.38 },
    { x: -24.22, y: 3.68, z: -0.08 },
    { x: 28.01, y: 3.68, z: 17.2 },
    { x: 3.0, y: 3.68, z: -45.0 },
    { x: -4.45, y: 2.74, z: 25.02 }
  ]
};

// Fixed 2-Team base spawns (verified wide-open & opposite sides of the main connected arena)
const TEAM_SPAWNS = {
  ...Object.fromEntries(Object.keys(EXTRA_ARENAS).map(id => {
    const spawns = arenaSpawns(id);
    return [id, {blue:spawns[2], red:spawns[7]}];
  })),
  killhouse: importedKillhouse?{blue:importedKillhouse.spawns.find(p=>p.z<0 && p.x===0),red:importedKillhouse.spawns.find(p=>p.z>0 && p.x===0)}:{blue:{x:0,y:2.2,z:-23},red:{x:0,y:2.2,z:23}},
  dust2: {
    blue: { x: 34.0, y: 9.28, z: -40.0 },
    red: { x: -47.72, y: 10.16, z: 53.88 }
  },
  stalkyard: {
    blue: { x: 20.5, y: 1.81, z: -16.0 },
    red: { x: -26.84, y: 1.81, z: 16.46 }
  },
  turbine: {
    blue: { x: 15.5, y: 8.56, z: -39.5 },
    red: { x: -4.21, y: 9.03, z: 45.44 }
  },
  frenzy: {
    blue: { x: -30.32, y: 6.75, z: 14.99 },
    red: { x: 23.12, y: 6.81, z: 3.22 }
  },
  italy: {
    blue: { x: -11.98, y: 1.6, z: 51.74 },
    red: { x: 3.0, y: 3.68, z: -45.0 }
  }
};

// Compact formation offsets verified clear & ceiling-free around each fixed team base
const TEAM_BASE_OFFSETS = [
  { x: 0.0, z: 0.0 },
  { x: 0.9, z: 0.0 },
  { x: -0.9, z: 0.0 },
  { x: 0.0, z: 0.9 },
  { x: 0.0, z: -0.9 }
];

// Aliases for backwards compatibility with existing room connections
MAP_SPAWNS.warehouse = MAP_SPAWNS.stalkyard;
MAP_SPAWNS.station = MAP_SPAWNS.turbine;
MAP_SPAWNS.desert = MAP_SPAWNS.frenzy;
MAP_SPAWNS.arena = MAP_SPAWNS.italy;
MAP_SPAWNS.colosseum = MAP_SPAWNS.italy;
MAP_SPAWNS.dungeon = MAP_SPAWNS.dust2;

TEAM_SPAWNS.warehouse = TEAM_SPAWNS.stalkyard;
TEAM_SPAWNS.station = TEAM_SPAWNS.turbine;
TEAM_SPAWNS.desert = TEAM_SPAWNS.frenzy;
TEAM_SPAWNS.arena = TEAM_SPAWNS.italy;
TEAM_SPAWNS.colosseum = TEAM_SPAWNS.italy;
TEAM_SPAWNS.dungeon = TEAM_SPAWNS.dust2;

const MAX_TEAM_SIZE = 5;
const TEAM_COLORS = {
  blue: '#3b82f6',
  red: '#ef4444'
};

function resolveMapChoice(choice, previous) {
  if (choice !== 'shuffle') return choice;
  const choices = PLAYABLE_MAPS.filter(id => id !== previous);
  return choices[Math.floor(Math.random() * choices.length)];
}

function getRandomSpawn(mapId = 'dust2', excludeIndex = -1) {
  const spawns = MAP_SPAWNS[mapId] || MAP_SPAWNS.dust2;
  let idx = Math.floor(Math.random() * spawns.length);
  if (idx === excludeIndex && spawns.length > 1) {
    idx = (idx + 1) % spawns.length;
  }
  return { ...spawns[idx], spawnIndex: idx };
}

function getOtherPlayerPositions(room, excludePlayerId = null) {
  if (!room || !room.players) return [];
  const alive = [];
  const allOthers = [];
  for (const p of Object.values(room.players)) {
    if (p.id === excludePlayerId || !p.position) continue;
    allOthers.push(p.position);
    if (p.isAlive) alive.push(p.position);
  }
  return alive.length > 0 ? alive : allOthers;
}

// Solo / FFA: choose spawn maximizing minimum distance to every other player
function getFarthestSpawn(mapId = 'dust2', occupiedPositions = []) {
  const spawns = MAP_SPAWNS[mapId] || MAP_SPAWNS.dust2;
  if (!occupiedPositions || occupiedPositions.length === 0) {
    return getRandomSpawn(mapId);
  }

  let bestIdx = 0;
  let bestMinDistSq = -1;
  for (let i = 0; i < spawns.length; i++) {
    const sp = spawns[i];
    let minDistSq = Infinity;
    for (const op of occupiedPositions) {
      const dx = sp.x - op.x;
      const dy = sp.y - op.y;
      const dz = sp.z - op.z;
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq < minDistSq) minDistSq = dSq;
    }
    if (minDistSq > bestMinDistSq) {
      bestMinDistSq = minDistSq;
      bestIdx = i;
    }
  }
  return { ...spawns[bestIdx], spawnIndex: bestIdx };
}

function getTeamCounts(room) {
  let blue = 0;
  let red = 0;
  for (const p of Object.values(room.players)) {
    if (p.team === 'blue') blue++;
    else if (p.team === 'red') red++;
  }
  return { blue, red };
}

// 2-Team mode: always spawn at the fixed base point for that team
function getTeamSpawn(mapId = 'dust2', team = null, slotIndex = 0) {
  const bases = TEAM_SPAWNS[mapId] || TEAM_SPAWNS.dust2;
  const side = team === 'red' ? 'red' : 'blue';
  const base = bases[side];
  if (!base) return getRandomSpawn(mapId);
  const idx = slotIndex >= 0 ? slotIndex : 0;
  const offset = TEAM_BASE_OFFSETS[idx % TEAM_BASE_OFFSETS.length];
  return {
    x: base.x + offset.x,
    y: base.y,
    z: base.z + offset.z,
    spawnIndex: side === 'red' ? 1 : 0
  };
}

function assignMatchStartSpawns(room) {
  room.round = (room.round || 0) + 1;
  const isTdm = room.settings.gameMode === 'tdm';
  const mapId = room.settings.mapId || 'dust2';
  const placedPositions = [];
  let blueSlot = 0;
  let redSlot = 0;

  for (const player of Object.values(room.players)) {
    const sp = isTdm
      ? getTeamSpawn(mapId, player.team, player.team === 'red' ? redSlot++ : blueSlot++)
      : getFarthestSpawn(mapId, placedPositions);
    player.ability={readyAt:0,activeUntil:0};
    resetInventory(player, playerLoadout(player.loadout)[0]);
    player.isCrouching = false;
    player.health = 100;
    player.kills = 0;
    player.deaths = 0;
    player.isAlive = true;
    player.position = { x: sp.x, y: sp.y, z: sp.z };
    placedPositions.push(player.position);
  }
}

function assignAutoTeam(room, preferredTeam = null) {
  const counts = getTeamCounts(room);
  if ((preferredTeam === 'blue' || preferredTeam === 'red') && counts[preferredTeam] < MAX_TEAM_SIZE) {
    return preferredTeam;
  }
  if (counts.blue < MAX_TEAM_SIZE && (counts.blue <= counts.red || counts.red >= MAX_TEAM_SIZE)) {
    return 'blue';
  }
  if (counts.red < MAX_TEAM_SIZE) {
    return 'red';
  }
  return null;
}

function assignTeamsForAllPlayers(room) {
  let blueCount = 0;
  let redCount = 0;
  for (const p of Object.values(room.players)) {
    if (p.team === 'blue' && blueCount < MAX_TEAM_SIZE) {
      blueCount++;
    } else if (p.team === 'red' && redCount < MAX_TEAM_SIZE) {
      redCount++;
    } else if (blueCount < MAX_TEAM_SIZE && blueCount <= redCount) {
      p.team = 'blue';
      blueCount++;
    } else if (redCount < MAX_TEAM_SIZE) {
      p.team = 'red';
      redCount++;
    } else {
      p.team = 'blue';
    }
  }
}

function buildScoreboard(room) {
  return Object.values(room.players)
    .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
    .map((p, idx) => ({
      rank: idx + 1,
      id: p.id,
      name: p.name,
      team: p.team || null,
      color: room.settings.gameMode === 'tdm' && p.team ? TEAM_COLORS[p.team] : p.color,
      characterType: p.characterType,
      kills: p.kills,
      deaths: p.deaths,
      kd: p.deaths > 0 ? (p.kills / p.deaths).toFixed(1) : p.kills.toFixed(1),
      health: p.health,
      isAlive: p.isAlive
    }));
}

function getPublicRoomList() {
  const list = [];
  for (const [id, room] of rooms.entries()) {
    if (room.settings.gameMode === 'zombies') continue;
    const counts = getTeamCounts(room);
    list.push({
      id: room.id,
      name: room.name,
      hostName: room.hostName,
      hostId: room.hostId,
      playerCount: Object.keys(room.players).length,
      maxPlayers: room.maxPlayers,
      status: room.status,
      gameMode: room.settings.gameMode || 'ffa',
      teamCounts: counts,
      gravity: room.settings.gravity,
      scoreLimit: room.settings.scoreLimit,
      mapId: room.settings.mapId || 'warehouse'
    });
  }
  return list;
}

// Helper: Trigger Match Finish & Final Scoreboard
function triggerMatchFinish(room, winner) {
  const finalScoreboard = buildScoreboard(room);
  const topPlayer = Object.values(room.players).sort((a, b) => b.kills - a.kills)[0];
  const mvp = topPlayer || winner || { id: '', name: 'Operative', kills: 0, deaths: 0 };
  const isTdm = room.settings.gameMode === 'tdm';

  let winningTeam = null;
  let winnerName = mvp.name;
  let winnerId = mvp.id;

  if (isTdm) {
    const blue = room.teamScores?.blue || 0;
    const red = room.teamScores?.red || 0;
    if (blue > red) {
      winningTeam = 'blue';
      winnerName = 'TEAM BLUE';
    } else if (red > blue) {
      winningTeam = 'red';
      winnerName = 'TEAM RED';
    } else {
      winningTeam = 'draw';
      winnerName = 'DRAW MATCH';
    }
    winnerId = winningTeam;
  } else if (winner) {
    winnerId = winner.id;
    winnerName = winner.name;
  }

  const survival = room.zombies?.result;
  delete room.zombies;
  room.status = 'ended';

  io.to(room.id).emit('match-finished', {
    gameMode: room.settings.gameMode || 'ffa',
    winningTeam,
    survival,
    teamScores: room.teamScores || { blue: 0, red: 0 },
    winnerId,
    winnerName,
    mvp: {
      id: mvp.id,
      name: mvp.name,
      team: mvp.team || null,
      kills: mvp.kills,
      deaths: mvp.deaths,
      kd: mvp.deaths > 0 ? (mvp.kills / mvp.deaths).toFixed(1) : mvp.kills.toFixed(1)
    },
    scoreboard: finalScoreboard,
    room: room
  });

  io.emit('rooms-update', getPublicRoomList());
  console.log(`[Match Finished] Winner in ${room.name} is ${winnerName}`);
}

// Shared helper to process damage, friendly-fire rules, kill attribution, team scores, win check, and respawn
function applyDamageAndCheckKill(room, roomId, shooter, victim, damage, weaponName, isHeadshot, isGrenade, hitPoint) {
  if (!victim || !victim.isAlive) return false;
  const isTdm = room.settings.gameMode === 'tdm';

  // Disable friendly fire against teammates in 2-Team mode (self-damage from own grenade remains active)
  if (isTdm && shooter && shooter.id !== victim.id && shooter.team && victim.team && shooter.team === victim.team) {
    return false;
  }

  damage=reduceAbilityDamage(victim,damage);
  victim.health = Math.max(0, victim.health - damage);

  io.to(roomId).emit('player-damaged', {
    targetId: victim.id,
    shooterId: shooter?.id || null,
    health: victim.health,
    damage: damage,
    isHeadshot: !!isHeadshot,
    isGrenade: !!isGrenade,
    hitPoint: hitPoint
  });

  if (victim.health > 0) return false;

  victim.isAlive = false;
  victim.deaths += 1;

  if (shooter && shooter.id !== victim.id) {
    shooter.kills += 1;
    if (isTdm) {
      if (shooter.team === 'blue') room.teamScores.blue += 1;
      else if (shooter.team === 'red') room.teamScores.red += 1;
    }
  }

  io.to(roomId).emit('player-killed', {
    killerId: shooter?.id || victim.id,
    killerName: shooter?.name || 'Frag Grenade',
    killerTeam: shooter?.team || null,
    victimId: victim.id,
    victimName: victim.name,
    victimTeam: victim.team || null,
    weaponName: weaponName,
    isHeadshot: !!isHeadshot,
    gameMode: room.settings.gameMode || 'ffa',
    teamScores: room.teamScores || { blue: 0, red: 0 },
    scoreboard: buildScoreboard(room)
  });

  if (room.zombies) {
    if (victim.id === room.hostId) {
      room.zombies.result = 'defeat';
      triggerMatchFinish(room, victim);
    }
    return true;
  }

  // Check Win Condition
  if (isTdm) {
    if (room.teamScores.blue >= room.settings.scoreLimit || room.teamScores.red >= room.settings.scoreLimit) {
      triggerMatchFinish(room, shooter);
      return true;
    }
  } else if (shooter && shooter.id !== victim.id && shooter.kills >= room.settings.scoreLimit) {
    triggerMatchFinish(room, shooter);
    return true;
  }

  // Schedule 3-second respawn for victim
  setTimeout(() => {
    if (!rooms.has(roomId)) return;
    const currentRoom = rooms.get(roomId);
    if (!currentRoom || !currentRoom.players[victim.id] || currentRoom.status !== 'in-game') return;

    let newSpawn;
    if (currentRoom.settings.gameMode === 'tdm') {
      const teammates = Object.values(currentRoom.players)
        .filter(p => p.team === victim.team)
        .map(p => p.id);
      const teamSlot = Math.max(0, teammates.indexOf(victim.id));
      newSpawn = getTeamSpawn(currentRoom.settings.mapId, victim.team, teamSlot);
    } else {
      newSpawn = getFarthestSpawn(
        currentRoom.settings.mapId,
        getOtherPlayerPositions(currentRoom, victim.id)
      );
    }

    resetInventory(victim);
    victim.isCrouching = false;
    victim.health = 100;
    victim.isAlive = true;
    victim.position = { x: newSpawn.x, y: newSpawn.y, z: newSpawn.z };

    io.to(roomId).emit('player-respawned', {
      playerId: victim.id,
      position: victim.position,
      health: 100
    });
  }, 3000);

  return false;
}

io.on('connection', (socket) => {
  let currentRoomId = socket.data.roomId || null;
  const limits = new Map();
  socket.use((packet, next) => {
    if (!validatePacket(packet)) return;
    const key = packet[0] === 'player-movement' ? 'movement' : 'other';
    const now = performance.now();
    let bucket = limits.get(key);
    if (!bucket || now - bucket.start > 1000) { bucket = {start:now,count:0}; limits.set(key,bucket); }
    if (++bucket.count > (key === 'movement' ? 90 : 50)) return;
    next();
  });
  if (socket.recovered && currentRoomId) {
    const room = rooms.get(currentRoomId);
    if (room?.players[socket.id]) socket.emit('session-restored', {room,playerId:socket.id,serverTime:performance.now()});
  }

  // Send initial room list to newly connected player in lobby
  socket.emit('rooms-update', getPublicRoomList());

  // Ping-pong for measuring LAN latency
  socket.on('client-ping', (clientTimestamp) => {
    socket.emit('server-pong', clientTimestamp);
  });

  // Create a room
  socket.on('create-room', ({ roomName, playerName, playerColor, characterType, loadout, settings }) => {
    if (currentRoomId) return;
    const roomId = 'room_' + Math.random().toString(36).substring(2, 8);
    const chosenMap = resolveMapChoice(settings?.mapId || 'dust2');
    const gameMode = settings?.gameMode || 'ffa';
    const hostTeam = gameMode === 'tdm' ? 'blue' : null;
    const hostSpawn = gameMode === 'tdm'
      ? getTeamSpawn(chosenMap, hostTeam, 0)
      : getRandomSpawn(chosenMap);

    const newRoom = {
      id: roomId,
      name: (roomName || 'Tactical Arena').trim().substring(0, 24),
      hostId: socket.id,
      hostName: (playerName || 'Player').trim().substring(0, 16),
      status: 'lobby',
      maxPlayers: gameMode === 'zombies' ? 1 : gameMode === 'tdm' ? MAX_TEAM_SIZE * 2 : 12,
      teamScores: { blue: 0, red: 0 },
      settings: {
        mapId: chosenMap,
        gameMode: gameMode,
        zombieDifficulty: settings?.zombieDifficulty || 'normal',
        maxTeamSize: MAX_TEAM_SIZE,
        gravity: settings?.gravity || 'normal',
        scoreLimit: Math.min(Math.max(Number(settings?.scoreLimit) || 15, 5), 50)
      },
      players: {
        [socket.id]: {
          id: socket.id,
          name: (playerName || 'Player').trim().substring(0, 16),
          color: playerColor || '#3b82f6',
          team: hostTeam,
          characterType: characterType || 'soldier',
      loadout: playerLoadout(loadout),
          isHost: true,
          health: 100,
          kills: 0,
          deaths: 0,
          isAlive: true,
          position: { x: hostSpawn.x, y: hostSpawn.y, z: hostSpawn.z },
          rotation: { yaw: 0, pitch: 0 }
        }
      }
    };

    rooms.set(roomId, newRoom);
    currentRoomId = roomId;
    socket.data.roomId = roomId;
    socket.join(roomId);
    resetInventory(rooms.get(roomId).players[socket.id]);

    socket.emit('room-created', {
      room: newRoom,
      playerId: socket.id
    });

    io.emit('rooms-update', getPublicRoomList());
    console.log(`[Room Created] ${newRoom.name} (${roomId}) mode=${gameMode} by ${newRoom.hostName} on map ${chosenMap}`);
  });

  // Join an existing room
  socket.on('join-room', ({ roomId, playerName, playerColor, characterType, loadout, preferredTeam }) => {
    if (currentRoomId) return;
    const room = rooms.get(roomId);
    if (!room) {
      return socket.emit('join-error', 'Room does not exist.');
    }
    const playerCount = Object.keys(room.players).length;
    if (playerCount >= room.maxPlayers) {
      return socket.emit('join-error', 'Room is currently full.');
    }

    const isTdm = room.settings.gameMode === 'tdm';
    let assignedTeam = null;
    if (isTdm) {
      assignedTeam = assignAutoTeam(room, preferredTeam);
      if (!assignedTeam) {
        return socket.emit('join-error', 'Both teams are full (5/5 max per team).');
      }
    }

    let spawn;
    if (isTdm) {
      const sameTeamCount = Object.values(room.players).filter(p => p.team === assignedTeam).length;
      spawn = getTeamSpawn(room.settings.mapId, assignedTeam, sameTeamCount);
    } else {
      spawn = getFarthestSpawn(room.settings.mapId, getOtherPlayerPositions(room));
    }

    const newPlayer = {
      id: socket.id,
      name: (playerName || 'Player').trim().substring(0, 16),
      color: playerColor || '#10b981',
      team: assignedTeam,
      characterType: characterType || 'soldier',
      loadout: playerLoadout(loadout),
      isHost: false,
      health: 100,
      kills: 0,
      deaths: 0,
      isAlive: true,
      position: { x: spawn.x, y: spawn.y, z: spawn.z },
      rotation: { yaw: 0, pitch: 0 }
    };

    room.players[socket.id] = newPlayer;
    currentRoomId = roomId;
    socket.data.roomId = roomId;
    socket.join(roomId);
    resetInventory(rooms.get(roomId).players[socket.id]);

    socket.emit('room-joined', {
      room: room,
      playerId: socket.id
    });

    socket.to(roomId).emit('player-joined-room', newPlayer);
    io.emit('rooms-update', getPublicRoomList());
    console.log(`[Player Joined] ${newPlayer.name} (${newPlayer.characterType}${assignedTeam ? `, team=${assignedTeam}` : ''}) joined ${room.name} (${roomId})`);
  });

  // Switch Team in 2-Team mode (Max 5 per team; unbalanced teams explicitly allowed)
  socket.on('switch-team', ({ team }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room.settings.gameMode !== 'tdm') return;
    const player = room.players[socket.id];
    if (!player || room.status !== 'lobby') return;
    if (team !== 'blue' && team !== 'red') return;
    if (player.team === team) return;

    const counts = getTeamCounts(room);
    if (counts[team] >= MAX_TEAM_SIZE) {
      return socket.emit('team-switch-error', `Team ${team === 'blue' ? 'Blue' : 'Red'} is already full (5/5).`);
    }

    player.team = team;
    io.to(currentRoomId).emit('room-updated', { room });
    io.emit('rooms-update', getPublicRoomList());
    console.log(`[Team Switched] ${player.name} -> Team ${team.toUpperCase()} (${room.name})`);
  });

  // Host updates room settings (Map, Gravity, ScoreLimit, GameMode)
  socket.on('update-room-settings', ({ settings }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room.hostId !== socket.id || room.status !== 'lobby') return;

    if (settings.mapId) room.settings.mapId = resolveMapChoice(settings.mapId, room.settings.mapId);
    if (settings.gravity) room.settings.gravity = settings.gravity;
    if (settings.scoreLimit) room.settings.scoreLimit = Math.min(Math.max(Number(settings.scoreLimit), 5), 50);

    if (settings.gameMode === 'zombies' && Object.keys(room.players).length !== 1) return;
    if (settings.gameMode) {
      room.settings.gameMode = settings.gameMode;
      if (settings.gameMode === 'tdm') {
        room.maxPlayers = MAX_TEAM_SIZE * 2;
        room.teamScores = { blue: 0, red: 0 };
        assignTeamsForAllPlayers(room);
      } else {
        room.maxPlayers = settings.gameMode === 'zombies' ? 1 : 12;
        for (const p of Object.values(room.players)) {
          p.team = null;
        }
      }
      io.to(currentRoomId).emit('room-updated', { room });
    }

    io.to(currentRoomId).emit('room-settings-updated', room.settings);
    io.emit('rooms-update', getPublicRoomList());
    console.log(`[Room Settings Updated] ${room.name}: Mode=${room.settings.gameMode}, Map=${room.settings.mapId}, Gravity=${room.settings.gravity}`);
  });

  // Host starts the match
  socket.on('start-match', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room.hostId !== socket.id) return;

    if (!collisionIndexes?.has(room.settings.mapId)) return socket.emit('join-error', 'Map collision data is loading. Try again shortly.');
    room.status = 'in-game';
    room.teamScores = { blue: 0, red: 0 };

    assignMatchStartSpawns(room);
    resetZombies(room);

    io.to(currentRoomId).emit('match-started', {
      room: room
    });

    io.emit('rooms-update', getPublicRoomList());
    console.log(`[Match Started] Room ${room.name} (${currentRoomId}) started (${room.settings.gameMode}) on ${room.settings.mapId}!`);
  });

  // In-game: Player Movement Sync
  socket.on('zombies-active', active => {
    const room = rooms.get(currentRoomId);
    if (room?.hostId === socket.id && room.zombies && typeof active === 'boolean') room.zombies.active = active;
  });

  socket.on('player-movement', (data) => {
    if (!currentRoomId || !data?.position || !data?.rotation) return;
    if (![data.position.x, data.position.y, data.position.z, data.rotation.yaw, data.rotation.pitch].every(Number.isFinite)) return;
    const room = rooms.get(currentRoomId);
    if (!room || !room.players[socket.id]) return;

    const player = room.players[socket.id];
    if (room.status !== 'in-game' || !player.isAlive || !finiteVector(data.position)) return;
    const now = performance.now();
    const elapsed = Math.min(1, Math.max(0, (now - (player.lastMove || now)) / 1000));
    const returningToSafeFloor = player.safePosition && Math.hypot(player.position.x-player.safePosition.x,
      player.position.y-player.safePosition.y,player.position.z-player.safePosition.z)>3 && Math.hypot(data.position.x-player.safePosition.x,
      data.position.y-player.safePosition.y,data.position.z-player.safePosition.z) < 1.5;
    if (!returningToSafeFloor && (Math.hypot(data.position.x-player.position.x, data.position.z-player.position.z) > 22 * elapsed + 1 ||
      Math.abs(data.position.y-player.position.y) > 45 * elapsed + 2)) {
      socket.emit('movement-corrected', {position:player.position,isCrouching:!!player.isCrouching});
      return;
    }
    player.lastMove = now;
    player.position = {x:data.position.x,y:data.position.y,z:data.position.z};
    player.rotation = data.rotation;
    player.isMoving = data.isMoving;
    player.isRunning = data.isRunning;
    player.isCrouching = !!data.isCrouching;
    const eyeHeight = player.isCrouching ? 1 : 1.6;
    const floorDistance = collisionIndexes.get(room.settings.mapId).raycast(player.position,{x:0,y:-1,z:0},eyeHeight+.6);
    if (floorDistance !== null && Math.abs(floorDistance-eyeHeight)<.6) player.safePosition = {...player.position};
    player.isJumping = !!data.isJumping;
    player.history ||= [];
    player.history.push({time:performance.now(),position:{...player.position},isCrouching:player.isCrouching});
    while (player.history.length > 20) player.history.shift();

    // Relay to all other players in this room
    socket.to(currentRoomId).volatile.emit('player-moved', {
      id: socket.id,
      position: data.position,
      rotation: data.rotation,
      isMoving: data.isMoving,
      isRunning: data.isRunning,
      isCrouching: !!data.isCrouching,
      isJumping: data.isJumping
    });
  });

  // Weapon Switch Event
  socket.on('weapon-switch', ({ slot }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || !room.players[socket.id]) return;

    if (!allowedWeapon(room.players[socket.id],slot)) return;
    switchGun(room.players[socket.id], slot, performance.now());
    room.players[socket.id].activeWeaponSlot = slot;
    socket.to(currentRoomId).emit('player-weapon-switched', {
      playerId: socket.id,
      slot: slot
    });
  });

  // Throw Tactical Projectile (Frag or Flash)
  socket.on('use-ability',()=>{
    const room=rooms.get(currentRoomId), player=room?.players[socket.id];if(!player)return;
    const result=activateAbility(room,player);if(!result)return;
    socket.emit('ability-state',result);
    io.to(currentRoomId).emit('ability-used',{playerId:socket.id,name:result.name,duration:result.duration,health:result.health});
  });
  socket.on('throw-projectile', (data) => {
    if (!finiteVector(data.origin) || !finiteVector(data.velocity) || !['frag','flash','molotov'].includes(data.type)) return;
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || !room.players[socket.id]) return;

    if (data.type === 'molotov') {
      const shooter=room.players[socket.id], index=collisionIndexes?.get(room.settings.mapId);
      if(room.status!=='in-game' || !acceptMolotov(shooter,data,index)) return;
      const round=room.round, roomId=currentRoomId;
      const bottle={position:{...data.origin},velocity:{...data.velocity},age:0,gravity:room.settings.gravity==='antigravity'?5:room.settings.gravity==='low'?12:24};
      let burnAge=0, burning=false;
      const timer=setInterval(()=>{
        if(rooms.get(roomId)!==room || room.status!=='in-game' || room.round!==round) {clearInterval(timer);return;}
        if(!burning) {
          if(!stepBottle(bottle,index,1/30)) return;
          // Settle impact onto the floor below, including wall impacts.
          const floor=index.raycast({...bottle.position,y:bottle.position.y+.2},{x:0,y:-1,z:0},30);
          if(floor===null) {clearInterval(timer);return;}
          bottle.position.y+=.2-floor+.03;burning=true;
          io.to(roomId).emit('molotov-ignited',{id:data.id,position:bottle.position,duration:FIRE_DURATION,radius:FIRE_RADIUS});
          return;
        }
        burnAge++;
        if(burnAge%15===0) for(const victim of [...Object.values(room.players), ...(room.zombies?.enemies ?? [])]) {
          if(inFire(bottle.position,victim,index)) applyDamageAndCheckKill(room,roomId,shooter,victim,12,'Molotov',false,false,bottle.position);
          if(room.status!=='in-game') break;
        }
        if(burnAge>=FIRE_DURATION*30) clearInterval(timer);
      },1000/30);
      timer.unref();
    }
    // Relay to other players
    socket.to(currentRoomId).emit('projectile-thrown', {
      throwerId: socket.id,
      id: data.id,
      type: data.type,
      origin: data.origin,
      velocity: data.velocity
    });
  });

  // Frag Grenade Explode (Server-calculated AoE Blast Damage)
  socket.on('grenade-explode', (data) => {
    if (!finiteVector(data.explosionPoint)) return;
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const thrower = room.players[socket.id];
    if (!thrower || room.status !== 'in-game') return;
    const expX = data.explosionPoint.x;
    const expY = data.explosionPoint.y;
    const expZ = data.explosionPoint.z;

    // Broadcast visual explosion effect to room
    socket.to(currentRoomId).emit('grenade-detonated', {
      explosionPoint: data.explosionPoint,
      throwerId: thrower?.id
    });

    // Calculate AoE damage for each alive player in room
    for (const victim of [...Object.values(room.players), ...(room.zombies?.enemies ?? [])]) {
      if (!victim.isAlive) continue;

      const dx = victim.position.x - expX;
      const dy = victim.position.y - expY;
      const dz = victim.position.z - expZ;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Max damage within 2.5m is 100 HP, scaling down to 15 HP at 10m
      if (dist <= 10.0) {
        let damage = 100;
        if (dist > 2.5) {
          const ratio = (dist - 2.5) / 7.5;
          damage = Math.round(100 - ratio * 85);
        }

        const matchEnded = applyDamageAndCheckKill(
          room,
          currentRoomId,
          thrower,
          victim,
          damage,
          'Frag Grenade 💣',
          false,
          true,
          data.explosionPoint
        );
        if (matchEnded) return;
      }
    }
  });

  // Flashbang Detonate
  socket.on('flash-detonate', (data) => {
    if (!finiteVector(data.position)) return;
    if (!currentRoomId) return;
    socket.to(currentRoomId).emit('flash-detonated', {
      position: data.position,
      throwerId: socket.id
    });
  });

  socket.on('weapon-reload', () => {
    const room = rooms.get(currentRoomId), player = room?.players[socket.id];
    if (room?.status === 'in-game' && player) startReload(player, performance.now());
  });
  socket.on('player-shoot', data => {
    const room = rooms.get(currentRoomId), shooter = room?.players[socket.id];
    if (!shooter) return;
    const shot = validateShot(room, shooter, data, collisionIndexes?.get(room.settings.mapId));
    if (!shot) {
      if (shooter.combat) socket.emit('weapon-state', {ammo:shooter.combat.ammo,reloading:!!shooter.combat.reload});
      return;
    }
    socket.to(currentRoomId).emit('player-shot-effect', {shooterId:socket.id, ...shot, victim:undefined, weaponSlot:shot.slot});
    if (shot.victim) {
      socket.emit('hit-confirmed', {isHeadshot:shot.headshot});
      applyDamageAndCheckKill(room,currentRoomId,shooter,shot.victim,shot.damage,shot.weaponName,shot.headshot,false,shot.hitPoint);
    }
  });

  // Rematch / Restart Match
  socket.on('rematch-request', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room.hostId !== socket.id) return;
    if (!collisionIndexes?.has(room.settings.mapId)) return;

    assignMatchStartSpawns(room);
    resetZombies(room);
    room.teamScores = { blue: 0, red: 0 };
    room.status = 'in-game';

    io.to(currentRoomId).emit('match-restarted', { room });
    io.emit('rooms-update', getPublicRoomList());
    console.log(`[Rematch Triggered] Room ${room.name} (${currentRoomId}) match restarted!`);
  });

  // Finish Match (Host ends match early)
  socket.on('finish-match-request', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    if (room.hostId !== socket.id) return; // Host only

    triggerMatchFinish(room);
  });

  // Return to Room Lobby (for changing map/character before next match)
  socket.on('return-to-lobby-request', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room.hostId !== socket.id) return;

    delete room.zombies;
    room.status = 'lobby';
    room.teamScores = { blue: 0, red: 0 };
    for (const p of Object.values(room.players)) {
      p.kills = 0;
      p.deaths = 0;
      p.health = 100;
      p.isAlive = true;
    }

    io.to(currentRoomId).emit('room-returned-to-lobby', { room });
    io.emit('rooms-update', getPublicRoomList());
    console.log(`[Returned To Lobby] Room ${room.name} (${currentRoomId}) returned to waiting room.`);
  });

  // Leave room
  socket.on('leave-room', () => {
    handleLeaveRoom(socket, currentRoomId);
    currentRoomId = null;
    delete socket.data.roomId;
  });

  // Disconnect
  socket.on('disconnect', reason => {
    if (['transport close','transport error','ping timeout'].includes(reason)) {
      const roomId = currentRoomId;
      const timer = setTimeout(() => {
        if (!io.sockets.sockets.has(socket.id)) handleLeaveRoom(socket, roomId);
      }, 31000);
      timer.unref();
    } else handleLeaveRoom(socket, currentRoomId);
  });
});

function handleLeaveRoom(socket, roomId) {
  if (!roomId || !rooms.has(roomId)) return;
  const room = rooms.get(roomId);
  const player = room.players[socket.id];
  if (!player) return;

  delete room.players[socket.id];
  socket.leave(roomId);
  console.log(`[Player Left] ${player.name} left room ${room.name} (${roomId})`);

  const remainingPlayers = Object.keys(room.players);
  if (remainingPlayers.length === 0) {
    // Room is empty, clean it up
    rooms.delete(roomId);
    console.log(`[Room Deleted] Room ${roomId} was closed (no players left).`);
  } else {
    // If the host left, assign host to next remaining player
    if (room.hostId === socket.id) {
      const newHostId = remainingPlayers[0];
      room.hostId = newHostId;
      room.hostName = room.players[newHostId].name;
      room.players[newHostId].isHost = true;
      io.to(roomId).emit('host-changed', {
        newHostId: newHostId,
        newHostName: room.hostName
      });
      console.log(`[Host Migrated] New host for ${roomId} is ${room.hostName}`);
    }

    io.to(roomId).emit('player-left-room', {
      playerId: socket.id,
      playerName: player.name
    });
  }

  io.emit('rooms-update', getPublicRoomList());
}

// Helper to automatically open the default web browser when launched
function openBrowser(url) {
  if (process.env.NO_BROWSER || process.env.CI || process.env.NODE_ENV === 'test') return;
  const startCmd = process.platform === 'darwin' ? `open "${url}"` :
                   process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`;
  exec(startCmd, () => {
    // Non-blocking, ignore errors if running in headless terminal
  });
}

// Start HTTP and WebSocket server
const ZOMBIE_DIFFICULTY = {
  easy: { extra: -1, health: .75, speed: .8, damage: .65 },
  normal: { extra: 0, health: 1, speed: 1, damage: 1 },
  hard: { extra: 2, health: 1.35, speed: 1.2, damage: 1.45 }
};

function resetZombies(room) {
  delete room.zombies;
  if (room.settings.gameMode === 'zombies') {
    room.zombies = { active: false, wave: 0, delay: 2, enemies: [] };
  }
}

setInterval(() => {
  for (const room of rooms.values()) {
    const run = room.zombies;
    const player = room.players[room.hostId];
    if (!run || room.status !== 'in-game' || !run.active || !player?.isAlive || performance.now() - (player.lastMove || 0) > 500 || !io.sockets.sockets.has(player.id)) continue;
    const difficulty = ZOMBIE_DIFFICULTY[room.settings.zombieDifficulty] || ZOMBIE_DIFFICULTY.normal;
    const map = room.settings.mapId;
    const index = collisionIndexes.get(map);
    run.enemies = run.enemies.filter(enemy => enemy.isAlive);
    if (!run.enemies.length) {
      run.delay -= .05;
      if (run.delay <= 0) {
        if (run.wave === 5) {
          run.result = 'victory';
          triggerMatchFinish(room, player);
          continue;
        }
        run.wave++;
        run.delay = 3;
        const spawns = MAP_SPAWNS[map];
        const sorted = [...spawns].sort((a,b) =>
          Math.hypot(b.x-player.position.x,b.z-player.position.z) - Math.hypot(a.x-player.position.x,a.z-player.position.z));
        run.enemies = Array.from({length:run.wave+2+difficulty.extra}, (_,i) => ({
          id: 'zombie-'+run.wave+'-'+i, name:'Zombie', characterType:'zombie', color:'#659645',
          position:{...sorted[i%sorted.length]}, rotation:{yaw:0,pitch:0},
          health:Math.round((45+run.wave*12)*difficulty.health), deaths:0, isAlive:true, history:[], attack:0
        }));
      }
    }
    const now = performance.now();
    for (const enemy of run.enemies) {
      const p = enemy.position;
      const dx = player.position.x-p.x, dz = player.position.z-p.z;
      const distance = Math.hypot(dx,dz);
      const heading = Math.atan2(dx,dz);
      enemy.rotation.yaw = heading;
      enemy.isMoving = false;
      const eyeGap = player.position.y-p.y;
      const attackDistance = Math.hypot(distance,eyeGap);
      if (attackDistance < 1.65 && index.raycast(p,{x:dx/Math.max(.001,attackDistance),y:eyeGap/Math.max(.001,attackDistance),z:dz/Math.max(.001,attackDistance)},attackDistance) === null) {
        if (now >= enemy.attack) {
          enemy.attack = now+950;
          applyDamageAndCheckKill(room,room.id,enemy,player,Math.round((8+run.wave)*difficulty.damage),'Claws',false,false,p);
          if (!player.isAlive) break;
        }
      } else {
        // Try alternate headings near cover and reject ledges or unsupported ground.
        const step = .05*(2.3+run.wave*.24)*difficulty.speed;
        for (const offset of [0,.7,-.7,1.4,-1.4]) {
          const direction = {x:Math.sin(heading+offset),y:0,z:Math.cos(heading+offset)};
          const torso = {...p,y:p.y-.65};
          if (index.raycast(torso,direction,step+.34) !== null) continue;
          const next = {x:p.x+direction.x*step,y:p.y+.35,z:p.z+direction.z*step};
          const floor = index.raycast(next,{x:0,y:-1,z:0},2.35);
          if (floor === null || floor < 1.45) continue;
          next.y += 1.6-floor;
          enemy.position = next;
          enemy.isMoving = true;
          break;
        }
      }
      enemy.history.push({time:now,position:enemy.position});
      if (enemy.history.length > 8) enemy.history.shift();
    }
    if (room.zombies) io.to(room.id).volatile.emit('zombies-state', {
      wave:run.wave, enemies:run.enemies.map(({history,attack,...enemy})=>enemy)
    });
  }
},50).unref();

server.listen(PORT, '0.0.0.0', () => {
  const lanAddresses = getLanIpAddresses();
  console.log('====================================================');
  console.log('   🔫 RUNGUN - 3D MULTIPLAYER FPS (LAN READY) 🔫    ');
  console.log('====================================================');
  console.log(` Local Server:   http://localhost:${PORT}`);
  if (lanAddresses.length > 0) {
    console.log(' Network (LAN) URLs for friends on your Wi-Fi:');
    lanAddresses.forEach(({ iface, address }) => {
      console.log(`   ➜ [${iface}]: http://${address}:${PORT}`);
    });
  } else {
    console.log(` LAN IP: Connect to your local Wi-Fi router to share LAN URL.`);
  }
  console.log('====================================================');
  console.log(' Three.js served offline from /node_modules/three/');
  console.log(' Ready for players to host and join rooms!');
  console.log('====================================================');

  // Automatically launch default browser for the host player
  openBrowser(`http://localhost:${PORT}`);
});
