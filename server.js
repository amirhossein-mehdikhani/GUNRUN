// server.js - RUNGUN LAN Multiplayer FPS Server
import express from 'express';
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
  cors: { origin: '*' }
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

// Robust static file serving using readFileSync (eliminates pkg stream/compression truncation issues)
function serveStaticDir(dirPath) {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    let reqUrl = req.path;
    if (reqUrl === '' || reqUrl === '/') {
      reqUrl = '/index.html';
    }
    const cleanPath = path.normalize(decodeURIComponent(reqUrl)).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(dirPath, cleanPath);

    if (fs.existsSync(filePath)) {
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          const content = fs.readFileSync(filePath);
          const ext = path.extname(filePath).toLowerCase();
          const mime = mimeTypes[ext] || 'application/octet-stream';
          res.setHeader('Content-Type', mime);
          res.setHeader('Content-Length', content.length);
          res.setHeader('Cache-Control', 'public, max-age=0');
          if (req.method === 'HEAD') return res.end();
          return res.end(content);
        }
      } catch (e) {
        return next();
      }
    }
    next();
  };
}

// 1. Explicit handler for Socket.io client library (guarantees socket.io.js is never empty or 404)
app.get('/socket.io/socket.io.js', (req, res) => {
  const candidates = [
    resolveAssetPath('public', 'js', 'socket.io.min.js'),
    resolveAssetPath('node_modules', 'socket.io-client', 'dist', 'socket.io.min.js'),
    resolveAssetPath('node_modules', 'socket.io', 'client-dist', 'socket.io.min.js')
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      try {
        const content = fs.readFileSync(candidate);
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        res.setHeader('Content-Length', content.length);
        res.setHeader('Cache-Control', 'public, max-age=0');
        return res.end(content);
      } catch {}
    }
  }
  res.status(404).send('socket.io.js not found');
});

// 2. Explicit handler for Three.js ES module & addons
app.use('/node_modules/three', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const subPath = req.path;
  
  const candidates = [
    // Direct from vendor directory
    subPath.startsWith('/examples/jsm/')
      ? resolveAssetPath('public', 'vendor', 'three', 'jsm', subPath.slice('/examples/jsm/'.length))
      : resolveAssetPath('public', 'vendor', 'three', subPath.replace(/^\//, '')),
    // Direct from node_modules
    resolveAssetPath('node_modules', 'three', subPath.replace(/^\//, '')),
    // Fallback inside vendor
    resolveAssetPath('public', 'vendor', 'three', subPath.replace(/^\//, ''))
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      try {
        const stat = fs.statSync(candidate);
        if (stat.isFile()) {
          const content = fs.readFileSync(candidate);
          const ext = path.extname(candidate).toLowerCase();
          const mime = mimeTypes[ext] || 'application/javascript; charset=utf-8';
          res.setHeader('Content-Type', mime);
          res.setHeader('Content-Length', content.length);
          res.setHeader('Cache-Control', 'public, max-age=0');
          if (req.method === 'HEAD') return res.end();
          return res.end(content);
        }
      } catch {}
    }
  }
  next();
});

// 3. Serve all public static assets (HTML, CSS, JS, GLB 3D models)
const publicPath = resolveAssetPath('public');
app.use(serveStaticDir(publicPath));

// API endpoint to give client the exact LAN IPs
app.get('/api/lan-info', (req, res) => {
  res.json({
    port: PORT,
    addresses: getLanIpAddresses()
  });
});

// Dev endpoint to save rendered map & character preview thumbnails
app.post('/api/save-preview', express.json({ limit: '10mb' }), (req, res) => {
  try {
    const { category, name, dataUrl } = req.body;
    if (!category || !name || !dataUrl) return res.status(400).send('Missing params');
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const targetDir = path.join(publicPath, 'assets', 'images', category);
    fs.mkdirSync(targetDir, { recursive: true });
    const filePath = path.join(targetDir, `${name}.jpg`);
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    console.log(`[Preview Saved] ${category}/${name}.jpg (${base64Data.length} bytes)`);
    res.json({ ok: true, path: filePath });
  } catch (err) {
    console.error('Save preview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Fallback index.html
app.use((req, res) => {
  const indexPath = path.join(publicPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    const content = fs.readFileSync(indexPath);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Length', content.length);
    res.setHeader('Cache-Control', 'public, max-age=0');
    return res.end(content);
  }
  res.status(404).send('index.html not found');
});

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

// Map-specific arena spawn points (8 verified walkable raycasted spawns per authentic 3D GLB map)
const MAP_SPAWNS = {
  dust2: [
    { x: 34.0, y: 9.28, z: -40.0 },  // CT Spawn
    { x: -56.0, y: 7.57, z: -64.0 }, // T Spawn
    { x: 22.0, y: 6.72, z: 32.0 },   // Bombsite A
    { x: -50.0, y: 10.13, z: 44.0 }, // Bombsite B
    { x: 28.0, y: 6.72, z: 2.0 },    // Long A
    { x: -8.0, y: 10.13, z: 50.0 },  // Catwalk / Short A
    { x: -2.0, y: 3.37, z: -4.0 },   // Middle
    { x: -44.0, y: 7.57, z: -4.0 }   // Upper B Tunnels
  ],
  stalkyard: [
    { x: -18.0, y: 1.81, z: -16.0 },
    { x: 18.0, y: 1.81, z: -16.0 },
    { x: 0.0, y: 1.81, z: -16.0 },
    { x: -16.0, y: 2.66, z: 0.0 },
    { x: 10.0, y: 7.35, z: 10.0 },
    { x: 22.0, y: 1.81, z: 18.0 },
    { x: -22.0, y: 1.88, z: 18.0 },
    { x: 0.0, y: 6.07, z: 18.0 }
  ],
  turbine: [
    { x: 18.0, y: 8.54, z: -42.0 },
    { x: -26.0, y: 16.1, z: -10.0 },
    { x: 0.0, y: 20.99, z: 0.0 },
    { x: -15.0, y: 19.52, z: 25.0 },
    { x: 2.0, y: 11.97, z: -48.0 },
    { x: 6.0, y: 9.03, z: 46.0 },
    { x: 20.0, y: 10.1, z: -10.0 },
    { x: -33.9, y: 6.19, z: 33.3 }
  ],
  frenzy: [
    { x: 28.0, y: 1.88, z: -20.0 },
    { x: 15.0, y: 6.95, z: -22.0 },
    { x: 13.0, y: 6.7, z: 24.0 },
    { x: -30.0, y: 6.77, z: 10.0 },
    { x: -30.0, y: 6.9, z: -14.0 },
    { x: -4.9, y: 16.78, z: 28.0 },
    { x: 20.0, y: 6.83, z: 0.0 },
    { x: 5.0, y: 17.97, z: -5.0 }
  ],
  italy: [
    { x: -12.0, y: 7.01, z: 58.0 },
    { x: -18.0, y: 3.89, z: 42.0 },
    { x: -5.0, y: 3.7, z: 20.0 },
    { x: 0.0, y: 11.09, z: 0.0 },
    { x: 18.0, y: 3.68, z: -20.0 },
    { x: -25.0, y: 14.51, z: -52.0 },
    { x: 26.0, y: 15.33, z: -60.0 },
    { x: -15.0, y: 12.0, z: -20.0 }
  ]
};

// Aliases for backwards compatibility with existing room connections
MAP_SPAWNS.warehouse = MAP_SPAWNS.stalkyard;
MAP_SPAWNS.station = MAP_SPAWNS.turbine;
MAP_SPAWNS.desert = MAP_SPAWNS.frenzy;
MAP_SPAWNS.arena = MAP_SPAWNS.italy;
MAP_SPAWNS.colosseum = MAP_SPAWNS.italy;
MAP_SPAWNS.dungeon = MAP_SPAWNS.dust2;

const MAX_TEAM_SIZE = 5;
const TEAM_COLORS = {
  blue: '#3b82f6',
  red: '#ef4444'
};

function getRandomSpawn(mapId = 'dust2', excludeIndex = -1) {
  const spawns = MAP_SPAWNS[mapId] || MAP_SPAWNS.dust2;
  let idx = Math.floor(Math.random() * spawns.length);
  if (idx === excludeIndex && spawns.length > 1) {
    idx = (idx + 1) % spawns.length;
  }
  return { ...spawns[idx], spawnIndex: idx };
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

function getTeamSpawn(mapId = 'dust2', team = null, slotIndex = -1) {
  const spawns = MAP_SPAWNS[mapId] || MAP_SPAWNS.dust2;
  if (!team || spawns.length < 2) {
    return getRandomSpawn(mapId);
  }
  // Split spawn points by side: Blue uses [0, 2, 4, 5], Red uses [1, 3, 6, 7]
  const blueIndices = [0, 2, 4, 5].filter(i => i < spawns.length);
  const redIndices = [1, 3, 6, 7].filter(i => i < spawns.length);
  const pool = team === 'blue' ? blueIndices : redIndices;
  const pickIdx = slotIndex >= 0
    ? pool[slotIndex % pool.length]
    : pool[Math.floor(Math.random() * pool.length)];
  return { ...spawns[pickIdx], spawnIndex: pickIdx };
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

  room.status = 'ended';

  io.to(room.id).emit('match-finished', {
    gameMode: room.settings.gameMode || 'ffa',
    winningTeam,
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

    const newSpawn = currentRoom.settings.gameMode === 'tdm'
      ? getTeamSpawn(currentRoom.settings.mapId, victim.team)
      : getRandomSpawn(currentRoom.settings.mapId);

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
  let currentRoomId = null;

  // Send initial room list to newly connected player in lobby
  socket.emit('rooms-update', getPublicRoomList());

  // Ping-pong for measuring LAN latency
  socket.on('client-ping', (clientTimestamp) => {
    socket.emit('server-pong', clientTimestamp);
  });

  // Create a room
  socket.on('create-room', ({ roomName, playerName, playerColor, characterType, settings }) => {
    const roomId = 'room_' + Math.random().toString(36).substring(2, 8);
    const chosenMap = settings?.mapId || 'dust2';
    const gameMode = settings?.gameMode === 'tdm' ? 'tdm' : 'ffa';
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
      maxPlayers: gameMode === 'tdm' ? MAX_TEAM_SIZE * 2 : 12,
      teamScores: { blue: 0, red: 0 },
      settings: {
        mapId: chosenMap,
        gameMode: gameMode,
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
    socket.join(roomId);

    socket.emit('room-created', {
      room: newRoom,
      playerId: socket.id
    });

    io.emit('rooms-update', getPublicRoomList());
    console.log(`[Room Created] ${newRoom.name} (${roomId}) mode=${gameMode} by ${newRoom.hostName} on map ${chosenMap}`);
  });

  // Join an existing room
  socket.on('join-room', ({ roomId, playerName, playerColor, characterType, preferredTeam }) => {
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

    const spawn = isTdm
      ? getTeamSpawn(room.settings.mapId, assignedTeam)
      : getRandomSpawn(room.settings.mapId);

    const newPlayer = {
      id: socket.id,
      name: (playerName || 'Player').trim().substring(0, 16),
      color: playerColor || '#10b981',
      team: assignedTeam,
      characterType: characterType || 'soldier',
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
    socket.join(roomId);

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
    if (!player) return;
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
    if (!room || room.hostId !== socket.id) return;

    if (settings.mapId) room.settings.mapId = settings.mapId;
    if (settings.gravity) room.settings.gravity = settings.gravity;
    if (settings.scoreLimit) room.settings.scoreLimit = Math.min(Math.max(Number(settings.scoreLimit), 5), 50);

    if (settings.gameMode === 'tdm' || settings.gameMode === 'ffa') {
      room.settings.gameMode = settings.gameMode;
      if (settings.gameMode === 'tdm') {
        room.maxPlayers = MAX_TEAM_SIZE * 2;
        room.teamScores = { blue: 0, red: 0 };
        assignTeamsForAllPlayers(room);
      } else {
        room.maxPlayers = 12;
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

    room.status = 'in-game';
    room.teamScores = { blue: 0, red: 0 };

    const isTdm = room.settings.gameMode === 'tdm';
    const spawns = MAP_SPAWNS[room.settings.mapId] || MAP_SPAWNS.warehouse;
    let sIdx = 0;
    let blueSlot = 0;
    let redSlot = 0;

    for (const pid of Object.keys(room.players)) {
      const player = room.players[pid];
      const sp = isTdm
        ? getTeamSpawn(room.settings.mapId, player.team, player.team === 'blue' ? blueSlot++ : redSlot++)
        : spawns[sIdx % spawns.length];
      player.health = 100;
      player.kills = 0;
      player.deaths = 0;
      player.isAlive = true;
      player.position = { x: sp.x, y: sp.y, z: sp.z };
      sIdx++;
    }

    io.to(currentRoomId).emit('match-started', {
      room: room
    });

    io.emit('rooms-update', getPublicRoomList());
    console.log(`[Match Started] Room ${room.name} (${currentRoomId}) started (${room.settings.gameMode}) on ${room.settings.mapId}!`);
  });

  // In-game: Player Movement Sync
  socket.on('player-movement', (data) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || !room.players[socket.id]) return;

    const player = room.players[socket.id];
    player.position = data.position;
    player.rotation = data.rotation;
    player.isMoving = data.isMoving;
    player.isRunning = data.isRunning;
    player.isJumping = data.isJumping;

    // Relay to all other players in this room
    socket.to(currentRoomId).emit('player-moved', {
      id: socket.id,
      position: data.position,
      rotation: data.rotation,
      isMoving: data.isMoving,
      isRunning: data.isRunning,
      isJumping: data.isJumping
    });
  });

  // Weapon Switch Event
  socket.on('weapon-switch', ({ slot }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || !room.players[socket.id]) return;

    room.players[socket.id].activeWeaponSlot = slot;
    socket.to(currentRoomId).emit('player-weapon-switched', {
      playerId: socket.id,
      slot: slot
    });
  });

  // Throw Tactical Projectile (Frag or Flash)
  socket.on('throw-projectile', (data) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || !room.players[socket.id]) return;

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
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const thrower = room.players[data.throwerId] || room.players[socket.id];
    const expX = data.explosionPoint.x;
    const expY = data.explosionPoint.y;
    const expZ = data.explosionPoint.z;

    // Broadcast visual explosion effect to room
    socket.to(currentRoomId).emit('grenade-detonated', {
      explosionPoint: data.explosionPoint,
      throwerId: thrower?.id
    });

    // Calculate AoE damage for each alive player in room
    for (const victim of Object.values(room.players)) {
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
    if (!currentRoomId) return;
    socket.to(currentRoomId).emit('flash-detonated', {
      position: data.position,
      throwerId: socket.id
    });
  });

  // In-game: Shooting & Hit Registration
  socket.on('player-shoot', (data) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || !room.players[socket.id]) return;

    const shooter = room.players[socket.id];
    if (!shooter.isAlive) return;

    // Broadcast visual/audio shooting effect to everyone else in room
    socket.to(currentRoomId).emit('player-shot-effect', {
      shooterId: socket.id,
      origin: data.origin,
      direction: data.direction,
      hitPoint: data.hitPoint,
      weaponSlot: data.weaponSlot || 1
    });

    // Check hit registration
    if (data.hitPlayerId && room.players[data.hitPlayerId]) {
      const victim = room.players[data.hitPlayerId];
      if (!victim.isAlive) return;

      // Damage calculation based on weapon type
      let damage = 20;
      let weaponName = 'Assault Rifle 🔫';

      if (data.weaponSlot === 2) {
        damage = data.isHeadshot ? 100 : 35;
        weaponName = 'Semi-Auto DMR 🎯';
      } else if (data.weaponSlot === 3) {
        damage = data.isHeadshot ? 200 : 100;
        weaponName = 'Heavy Sniper 🎯';
      } else if (data.weaponSlot === 4) {
        damage = (data.isBackstab || data.isHeadshot) ? 120 : 55;
        weaponName = data.isBackstab ? 'Knife Backstab 🔪' : 'Combat Knife 🔪';
      } else {
        damage = data.isHeadshot ? 100 : 18;
      }

      applyDamageAndCheckKill(
        room,
        currentRoomId,
        shooter,
        victim,
        damage,
        weaponName,
        !!data.isHeadshot,
        false,
        data.hitPoint
      );
    }
  });

  // Rematch / Restart Match
  socket.on('rematch-request', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const isTdm = room.settings.gameMode === 'tdm';
    const spawns = MAP_SPAWNS[room.settings.mapId] || MAP_SPAWNS.warehouse;
    let sIdx = 0;
    let blueIdx = 0;
    let redIdx = 0;

    for (const pid of Object.keys(room.players)) {
      const player = room.players[pid];
      const sp = isTdm
        ? getTeamSpawn(room.settings.mapId, player.team, player.team === 'red' ? redIdx++ : blueIdx++)
        : spawns[sIdx % spawns.length];
      player.health = 100;
      player.kills = 0;
      player.deaths = 0;
      player.isAlive = true;
      player.position = { x: sp.x, y: sp.y, z: sp.z };
      sIdx++;
    }
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
    if (!room) return;

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
  });

  // Disconnect
  socket.on('disconnect', () => {
    handleLeaveRoom(socket, currentRoomId);
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
