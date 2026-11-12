// game.js - Core FPS Game Engine: Multi-Weapon Loadout, Tactical Grenades, Pause Menu & End-Match Systems
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { ArenaMap } from './map.js';
import { WeaponController } from './weapon.js';
import { ProjectileManager } from './projectiles.js';
import { RemotePlayer, preloadCharacterModel } from './character.js';
import { SoundEffects } from './audio.js';

class GameApp {
  constructor() {
    this.socket = io();
    this.localPlayerId = null;
    this.currentRoom = null;
    this.remotePlayers = new Map();

    // Game states: 'lobby' | 'room' | 'playing' | 'dead' | 'ended'
    this.state = 'lobby';

    // Three.js Core
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.clock = new THREE.Clock();

    // Game Systems
    this.arenaMap = null;
    this.weapon = null;
    this.projectiles = null;
    this.raycaster = new THREE.Raycaster();

    // Tactical Throwables
    this.fragCount = 2;
    this.flashCount = 2;

    // Movement & Physics
    this.playerVelocity = new THREE.Vector3();
    this.moveInput = { forward: false, backward: false, left: false, right: false, sprint: false };
    this.isGrounded = true;
    this.jumpRequested = false;
    this.jumpRequestTimer = 0;
    this.playerHeight = 1.6;
    this.gravity = 24.0;
    this.jumpForce = 9.5;
    this.moveSpeed = 8.0;
    this.sprintMultiplier = 1.45;
    this.lastSafePos = null;
    this._mapSnapDone = false;

    // Shooting state
    this.isMouseDown = false;
    this.screenShakeTime = 0;
    this.screenShakeIntensity = 0;

    // Player Stats
    this.health = 100;
    this.isAlive = true;
    this.kills = 0;
    this.deaths = 0;

    // Selections
    this.selectedCharacter = 'soldier';
    this.selectedMap = 'dust2';
    this.selectedColor = '#3b82f6';

    // Network Sync Throttle
    this.lastNetworkSync = 0;
    this.networkSyncInterval = 1000 / 30; // 30Hz

    // DOM UI Elements
    this.cacheDomElements();
    this.initSocketEvents();
    this.initThree();
    this.initControls();
    this.initLobbyUI();

    // Start render loop
    requestAnimationFrame((t) => this.animate(t));
  }

  cacheDomElements() {
    // Screens
    this.screenLobby = document.getElementById('screen-lobby');
    this.screenWaiting = document.getElementById('screen-waiting');
    this.pauseMenuScreen = document.getElementById('pause-menu-screen');
    this.hud = document.getElementById('game-hud');
    this.respawnScreen = document.getElementById('respawn-screen');
    this.scoreboardModal = document.getElementById('scoreboard-modal');
    this.matchEndModal = document.getElementById('match-end-modal');

    // Overlays & Scopes
    this.sniperScopeOverlay = document.getElementById('sniper-scope-overlay');
    this.flashbangOverlay = document.getElementById('flashbang-overlay');
    this.crosshairElem = document.getElementById('crosshair');

    // Loadout Bar & HUD Counters
    this.loadoutSlots = document.querySelectorAll('#weapon-loadout-bar .loadout-slot[data-slot]');
    this.hudFragCount = document.getElementById('hud-frag-count');
    this.hudFlashCount = document.getElementById('hud-flash-count');
    this.hudWeaponName = document.getElementById('hud-weapon-name');

    // Pause Menu Elements
    this.btnPauseResume = document.getElementById('btn-pause-resume');
    this.btnPauseRematch = document.getElementById('btn-pause-rematch');
    this.btnPauseFinish = document.getElementById('btn-pause-finish');
    this.btnPauseLeave = document.getElementById('btn-pause-leave');
    this.pauseRoomInfo = document.getElementById('pause-room-info');

    // Lobby Inputs & Selectors
    this.nicknameInput = document.getElementById('player-nickname');
    this.roomNameInput = document.getElementById('room-name');
    this.gameModeSelect = document.getElementById('game-mode-select');
    this.gravitySelect = document.getElementById('gravity-select');
    this.scoreLimitSelect = document.getElementById('score-limit-select');
    this.btnCreateRoom = document.getElementById('btn-create-room');
    this.roomsListContainer = document.getElementById('rooms-list');
    this.colorOptions = document.querySelectorAll('.color-option');
    this.characterCards = document.querySelectorAll('#character-selector .character-card');
    this.mapCards = document.querySelectorAll('#map-selector .map-card');

    // 3-Tab Lobby Elements
    this.lobbyTabBtns = document.querySelectorAll('.lobby-tab-btn');
    this.tabPanes = document.querySelectorAll('.tab-pane');
    this.tabPillMap = document.getElementById('tab-pill-map');
    this.tabPillChar = document.getElementById('tab-pill-char');
    this.mapGalleryCards = document.querySelectorAll('.map-gallery-card');
    this.characterGalleryCards = document.querySelectorAll('.character-gallery-card');
    this.homeQuickCharCard = document.getElementById('home-quick-char-card');
    this.homeQuickCharImg = document.getElementById('home-quick-char-img');
    this.homeQuickCharTitle = document.getElementById('home-quick-char-title');
    this.homeQuickCharDesc = document.getElementById('home-quick-char-desc');
    this.homeQuickCharColorDot = document.getElementById('home-quick-char-colordot');
    this.homeQuickMapCard = document.getElementById('home-quick-map-card');
    this.homeQuickMapImg = document.getElementById('home-quick-map-img');
    this.homeQuickMapTitle = document.getElementById('home-quick-map-title');
    this.homeQuickMapDesc = document.getElementById('home-quick-map-desc');
    this.tabSwitchBtns = document.querySelectorAll('[data-switch-tab]');

    // Waiting Room UI
    this.waitingRoomTitle = document.getElementById('waiting-room-title');
    this.waitingPlayerList = document.getElementById('waiting-player-list');
    this.waitingFfaContainer = document.getElementById('waiting-ffa-container');
    this.waitingTeamsContainer = document.getElementById('waiting-teams-container');
    this.waitingBlueList = document.getElementById('waiting-blue-list');
    this.waitingRedList = document.getElementById('waiting-red-list');
    this.blueCountBadge = document.getElementById('blue-count');
    this.redCountBadge = document.getElementById('red-count');
    this.btnJoinBlue = document.getElementById('btn-join-blue');
    this.btnJoinRed = document.getElementById('btn-join-red');
    this.waitingHostModeSelect = document.getElementById('waiting-host-mode-select');
    this.waitingSettingsSummary = document.getElementById('waiting-settings-summary');
    this.btnStartMatch = document.getElementById('btn-start-match');
    this.btnLeaveRoom = document.getElementById('btn-leave-room');
    this.waitingHostStatus = document.getElementById('waiting-host-status');
    this.hostMapControl = document.getElementById('host-map-control');
    this.waitingMapCards = document.querySelectorAll('#waiting-map-selector .map-card');

    // In-game HUD elements
    this.hudHealthVal = document.getElementById('hud-health-val');
    this.hudHealthBar = document.getElementById('hud-health-bar');
    this.hudAmmoVal = document.getElementById('hud-ammo-val');
    this.hudReloadPrompt = document.getElementById('hud-reload-prompt');
    this.hudMatchScore = document.getElementById('hud-match-score');
    this.hudGravityBadge = document.getElementById('hud-gravity-badge');
    this.hudMapBadge = document.getElementById('hud-map-badge');
    this.killFeed = document.getElementById('kill-feed');
    this.hitmarker = document.getElementById('hitmarker');
    this.damageVignette = document.getElementById('damage-vignette');
    this.respawnCount = document.getElementById('respawn-count');
    this.respawnKillerText = document.getElementById('respawn-killer-text');
    this.scoreboardBody = document.getElementById('scoreboard-body');
    this.hudPing = document.getElementById('hud-ping');
    this.hudFps = document.getElementById('hud-fps');
    this.lanHostIpBadge = document.getElementById('lan-host-ip');
    this.btnCopyLanFooter = document.getElementById('btn-copy-lan-footer');
    this.currentLanUrl = window.location.origin;

    // Match End Elements
    this.winnerTitle = document.getElementById('winner-title');
    this.matchEndTeamScores = document.getElementById('match-end-team-scores');
    this.mvpName = document.getElementById('mvp-name');
    this.mvpStat = document.getElementById('mvp-stat');
    this.finalScoreboardBody = document.getElementById('final-scoreboard-body');
    this.btnEndRematch = document.getElementById('btn-end-rematch');
    this.btnEndRoomLobby = document.getElementById('btn-end-room-lobby');
    this.btnEndLeave = document.getElementById('btn-end-leave');
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07090e);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, this.playerHeight, 0);

    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Build Arena Map system
    this.arenaMap = new ArenaMap(this.scene);

    // Build Multi-Weapon Controller
    this.weapon = new WeaponController(this.camera, this.scene);
    this.scene.add(this.camera);

    // Build Tactical Projectile Manager (Frag & Flashbang)
    this.projectiles = new ProjectileManager(this.scene, this.arenaMap, this.camera);

    // Preload character models
    preloadCharacterModel();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initControls() {
    this.controls = new PointerLockControls(this.camera, document.body);

    this.controls.addEventListener('lock', () => {
      if (this.state === 'playing') {
        this.pauseMenuScreen.classList.add('hidden');
      }
    });

    // When ESC is pressed or Pointer Lock released
    this.controls.addEventListener('unlock', () => {
      this.isMouseDown = false;
      if (this.state === 'playing' && this.isAlive) {
        if (this.weapon.isScoped) {
          this.weapon.toggleScope(false);
          this.sniperScopeOverlay.classList.add('hidden');
          this.crosshairElem.style.display = 'block';
        }
        this.updatePauseMenuState();
        this.pauseMenuScreen.classList.remove('hidden');
      }
    });

    // Prevent default right-click context menu in match
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mouse Controls (Shoot & Scope)
    window.addEventListener('mousedown', (e) => {
      if (!this.controls.isLocked || this.state !== 'playing' || !this.isAlive) return;

      if (e.button === 0) {
        // Left Click: Shoot or Slash
        this.isMouseDown = true;
        this.handleShoot();
      } else if (e.button === 2) {
        // Right Click: Toggle Sniper Scope Zoom
        if (this.weapon.currentSlot === 3) {
          const isScoped = this.weapon.toggleScope();
          this.sniperScopeOverlay.classList.toggle('hidden', !isScoped);
          this.crosshairElem.style.display = isScoped ? 'none' : 'block';
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMouseDown = false;
      }
    });

    // Mouse Wheel weapon cycle
    window.addEventListener('wheel', (e) => {
      if (!this.controls.isLocked || this.state !== 'playing' || !this.isAlive) return;
      let nextSlot = this.weapon.currentSlot + (e.deltaY > 0 ? 1 : -1);
      if (nextSlot > 4) nextSlot = 1;
      if (nextSlot < 1) nextSlot = 4;
      this.switchWeaponSlot(nextSlot);
    });

    // Keyboard Controls
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      switch (e.code) {
        case 'KeyW': this.moveInput.forward = true; break;
        case 'KeyS': this.moveInput.backward = true; break;
        case 'KeyA': this.moveInput.left = true; break;
        case 'KeyD': this.moveInput.right = true; break;
        case 'ShiftLeft':
        case 'ShiftRight': this.moveInput.sprint = true; break;
        case 'Space':
          if (this.isAlive && this.controls.isLocked) {
            this.jumpRequested = true;
            this.jumpRequestTimer = 0.2; // 200ms jump buffer
            if (this.isGrounded) {
              this.playerVelocity.y = this.jumpForce;
              this.isGrounded = false;
              this.jumpRequested = false;
              this.jumpRequestTimer = 0;
              SoundEffects.playJump();
            }
          }
          break;
        case 'KeyR':
          if (this.state === 'playing' && this.isAlive) {
            this.weapon.reload();
            this.updateHudAmmo();
          }
          break;
        case 'Digit1': this.switchWeaponSlot(1); break;
        case 'Digit2': this.switchWeaponSlot(2); break;
        case 'Digit3': this.switchWeaponSlot(3); break;
        case 'Digit4': this.switchWeaponSlot(4); break;
        case 'KeyG': this.throwFragGrenade(); break;
        case 'KeyF': this.throwFlashbang(); break;
        case 'Tab':
          e.preventDefault();
          this.scoreboardModal.classList.add('visible');
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW': this.moveInput.forward = false; break;
        case 'KeyS': this.moveInput.backward = false; break;
        case 'KeyA': this.moveInput.left = false; break;
        case 'KeyD': this.moveInput.right = false; break;
        case 'ShiftLeft':
        case 'ShiftRight': this.moveInput.sprint = false; break;
        case 'Tab':
          e.preventDefault();
          this.scoreboardModal.classList.remove('visible');
          break;
      }
    });
  }

  // ==========================================
  // WEAPON LOADOUT & TACTICAL THROWABLES
  // ==========================================
  switchWeaponSlot(slotIndex) {
    if (this.weapon.currentSlot === slotIndex) return;

    // Reset scope if leaving sniper
    if (this.weapon.isScoped) {
      this.weapon.toggleScope(false);
      this.sniperScopeOverlay.classList.add('hidden');
      this.crosshairElem.style.display = 'block';
    }

    this.weapon.equipSlot(slotIndex);

    // Update Loadout Bar UI
    this.loadoutSlots.forEach(slot => {
      slot.classList.toggle('active', Number(slot.dataset.slot) === slotIndex);
    });

    // Update HUD ammo & weapon label
    this.updateHudAmmo();
    if (this.hudWeaponName) {
      this.hudWeaponName.textContent = `${this.weapon.config.name.toUpperCase()} - ${this.weapon.config.code}`;
    }

    // Sync weapon switch over LAN
    this.socket.emit('weapon-switch', { slot: slotIndex });
  }

  throwFragGrenade() {
    if (this.fragCount <= 0 || !this.isAlive || !this.controls.isLocked) return;

    this.fragCount--;
    this.updateThrowableHud();

    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);

    const spawnPos = this.camera.position.clone().addScaledVector(camDir, 0.6);
    const velocity = camDir.clone().multiplyScalar(22).add(new THREE.Vector3(0, 3.5, 0));
    const projId = 'frag_' + Math.random().toString(36).substring(2, 9);

    // Spawn locally
    this.projectiles.spawnProjectile('frag', spawnPos, velocity, true, projId, (detonatePos) => {
      this.socket.emit('grenade-explode', {
        explosionPoint: { x: detonatePos.x, y: detonatePos.y, z: detonatePos.z },
        throwerId: this.localPlayerId
      });
    });

    // Broadcast throw event over LAN
    this.socket.emit('throw-projectile', {
      id: projId,
      type: 'frag',
      origin: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
      velocity: { x: velocity.x, y: velocity.y, z: velocity.z }
    });

    this.addFeedItem('💣 Frag grenade thrown!');
  }

  throwFlashbang() {
    if (this.flashCount <= 0 || !this.isAlive || !this.controls.isLocked) return;

    this.flashCount--;
    this.updateThrowableHud();

    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);

    const spawnPos = this.camera.position.clone().addScaledVector(camDir, 0.6);
    const velocity = camDir.clone().multiplyScalar(24).add(new THREE.Vector3(0, 3.2, 0));
    const projId = 'flash_' + Math.random().toString(36).substring(2, 9);

    // Spawn locally
    this.projectiles.spawnProjectile('flash', spawnPos, velocity, true, projId, (detonatePos) => {
      this.socket.emit('flash-detonate', {
        position: { x: detonatePos.x, y: detonatePos.y, z: detonatePos.z }
      });
    });

    // Broadcast throw event over LAN
    this.socket.emit('throw-projectile', {
      id: projId,
      type: 'flash',
      origin: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
      velocity: { x: velocity.x, y: velocity.y, z: velocity.z }
    });

    this.addFeedItem('⚡ Flashbang deployed!');
  }

  updateThrowableHud() {
    if (this.hudFragCount) this.hudFragCount.textContent = this.fragCount;
    if (this.hudFlashCount) this.hudFlashCount.textContent = this.flashCount;
  }

  triggerScreenShake(duration = 0.35, intensity = 0.4) {
    this.screenShakeTime = duration;
    this.screenShakeIntensity = intensity;
  }

  updatePauseMenuState() {
    if (!this.currentRoom) return;
    const isHost = (this.currentRoom.hostId === this.localPlayerId);
    const mapNames = {
      dust2: 'DUST II',
      stalkyard: 'STALKYARD',
      turbine: 'DM-TURBINE',
      frenzy: 'FRENZY',
      italy: 'CS ITALY',
      warehouse: 'STALKYARD',
      station: 'DM-TURBINE',
      desert: 'FRENZY',
      arena: 'CS ITALY',
      colosseum: 'CS ITALY',
      dungeon: 'DUST II'
    };
    const mName = mapNames[this.currentRoom.settings?.mapId] || 'TACTICAL ARENA';

    if (this.pauseRoomInfo) {
      this.pauseRoomInfo.textContent = `ROOM: ${this.currentRoom.name.toUpperCase()} | MAP: ${mName} | GRAVITY: ${this.currentRoom.settings?.gravity?.toUpperCase()}`;
    }

    if (this.btnPauseFinish) {
      this.btnPauseFinish.style.display = isHost ? 'inline-flex' : 'none';
    }
  }

  initLobbyUI() {
    const randomNum = Math.floor(100 + Math.random() * 900);
    this.nicknameInput.value = `Soldier_${randomNum}`;

    // 3-Tab Lobby Navigation
    this.lobbyTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchLobbyTab(btn.dataset.tab);
      });
    });

    this.tabSwitchBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchLobbyTab(btn.dataset.switchTab);
      });
    });

    // Color picker
    this.colorOptions.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.colorOptions.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedColor = btn.dataset.color;
        const dot = document.getElementById('home-quick-char-colordot');
        if (dot) dot.style.background = this.selectedColor;
      });
    });

    // Character Gallery Selector
    this.characterGalleryCards.forEach((card) => {
      card.addEventListener('click', () => {
        this.selectCharacter(card.dataset.character);
      });
    });

    // Map Gallery Selector
    this.mapGalleryCards.forEach((card) => {
      card.addEventListener('click', () => {
        this.selectMap(card.dataset.map);
      });
    });

    // Compatibility Character & Map Cards
    this.characterCards.forEach((card) => {
      card.addEventListener('click', () => {
        this.selectCharacter(card.dataset.character);
      });
    });

    this.mapCards.forEach((card) => {
      card.addEventListener('click', () => {
        this.selectMap(card.dataset.map);
      });
    });

    // Set initial map and character showcase states
    this.selectMap(this.selectedMap || 'dust2');
    this.selectCharacter(this.selectedCharacter || 'soldier');

    // Host Map & Mode Selectors in Waiting Room
    this.waitingMapCards.forEach((card) => {
      card.addEventListener('click', () => {
        if (this.currentRoom && this.currentRoom.hostId === this.localPlayerId) {
          this.waitingMapCards.forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          this.socket.emit('update-room-settings', {
            settings: { mapId: card.dataset.map }
          });
        }
      });
    });

    if (this.waitingHostModeSelect) {
      this.waitingHostModeSelect.addEventListener('change', () => {
        if (this.currentRoom && this.currentRoom.hostId === this.localPlayerId) {
          this.socket.emit('update-room-settings', {
            settings: { gameMode: this.waitingHostModeSelect.value }
          });
        }
      });
    }

    if (this.btnJoinBlue) {
      this.btnJoinBlue.addEventListener('click', () => {
        this.socket.emit('switch-team', { team: 'blue' });
      });
    }

    if (this.btnJoinRed) {
      this.btnJoinRed.addEventListener('click', () => {
        this.socket.emit('switch-team', { team: 'red' });
      });
    }

    // Weapon Loadout Hotbar Clicks
    this.loadoutSlots.forEach(slot => {
      slot.addEventListener('click', () => {
        if (this.controls.isLocked && this.state === 'playing') {
          this.switchWeaponSlot(Number(slot.dataset.slot));
        }
      });
    });

    // Create Room Button
    this.btnCreateRoom.addEventListener('click', () => {
      const roomName = this.roomNameInput.value.trim() || 'Tactical Dust';
      const playerName = this.nicknameInput.value.trim() || 'Soldier';
      const gameMode = this.gameModeSelect ? this.gameModeSelect.value : 'ffa';
      const gravity = this.gravitySelect.value;
      const scoreLimit = Number(this.scoreLimitSelect.value) || 15;

      this.socket.emit('create-room', {
        roomName,
        playerName,
        playerColor: this.selectedColor,
        characterType: this.selectedCharacter,
        settings: {
          mapId: this.selectedMap,
          gameMode,
          gravity,
          scoreLimit
        }
      });
    });

    // Start Match Button (Host only)
    this.btnStartMatch.addEventListener('click', () => {
      if (this.currentRoom && this.currentRoom.hostId === this.localPlayerId) {
        this.socket.emit('start-match');
      }
    });

    // Leave Room Button in Waiting Room
    this.btnLeaveRoom.addEventListener('click', () => {
      this.socket.emit('leave-room');
      this.leaveToLobby();
    });

    // Pause Menu Buttons
    this.btnPauseResume.addEventListener('click', () => {
      if (this.state === 'playing' && this.isAlive) {
        this.controls.lock();
      }
    });

    this.btnPauseRematch.addEventListener('click', () => {
      this.socket.emit('rematch-request');
    });

    this.btnPauseFinish.addEventListener('click', () => {
      if (this.currentRoom && this.currentRoom.hostId === this.localPlayerId) {
        this.socket.emit('finish-match-request');
      }
    });

    this.btnPauseLeave.addEventListener('click', () => {
      this.socket.emit('leave-room');
      this.leaveToLobby();
    });

    // Match End Buttons
    this.btnEndRematch.addEventListener('click', () => {
      this.socket.emit('rematch-request');
    });

    this.btnEndRoomLobby.addEventListener('click', () => {
      this.socket.emit('return-to-lobby-request');
    });

    this.btnEndLeave.addEventListener('click', () => {
      this.socket.emit('leave-room');
      this.leaveToLobby();
    });

    // LAN URL copy buttons
    if (this.lanHostIpBadge) {
      this.lanHostIpBadge.addEventListener('click', () => {
        this.copyLanUrlToClipboard();
      });
    }

    if (this.btnCopyLanFooter) {
      this.btnCopyLanFooter.addEventListener('click', () => {
        this.copyLanUrlToClipboard();
      });
    }

    // LAN Ping test loop
    setInterval(() => {
      this.socket.emit('client-ping', performance.now());
    }, 2000);

    this.fetchLanInfo();
  }

  switchLobbyTab(tabName) {
    if (!tabName) return;
    this.lobbyTabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    this.tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-pane-${tabName}`);
    });
  }

  selectMap(mapId) {
    if (!mapId) return;
    this.selectedMap = mapId;

    // Update showcase gallery cards
    this.mapGalleryCards.forEach(card => {
      card.classList.toggle('selected', card.dataset.map === mapId);
    });

    // Update legacy/hidden map selector cards
    this.mapCards.forEach(card => {
      card.classList.toggle('selected', card.dataset.map === mapId);
    });

    const mapInfoDict = {
      dust2: { title: 'Dust II', subtitle: 'CS de_dust2 (Counter-Strike)', img: '/assets/images/maps/dust2.jpg' },
      stalkyard: { title: 'Stalkyard', subtitle: 'Half-Life Deathmatch', img: '/assets/images/maps/stalkyard.jpg' },
      turbine: { title: 'DM-Turbine', subtitle: 'Unreal Tournament', img: '/assets/images/maps/turbine.jpg' },
      frenzy: { title: 'Frenzy', subtitle: 'Half-Life Crossfire', img: '/assets/images/maps/frenzy.jpg' },
      italy: { title: 'cs_italy', subtitle: 'Counter-Strike', img: '/assets/images/maps/italy.jpg' }
    };

    const info = mapInfoDict[mapId] || mapInfoDict.dust2;
    if (this.tabPillMap) this.tabPillMap.textContent = info.title;
    if (this.homeQuickMapImg) this.homeQuickMapImg.src = info.img;
    if (this.homeQuickMapTitle) this.homeQuickMapTitle.textContent = info.title;
    if (this.homeQuickMapDesc) this.homeQuickMapDesc.textContent = info.subtitle;
  }

  selectCharacter(charId) {
    if (!charId) return;
    this.selectedCharacter = charId;

    // Update showcase gallery cards
    this.characterGalleryCards.forEach(card => {
      card.classList.toggle('selected', card.dataset.character === charId);
    });

    // Update legacy/hidden character selector cards
    this.characterCards.forEach(card => {
      card.classList.toggle('selected', card.dataset.character === charId);
    });

    const charInfoDict = {
      soldier: { title: 'Soldier', desc: 'Tactical Commando', img: '/assets/images/characters/soldier.jpg' },
      robot: { title: 'Cyber Mech', desc: 'Recon Droid', img: '/assets/images/characters/robot.jpg' },
      cyborg: { title: 'Cyborg', desc: 'Spec-Ops Android (Xbot)', img: '/assets/images/characters/cyborg.jpg' },
      heavy: { title: 'Titan Mech', desc: 'Heavy Juggernaut', img: '/assets/images/characters/heavy.jpg' }
    };

    const info = charInfoDict[charId] || charInfoDict.soldier;
    if (this.tabPillChar) this.tabPillChar.textContent = info.title;
    if (this.homeQuickCharImg) this.homeQuickCharImg.src = info.img;
    if (this.homeQuickCharTitle) {
      this.homeQuickCharTitle.innerHTML = `${info.title} <span id="home-quick-char-colordot" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${this.selectedColor};"></span>`;
    }
    if (this.homeQuickCharDesc) this.homeQuickCharDesc.textContent = info.desc;
  }

  async fetchLanInfo() {
    try {
      const res = await fetch('/api/lan-info');
      const data = await res.json();
      if (data && data.addresses && data.addresses.length > 0) {
        const preferred = data.addresses.find(a => /wi-fi|wlan|eth|en/i.test(a.iface)) || data.addresses[0];
        const lanUrl = `http://${preferred.address}:${data.port}`;
        this.currentLanUrl = lanUrl;
        if (this.lanHostIpBadge) {
          this.lanHostIpBadge.innerHTML = `<span>📡 LAN URL: <b style="color:var(--primary);">${lanUrl}</b></span> <span class="lan-copy-pill">📋 Copy</span>`;
        }
      } else {
        this.currentLanUrl = window.location.origin;
        if (this.lanHostIpBadge) {
          this.lanHostIpBadge.innerHTML = `<span>📡 URL: <b style="color:var(--primary);">${this.currentLanUrl}</b></span> <span class="lan-copy-pill">📋 Copy</span>`;
        }
      }
    } catch {
      this.currentLanUrl = window.location.origin;
      if (this.lanHostIpBadge) {
        this.lanHostIpBadge.innerHTML = `<span>📡 URL: <b style="color:var(--primary);">${this.currentLanUrl}</b></span> <span class="lan-copy-pill">📋 Copy</span>`;
      }
    }
  }

  copyLanUrlToClipboard() {
    const url = this.currentLanUrl || window.location.origin;

    const fallbackCopy = (text) => {
      try {
        const t = document.createElement('textarea');
        t.value = text;
        t.style.position = 'fixed';
        t.style.top = '0';
        t.style.left = '0';
        t.style.opacity = '0';
        t.style.pointerEvents = 'none';
        document.body.appendChild(t);
        t.focus();
        t.select();
        const success = document.execCommand('copy');
        document.body.removeChild(t);
        return success;
      } catch (err) {
        console.warn('Fallback copy error:', err);
        return false;
      }
    };

    if (navigator.clipboard && window.isSecureContext && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).catch(() => fallbackCopy(url));
    } else {
      fallbackCopy(url);
    }

    if (this.lanHostIpBadge) {
      const origHtml = this.lanHostIpBadge.innerHTML;
      this.lanHostIpBadge.classList.add('copied');
      this.lanHostIpBadge.innerHTML = `<span>✓ COPIED! <b style="color:#10b981;">${url}</b></span>`;
      setTimeout(() => {
        this.lanHostIpBadge.classList.remove('copied');
        this.lanHostIpBadge.innerHTML = origHtml;
      }, 2200);
    }

    if (this.btnCopyLanFooter) {
      const origText = this.btnCopyLanFooter.innerHTML;
      this.btnCopyLanFooter.textContent = '✓ Copied!';
      this.btnCopyLanFooter.style.borderColor = '#10b981';
      this.btnCopyLanFooter.style.color = '#10b981';
      setTimeout(() => {
        this.btnCopyLanFooter.innerHTML = origText;
        this.btnCopyLanFooter.style.borderColor = '';
        this.btnCopyLanFooter.style.color = '';
      }, 2200);
    }
  }

  initSocketEvents() {
    this.socket.on('server-pong', (clientTimestamp) => {
      const rtt = Math.round(performance.now() - clientTimestamp);
      if (this.hudPing) this.hudPing.textContent = `LAN Ping: ${rtt}ms`;
    });

    this.socket.on('rooms-update', (rooms) => {
      this.renderRoomsList(rooms);
    });

    this.socket.on('room-created', ({ room, playerId }) => {
      this.localPlayerId = playerId;
      this.currentRoom = room;
      this.openWaitingRoom(room, true);
    });

    this.socket.on('room-joined', ({ room, playerId }) => {
      this.localPlayerId = playerId;
      this.currentRoom = room;
      const isHost = (room.hostId === playerId);
      this.openWaitingRoom(room, isHost);
    });

    this.socket.on('join-error', (msg) => {
      alert(msg);
    });

    this.socket.on('team-switch-error', (msg) => {
      alert(msg);
    });

    this.socket.on('room-updated', ({ room }) => {
      if (!room) return;
      this.currentRoom = room;
      if (this.waitingHostModeSelect) {
        this.waitingHostModeSelect.value = room.settings?.gameMode || 'ffa';
      }
      this.waitingMapCards.forEach(c => {
        c.classList.toggle('selected', c.dataset.map === (room.settings?.mapId || 'dust2'));
      });
      this.updateWaitingSettingsSummary();
      this.updateWaitingPlayerList();
    });

    this.socket.on('player-joined-room', (player) => {
      if (!this.currentRoom) return;
      this.currentRoom.players[player.id] = player;
      this.updateWaitingPlayerList();
    });

    this.socket.on('player-left-room', ({ playerId, playerName }) => {
      if (this.currentRoom && this.currentRoom.players[playerId]) {
        delete this.currentRoom.players[playerId];
        this.updateWaitingPlayerList();
      }

      if (this.remotePlayers.has(playerId)) {
        this.remotePlayers.get(playerId).destroy();
        this.remotePlayers.delete(playerId);
      }

      this.addFeedItem(`${playerName} left the match.`);
    });

    this.socket.on('host-changed', ({ newHostId, newHostName }) => {
      if (!this.currentRoom) return;
      this.currentRoom.hostId = newHostId;
      this.currentRoom.hostName = newHostName;
      const isMe = (newHostId === this.localPlayerId);
      if (isMe) {
        this.btnStartMatch.style.display = 'inline-flex';
        this.hostMapControl.style.display = 'block';
        this.waitingHostStatus.textContent = 'You are now the room Host! Click Start Match when ready.';
      } else {
        this.btnStartMatch.style.display = 'none';
        this.hostMapControl.style.display = 'none';
        this.waitingHostStatus.textContent = `Waiting for host (${newHostName}) to start match...`;
      }
      this.updateWaitingPlayerList();
      this.updatePauseMenuState();
    });

    this.socket.on('room-settings-updated', (settings) => {
      if (this.currentRoom) {
        this.currentRoom.settings = settings;
        this.updateWaitingSettingsSummary();

        this.waitingMapCards.forEach(c => {
          c.classList.toggle('selected', c.dataset.map === settings.mapId);
        });
      }
    });

    // MATCH STARTED
    this.socket.on('match-started', ({ room }) => {
      this.currentRoom = room;
      this.startMatchSession();
    });

    // REMATCH STARTED
    this.socket.on('match-restarted', ({ room }) => {
      this.currentRoom = room;
      this.matchEndModal.classList.remove('active');
      this.matchEndModal.classList.add('hidden');
      this.pauseMenuScreen.classList.add('hidden');
      this.startMatchSession();
      this.addFeedItem('🔄 REMATCH STARTED! Round reset.');
    });

    // MATCH FINISHED
    this.socket.on('match-finished', (data) => {
      this.state = 'ended';
      this.controls.unlock();
      this.hud.classList.remove('active');
      this.pauseMenuScreen.classList.add('hidden');
      this.respawnScreen.classList.remove('active');

      if (this.weapon.isScoped) {
        this.weapon.toggleScope(false);
        this.sniperScopeOverlay.classList.add('hidden');
        this.crosshairElem.style.display = 'block';
      }

      this.matchEndModal.classList.remove('hidden');
      this.matchEndModal.classList.add('active');

      if (data.gameMode === 'tdm') {
        if (data.winningTeam === 'draw') {
          this.winnerTitle.textContent = 'DRAW MATCH!';
          this.winnerTitle.style.color = '#fbbf24';
        } else if (data.winningTeam === 'blue') {
          this.winnerTitle.textContent = '🔵 TEAM BLUE WINS!';
          this.winnerTitle.style.color = '#60a5fa';
        } else {
          this.winnerTitle.textContent = '🔴 TEAM RED WINS!';
          this.winnerTitle.style.color = '#f87171';
        }

        if (this.matchEndTeamScores && data.teamScores) {
          this.matchEndTeamScores.classList.remove('hidden');
          this.matchEndTeamScores.innerHTML = `<span style="color:#60a5fa;">BLUE ${data.teamScores.blue}</span> <span style="color:#64748b;">—</span> <span style="color:#f87171;">${data.teamScores.red} RED</span>`;
        }
      } else {
        this.winnerTitle.textContent = `${data.winnerName.toUpperCase()} WINS!`;
        this.winnerTitle.style.color = '#ffffff';
        if (this.matchEndTeamScores) {
          this.matchEndTeamScores.classList.add('hidden');
        }
      }

      if (data.mvp) {
        this.mvpName.textContent = data.mvp.name;
        this.mvpStat.textContent = `(${data.mvp.kills} Kills - K/D: ${data.mvp.kd})`;
      }

      this.renderFinalScoreboard(data.scoreboard);
    });

    // RETURN TO ROOM LOBBY
    this.socket.on('room-returned-to-lobby', ({ room }) => {
      this.currentRoom = room;
      this.controls.unlock();
      this.hud.classList.remove('active');
      this.pauseMenuScreen.classList.add('hidden');
      this.matchEndModal.classList.remove('active');
      this.matchEndModal.classList.add('hidden');
      this.respawnScreen.classList.remove('active');

      this.remotePlayers.forEach(p => p.destroy());
      this.remotePlayers.clear();

      const isHost = (room.hostId === this.localPlayerId);
      this.openWaitingRoom(room, isHost);
    });

    this.socket.on('player-moved', (data) => {
      if (data.id === this.localPlayerId) return;
      const remote = this.remotePlayers.get(data.id);
      if (remote) {
        remote.setTransform(
          new THREE.Vector3(data.position.x, data.position.y, data.position.z),
          data.rotation,
          data.isMoving,
          data.isRunning
        );
      }
    });

    // Remote Player Weapon Switch Sync
    this.socket.on('player-weapon-switched', ({ playerId, slot }) => {
      const remote = this.remotePlayers.get(playerId);
      if (remote) {
        remote.setWeaponSlot(slot);
      }
    });

    // Remote Thrown Projectiles Sync
    this.socket.on('projectile-thrown', (data) => {
      if (data.throwerId === this.localPlayerId) return;
      const origin = new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z);
      const vel = new THREE.Vector3(data.velocity.x, data.velocity.y, data.velocity.z);
      this.projectiles.spawnProjectile(data.type, origin, vel, false, data.id);
    });

    // Remote Grenade Detonated Sync
    this.socket.on('grenade-detonated', (data) => {
      if (data.throwerId === this.localPlayerId) return;
      const pos = new THREE.Vector3(data.explosionPoint.x, data.explosionPoint.y, data.explosionPoint.z);
      this.projectiles.detonateFrag(pos, false);

      const dist = this.camera.position.distanceTo(pos);
      if (dist < 18) {
        this.triggerScreenShake(0.35, Math.max(0.1, 1 - dist / 18));
      }
    });

    // Remote Flashbang Detonated Sync
    this.socket.on('flash-detonated', (data) => {
      if (data.throwerId === this.localPlayerId) return;
      const pos = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
      this.projectiles.detonateFlash(pos);
    });

    this.socket.on('player-shot-effect', (data) => {
      if (data.shooterId === this.localPlayerId) return;

      const origin = new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z);
      const hitPoint = new THREE.Vector3(data.hitPoint.x, data.hitPoint.y, data.hitPoint.z);

      if (data.weaponSlot !== 4) {
        this.weapon.createTracer(origin, hitPoint, false);
      }

      const dist = this.camera.position.distanceTo(origin);
      if (data.weaponSlot === 4) {
        if (dist < 5) SoundEffects.playKnifeSlash();
      } else {
        SoundEffects.playRemoteShoot(dist);
      }
    });

    this.socket.on('player-damaged', (data) => {
      if (data.targetId === this.localPlayerId) {
        this.health = data.health;
        this.updateHudHealth();
        SoundEffects.playHurt();

        if (data.isGrenade) {
          this.triggerScreenShake(0.4, 0.6);
        }

        this.damageVignette.classList.add('hit');
        setTimeout(() => this.damageVignette.classList.remove('hit'), 150);
      } else {
        const remote = this.remotePlayers.get(data.targetId);
        if (remote) {
          remote.setHealth(data.health);
        }
      }
    });

    this.socket.on('player-killed', (data) => {
      const { killerId, killerName, killerTeam, victimId, victimName, victimTeam, weaponName, isHeadshot, teamScores, scoreboard } = data;
      if (this.currentRoom && teamScores) {
        this.currentRoom.teamScores = teamScores;
      }
      const headshotBadge = isHeadshot ? ' 💥 HEADSHOT!' : '';
      const wpn = weaponName || '🔫';
      const kPrefix = killerTeam === 'blue' ? '🔵 ' : (killerTeam === 'red' ? '🔴 ' : '');
      const vPrefix = victimTeam === 'blue' ? '🔵 ' : (victimTeam === 'red' ? '🔴 ' : '');
      this.addFeedItem(`${kPrefix}${killerName} [${wpn}] ${vPrefix}${victimName}${headshotBadge}`);
      this.updateScoreboardTable(scoreboard);

      if (victimId === this.localPlayerId) {
        this.handleLocalDeath(killerName);
      } else {
        const victimRemote = this.remotePlayers.get(victimId);
        if (victimRemote) {
          victimRemote.setHealth(0);
        }
      }
    });

    this.socket.on('player-respawned', ({ playerId, position, health }) => {
      if (playerId === this.localPlayerId) {
        this.handleLocalRespawn(position);
      } else {
        const remote = this.remotePlayers.get(playerId);
        if (remote) {
          remote.setHealth(health);
          remote.group.position.set(position.x, position.y, position.z);
        }
      }
    });
  }

  // ==========================================
  // LOBBY & ROOM MANAGEMENT UI
  // ==========================================
  renderRoomsList(rooms) {
    this.roomsListContainer.innerHTML = '';
    if (!rooms || rooms.length === 0) {
      this.roomsListContainer.innerHTML = `
        <div class="no-rooms">
          No active rooms found on your LAN.<br>
          Click <b>Create Room</b> above to host a match!
        </div>
      `;
      return;
    }

    rooms.forEach((r) => {
      const card = document.createElement('div');
      card.className = 'room-card';

      const statusBadge = r.status === 'in-game'
        ? '<span style="color:#f59e0b;font-weight:700">IN-GAME</span>'
        : '<span style="color:#10b981;font-weight:700">OPEN LOBBY</span>';

      const mapNames = { dust2: 'Dust II', stalkyard: 'Stalkyard', turbine: 'DM-Turbine', frenzy: 'Frenzy', italy: 'CS Italy', arena: 'CS Italy', warehouse: 'Stalkyard', station: 'DM-Turbine', desert: 'Frenzy' };
      const displayMap = mapNames[r.mapId] || 'Dust II';
      const isTdm = r.gameMode === 'tdm';
      const modeBadge = isTdm
        ? `<span class="team-badge blue">2 TEAMS 5v5</span> <span style="font-size:11px;color:#94a3b8;">(🔵 ${r.teamCounts?.blue ?? 0} vs ${r.teamCounts?.red ?? 0} 🔴)</span>`
        : `<span class="team-badge ffa">FFA SOLO</span>`;

      card.innerHTML = `
        <div class="room-info">
          <div class="room-info-title">${r.name} ${modeBadge}</div>
          <div class="room-info-meta">
            <span>Map: <b>${displayMap}</b></span>
            <span>Host: <b>${r.hostName}</b></span>
            <span>Players: <b>${r.playerCount}/${r.maxPlayers}</b></span>
            <span>Status: ${statusBadge}</span>
          </div>
        </div>
        <button class="btn btn-primary" style="padding: 8px 16px; font-size: 11px;">JOIN</button>
      `;

      card.querySelector('button').addEventListener('click', () => {
        const playerName = this.nicknameInput.value.trim() || 'Soldier';
        this.socket.emit('join-room', {
          roomId: r.id,
          playerName: playerName,
          playerColor: this.selectedColor,
          characterType: this.selectedCharacter
        });
      });

      this.roomsListContainer.appendChild(card);
    });
  }

  openWaitingRoom(room, isHost) {
    this.state = 'room';
    this.screenLobby.classList.add('hidden');
    this.pauseMenuScreen.classList.add('hidden');
    this.matchEndModal.classList.remove('active');
    this.matchEndModal.classList.add('hidden');
    this.screenWaiting.classList.remove('hidden');

    this.waitingRoomTitle.textContent = room.name;
    if (this.waitingHostModeSelect) {
      this.waitingHostModeSelect.value = room.settings?.gameMode || 'ffa';
    }
    this.updateWaitingSettingsSummary();
    this.updateWaitingPlayerList();

    if (isHost) {
      this.btnStartMatch.style.display = 'inline-flex';
      this.hostMapControl.style.display = 'block';
      this.waitingHostStatus.textContent = 'You are the room Host! Click "Start Match" when all players join.';

      this.waitingMapCards.forEach(c => {
        c.classList.toggle('selected', c.dataset.map === (room.settings.mapId || 'dust2'));
      });
    } else {
      this.btnStartMatch.style.display = 'none';
      this.hostMapControl.style.display = 'none';
      this.waitingHostStatus.textContent = `Waiting for host (${room.hostName}) to start the match...`;
    }
  }

  updateWaitingSettingsSummary() {
    if (!this.currentRoom) return;
    const s = this.currentRoom.settings;
    const mapNames = { dust2: 'Dust II', stalkyard: 'Stalkyard', turbine: 'DM-Turbine', frenzy: 'Frenzy', italy: 'CS Italy', arena: 'CS Italy', warehouse: 'Stalkyard', station: 'DM-Turbine', desert: 'Frenzy' };
    const mName = mapNames[s.mapId] || 'Dust II';
    const modeLabel = s.gameMode === 'tdm' ? '2 TEAMS (MAX 5/TEAM)' : 'FREE-FOR-ALL';
    this.waitingSettingsSummary.textContent = `Mode: ${modeLabel} | Map: ${mName.toUpperCase()} | Gravity: ${s.gravity.toUpperCase()} | Limit: ${s.scoreLimit} Kills`;
  }

  renderPlayerEntryHtml(p, charIcons) {
    const cIcon = charIcons[p.characterType] || '🎖️';
    const dotColor = this.currentRoom.settings?.gameMode === 'tdm'
      ? (p.team === 'red' ? '#ef4444' : '#3b82f6')
      : p.color;
    return `
      <div class="player-entry-left">
        <div class="player-color-dot" style="background:${dotColor}"></div>
        <span style="font-size: 16px;">${cIcon}</span>
        <span class="player-name-text">${p.name} ${p.id === this.localPlayerId ? '(You)' : ''}</span>
      </div>
      <div>
        ${p.id === this.currentRoom.hostId ? '<span class="host-tag">HOST</span>' : ''}
      </div>
    `;
  }

  updateWaitingPlayerList() {
    if (!this.currentRoom) return;
    const players = Object.values(this.currentRoom.players);
    const charIcons = { soldier: '🎖️', robot: '🤖', cyborg: '🦾', heavy: '🛡️' };
    const isTdm = this.currentRoom.settings?.gameMode === 'tdm';

    if (this.waitingFfaContainer && this.waitingTeamsContainer) {
      this.waitingFfaContainer.classList.toggle('hidden', isTdm);
      this.waitingTeamsContainer.classList.toggle('hidden', !isTdm);
    }

    if (isTdm && this.waitingBlueList && this.waitingRedList) {
      this.waitingBlueList.innerHTML = '';
      this.waitingRedList.innerHTML = '';

      const bluePlayers = players.filter(p => p.team !== 'red');
      const redPlayers = players.filter(p => p.team === 'red');

      bluePlayers.forEach(p => {
        const entry = document.createElement('div');
        entry.className = 'player-entry';
        entry.innerHTML = this.renderPlayerEntryHtml(p, charIcons);
        this.waitingBlueList.appendChild(entry);
      });

      redPlayers.forEach(p => {
        const entry = document.createElement('div');
        entry.className = 'player-entry';
        entry.innerHTML = this.renderPlayerEntryHtml(p, charIcons);
        this.waitingRedList.appendChild(entry);
      });

      if (this.blueCountBadge) this.blueCountBadge.textContent = bluePlayers.length;
      if (this.redCountBadge) this.redCountBadge.textContent = redPlayers.length;

      const myTeam = this.currentRoom.players[this.localPlayerId]?.team;
      if (this.btnJoinBlue) {
        this.btnJoinBlue.disabled = (myTeam === 'blue' || bluePlayers.length >= 5);
        this.btnJoinBlue.textContent = myTeam === 'blue' ? 'ON BLUE' : (bluePlayers.length >= 5 ? 'FULL (5/5)' : 'JOIN BLUE');
      }
      if (this.btnJoinRed) {
        this.btnJoinRed.disabled = (myTeam === 'red' || redPlayers.length >= 5);
        this.btnJoinRed.textContent = myTeam === 'red' ? 'ON RED' : (redPlayers.length >= 5 ? 'FULL (5/5)' : 'JOIN RED');
      }
      return;
    }

    this.waitingPlayerList.innerHTML = '';
    players.forEach((p) => {
      const entry = document.createElement('div');
      entry.className = 'player-entry';
      entry.innerHTML = this.renderPlayerEntryHtml(p, charIcons);
      this.waitingPlayerList.appendChild(entry);
    });
  }

  leaveToLobby() {
    this.state = 'lobby';
    this.controls.unlock();
    this.screenWaiting.classList.add('hidden');
    this.pauseMenuScreen.classList.add('hidden');
    this.matchEndModal.classList.remove('active');
    this.matchEndModal.classList.add('hidden');
    this.hud.classList.remove('active');
    this.respawnScreen.classList.remove('active');
    this.screenLobby.classList.remove('hidden');

    if (this.weapon && this.weapon.isScoped) {
      this.weapon.toggleScope(false);
      this.sniperScopeOverlay.classList.add('hidden');
      this.crosshairElem.style.display = 'block';
    }

    this.remotePlayers.forEach(p => p.destroy());
    this.remotePlayers.clear();
    if (this.projectiles) this.projectiles.clear();
    this.currentRoom = null;
  }

  // ==========================================
  // IN-MATCH LOGIC & GAMEPLAY
  // ==========================================
  startMatchSession() {
    this.state = 'playing';
    this.screenWaiting.classList.add('hidden');
    this.matchEndModal.classList.remove('active');
    this.matchEndModal.classList.add('hidden');
    this.hud.classList.add('active');

    // 1. Load map
    const mapId = this.currentRoom?.settings?.mapId || 'dust2';
    this.arenaMap.loadMap(mapId);

    const mapNames = {
      dust2: 'DUST II',
      stalkyard: 'STALKYARD',
      turbine: 'DM-TURBINE',
      frenzy: 'FRENZY',
      italy: 'CS ITALY',
      warehouse: 'STALKYARD',
      station: 'DM-TURBINE',
      desert: 'FRENZY',
      arena: 'CS ITALY',
      colosseum: 'CS ITALY',
      dungeon: 'DUST II'
    };
    if (this.hudMapBadge) {
      this.hudMapBadge.textContent = mapNames[mapId] || 'TACTICAL MAP';
    }

    // 2. Configure gravity
    const gSetting = this.currentRoom?.settings?.gravity || 'normal';
    if (gSetting === 'antigravity') {
      this.gravity = 5.0;
      this.jumpForce = 7.5;
      this.hudGravityBadge.textContent = 'ANTIGRAVITY';
    } else if (gSetting === 'low') {
      this.gravity = 12.0;
      this.jumpForce = 8.5;
      this.hudGravityBadge.textContent = 'LOW GRAVITY';
    } else {
      this.gravity = 24.0;
      this.jumpForce = 9.5;
      this.hudGravityBadge.textContent = 'STANDARD';
    }

    // 3. Reset throwables, ammo & position
    this.fragCount = 2;
    this.flashCount = 2;
    this.updateThrowableHud();

    const myData = this.currentRoom.players[this.localPlayerId];
    if (myData && myData.position) {
      this.camera.position.set(myData.position.x, myData.position.y, myData.position.z);
    } else {
      this.camera.position.set(0, this.playerHeight, 0);
    }

    this.playerVelocity.set(0, 0, 0);
    this.lastSafePos = null;
    this._mapSnapDone = false;
    this.health = 100;
    this.isAlive = true;
    this.updateHudHealth();

    // Default to Slot 1 (Assault Rifle)
    this.switchWeaponSlot(1);

    // 4. Instantiate remote characters & initialize HUD score
    this.remotePlayers.forEach(p => p.destroy());
    this.remotePlayers.clear();
    if (this.projectiles) this.projectiles.clear();

    const isTdm = this.currentRoom?.settings?.gameMode === 'tdm';
    const myTeam = myData?.team || null;

    if (this.hudMatchScore) {
      const limit = this.currentRoom?.settings?.scoreLimit || 15;
      if (isTdm) {
        const blue = this.currentRoom?.teamScores?.blue || 0;
        const red = this.currentRoom?.teamScores?.red || 0;
        this.hudMatchScore.innerHTML = `<span style="color:#60a5fa;">🔵 BLUE ${blue}</span> <span style="color:#64748b;">—</span> <span style="color:#f87171;">${red} RED 🔴</span> <span style="font-size:11px;color:#94a3b8;">(Goal: ${limit})</span>`;
      } else {
        this.hudMatchScore.textContent = `LEADER: — (0/${limit})`;
      }
    }

    for (const [pid, p] of Object.entries(this.currentRoom.players)) {
      if (pid !== this.localPlayerId) {
        const remote = new RemotePlayer(this.scene, {
          ...p,
          team: isTdm ? p.team : null,
          isTeammate: isTdm && myTeam && p.team === myTeam
        });
        this.remotePlayers.set(pid, remote);
      }
    }

    // Open Pause menu so player clicks Resume to lock mouse
    this.updatePauseMenuState();
    this.pauseMenuScreen.classList.remove('hidden');
  }

  handleShoot() {
    if (!this.weapon.canShoot()) return;

    this.weapon.triggerShootAnimation();
    this.updateHudAmmo();

    const origin = this.weapon.getMuzzleWorldPosition();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    // Raycast configuration
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    this.raycaster.far = this.weapon.config.isMelee ? this.weapon.config.range : 200;

    const allTargets = [...this.arenaMap.shootableMeshes];
    for (const remote of this.remotePlayers.values()) {
      if (remote.isAlive) {
        allTargets.push(...remote.hitboxes);
      }
    }

    const intersects = this.raycaster.intersectObjects(allTargets, true);

    let hitPoint = new THREE.Vector3().copy(this.camera.position).addScaledVector(dir, this.raycaster.far);
    let hitPlayerId = null;
    let isHeadshot = false;
    let isBackstab = false;

    if (intersects.length > 0) {
      const hit = intersects[0];
      hitPoint.copy(hit.point);

      if (hit.object.userData && hit.object.userData.playerId) {
        const candidateId = hit.object.userData.playerId;
        const isTdm = this.currentRoom?.settings?.gameMode === 'tdm';
        const myTeam = this.currentRoom?.players?.[this.localPlayerId]?.team;
        const remote = this.remotePlayers.get(candidateId);
        const isTeammate = isTdm && myTeam && remote?.team === myTeam;

        if (!isTeammate) {
          hitPlayerId = candidateId;
          isHeadshot = !!hit.object.userData.isHead;

          // Check Knife Backstab angle
          if (this.weapon.config.isMelee) {
            if (remote) {
              const victimLook = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), remote.group.rotation.y);
              isBackstab = (dir.dot(victimLook) > 0.5);
            }
            SoundEffects.playKnifeHit();
          }

          this.triggerHitmarker(isHeadshot || isBackstab);
        }
      }
    }

    // Tracer for firearms (not melee)
    if (!this.weapon.config.isMelee) {
      this.weapon.createTracer(origin, hitPoint, true);
    }

    // Broadcast shoot to server
    this.socket.emit('player-shoot', {
      origin: { x: origin.x, y: origin.y, z: origin.z },
      direction: { x: dir.x, y: dir.y, z: dir.z },
      hitPoint: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z },
      hitPlayerId: hitPlayerId,
      weaponSlot: this.weapon.currentSlot,
      isHeadshot: isHeadshot,
      isBackstab: isBackstab
    });
  }

  triggerHitmarker(isCrit) {
    SoundEffects.playHitmarker(isCrit);
    this.hitmarker.classList.add('show');
    setTimeout(() => {
      this.hitmarker.classList.remove('show');
    }, 120);
  }

  handleLocalDeath(killerName) {
    this.isAlive = false;
    this.isMouseDown = false;
    this.health = 0;
    this.updateHudHealth();
    SoundEffects.playDeath();

    if (this.weapon.isScoped) {
      this.weapon.toggleScope(false);
      this.sniperScopeOverlay.classList.add('hidden');
      this.crosshairElem.style.display = 'block';
    }

    this.respawnKillerText.textContent = `Eliminated by ${killerName}`;
    this.respawnScreen.classList.add('active');

    let secondsLeft = 3;
    this.respawnCount.textContent = secondsLeft;
    const interval = setInterval(() => {
      secondsLeft--;
      if (secondsLeft > 0) {
        this.respawnCount.textContent = secondsLeft;
      } else {
        clearInterval(interval);
      }
    }, 1000);
  }

  handleLocalRespawn(spawnPos) {
    this.isAlive = true;
    this.health = 100;
    this.fragCount = 2;
    this.flashCount = 2;
    this.updateThrowableHud();
    this.updateHudHealth();
    this.respawnScreen.classList.remove('active');

    this.camera.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
    this.playerVelocity.set(0, 0, 0);
    this.lastSafePos = null;
    this._mapSnapDone = false;

    if (this.state === 'playing') {
      this.controls.lock();
    }
  }

  updateHudHealth() {
    this.hudHealthVal.textContent = Math.max(0, Math.round(this.health));
    const pct = Math.max(0, Math.min(100, this.health));
    this.hudHealthBar.style.width = `${pct}%`;

    if (pct < 30) {
      this.hudHealthBar.style.background = 'linear-gradient(90deg, #ef4444 0%, #f97316 100%)';
    } else {
      this.hudHealthBar.style.background = 'linear-gradient(90deg, #10b981 0%, #00f0ff 100%)';
    }
  }

  updateHudAmmo() {
    if (this.weapon.config.isMelee) {
      this.hudAmmoVal.innerHTML = `∞ <span>/ ∞</span>`;
      this.hudReloadPrompt.classList.remove('visible');
      return;
    }

    this.hudAmmoVal.innerHTML = `${this.weapon.currentAmmo} <span>/ ∞</span>`;
    if (this.weapon.currentAmmo <= (this.weapon.config.maxAmmo <= 5 ? 1 : 4)) {
      this.hudReloadPrompt.classList.add('visible');
    } else {
      this.hudReloadPrompt.classList.remove('visible');
    }
  }

  addFeedItem(text) {
    const item = document.createElement('div');
    item.className = 'kill-item';
    item.innerHTML = text;
    this.killFeed.appendChild(item);

    setTimeout(() => {
      item.style.opacity = '0';
      item.style.transform = 'translateX(20px)';
      item.style.transition = 'all 0.3s ease';
      setTimeout(() => item.remove(), 300);
    }, 4500);
  }

  formatTeamTag(team) {
    if (this.currentRoom?.settings?.gameMode !== 'tdm' || !team) return '';
    return team === 'red'
      ? '<span class="team-badge red" style="margin-right:6px;">RED</span>'
      : '<span class="team-badge blue" style="margin-right:6px;">BLUE</span>';
  }

  updateScoreboardTable(scoreboard) {
    if (!scoreboard) return;
    this.scoreboardBody.innerHTML = '';
    scoreboard.sort((a, b) => b.kills - a.kills);

    const charIcons = { soldier: '🎖️ Soldier', robot: '🤖 Cyber Mech', cyborg: '🦾 Cyborg', heavy: '🛡️ Titan' };

    scoreboard.forEach((p) => {
      const tr = document.createElement('tr');
      if (p.id === this.localPlayerId) tr.className = 'current-user';
      const cLabel = charIcons[p.characterType] || '🎖️ Soldier';
      const teamTag = this.formatTeamTag(p.team);
      tr.innerHTML = `
        <td>${teamTag}${p.name} ${p.id === this.localPlayerId ? '(You)' : ''}</td>
        <td style="color:#94a3b8;font-size:12px;">${cLabel}</td>
        <td style="color:#00f0ff;font-weight:700">${p.kills}</td>
        <td>${p.deaths}</td>
        <td>${p.health > 0 ? `<span style="color:#10b981">${p.health} HP</span>` : '<span style="color:#ef4444">DEAD</span>'}</td>
      `;
      this.scoreboardBody.appendChild(tr);
    });

    if (this.hudMatchScore) {
      const limit = this.currentRoom?.settings?.scoreLimit || 15;
      if (this.currentRoom?.settings?.gameMode === 'tdm') {
        const blue = this.currentRoom?.teamScores?.blue || 0;
        const red = this.currentRoom?.teamScores?.red || 0;
        this.hudMatchScore.innerHTML = `<span style="color:#60a5fa;">🔵 BLUE ${blue}</span> <span style="color:#64748b;">—</span> <span style="color:#f87171;">${red} RED 🔴</span> <span style="font-size:11px;color:#94a3b8;">(Goal: ${limit})</span>`;
      } else if (scoreboard.length > 0) {
        const leader = scoreboard[0];
        this.hudMatchScore.textContent = `LEADER: ${leader.name} (${leader.kills}/${limit})`;
      }
    }
  }

  renderFinalScoreboard(scoreboard) {
    if (!scoreboard || !this.finalScoreboardBody) return;
    this.finalScoreboardBody.innerHTML = '';

    const charIcons = { soldier: '🎖️ Soldier', robot: '🤖 Cyber Mech', cyborg: '🦾 Cyborg', heavy: '🛡️ Titan' };

    scoreboard.forEach((p) => {
      const tr = document.createElement('tr');
      if (p.id === this.localPlayerId) tr.className = 'current-user';

      const rankBadge = p.rank === 1 ? '🥇 #1' : (p.rank === 2 ? '🥈 #2' : (p.rank === 3 ? '🥉 #3' : `#${p.rank}`));
      const cLabel = charIcons[p.characterType] || '🎖️ Soldier';
      const teamTag = this.formatTeamTag(p.team);

      tr.innerHTML = `
        <td style="font-weight:800; color:${p.rank === 1 ? '#fbbf24' : '#fff'};">${rankBadge}</td>
        <td style="font-weight:700;">${teamTag}${p.name} ${p.id === this.localPlayerId ? '(You)' : ''}</td>
        <td style="color:#94a3b8;font-size:12px;">${cLabel}</td>
        <td style="color:#00f0ff;font-weight:800;">${p.kills}</td>
        <td>${p.deaths}</td>
        <td style="color:#f59e0b;font-weight:700;">${p.kd}</td>
      `;
      this.finalScoreboardBody.appendChild(tr);
    });
  }

  // ==========================================
  // PHYSICS & COLLISION RESOLUTION
  // ==========================================
  updatePhysics(delta) {
    // Update tactical thrown projectiles & explosion effects
    if (this.projectiles) {
      this.projectiles.update(delta);
    }

    if (!this.controls.isLocked || !this.isAlive) return;

    // Wait until the 3D map GLB & Octree finish loading so gravity never drops the player beneath the map
    if (!this.arenaMap.isMapReady) {
      this.playerVelocity.set(0, 0, 0);
      return;
    }

    const currentPos = this.camera.position;
    const playerRadius = 0.28;

    // On first ready frame after spawn/respawn, snap cleanly onto exact floor triangle height
    if (!this._mapSnapDone) {
      this._mapSnapDone = true;
      const initialFloor = this.arenaMap.getFloorHeight(
        currentPos,
        null,
        playerRadius,
        currentPos.y - this.playerHeight + 0.5
      );
      if (initialFloor !== null) {
        currentPos.y = initialFloor + this.playerHeight;
      }
      this.playerVelocity.set(0, 0, 0);
      this.isGrounded = true;
      if (this.arenaMap.hasFloorBelow(currentPos.x, currentPos.y - this.playerHeight, currentPos.z)) {
        this.lastSafePos = currentPos.clone();
      }
    }

    // Continuous automatic fire when holding left-click
    if (this.isMouseDown && this.weapon.config.isAutomatic) {
      this.handleShoot();
    }

    const moveVector = new THREE.Vector3();
    if (this.moveInput.forward) moveVector.z -= 1;
    if (this.moveInput.backward) moveVector.z += 1;
    if (this.moveInput.left) moveVector.x -= 1;
    if (this.moveInput.right) moveVector.x += 1;

    const isMoving = moveVector.lengthSq() > 0;
    if (isMoving) moveVector.normalize();

    // Speed calculation with weapon speed multiplier (e.g. Knife gives 1.15x boost!)
    let speed = this.moveSpeed * (this.moveInput.sprint ? this.sprintMultiplier : 1.0);
    speed *= this.weapon.config.speedMultiplier;

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const displacement = new THREE.Vector3()
      .addScaledVector(forward, -moveVector.z)
      .addScaledVector(right, moveVector.x)
      .multiplyScalar(speed * delta);

    // Sub-stepped double-sided horizontal wall sliding collision
    const resolvedHoriz = this.arenaMap.moveAndCollideHorizontal(
      currentPos,
      displacement,
      this.playerHeight,
      playerRadius
    );
    currentPos.x = resolvedHoriz.x;
    currentPos.z = resolvedHoriz.z;

    const feetY = currentPos.y - this.playerHeight;

    // Check Space Station Anti-Grav Jump Pads
    const jumpPadForce = this.arenaMap.checkJumpPad(currentPos);
    if (jumpPadForce && this.isGrounded) {
      this.playerVelocity.y = jumpPadForce;
      this.isGrounded = false;
      SoundEffects.playJump();
    }

    // Process jump request with 200ms buffer (prevents missed Space clicks during step transitions)
    if (this.jumpRequestTimer > 0) {
      this.jumpRequestTimer -= delta;
      if (this.jumpRequestTimer <= 0) {
        this.jumpRequested = false;
      }
    }

    if (this.jumpRequested && this.isGrounded && this.isAlive && this.controls.isLocked) {
      this.playerVelocity.y = this.jumpForce;
      this.isGrounded = false;
      this.jumpRequested = false;
      this.jumpRequestTimer = 0;
      SoundEffects.playJump();
    }

    // Apply vertical velocity & ceiling check
    const prevY = currentPos.y;
    this.playerVelocity.y -= this.gravity * delta;
    currentPos.y += this.playerVelocity.y * delta;

    if (this.playerVelocity.y > 0) {
      const ceilingY = this.arenaMap.checkCeilingCollision(currentPos, prevY, playerRadius);
      if (ceilingY !== null && ceilingY < currentPos.y) {
        currentPos.y = ceilingY;
        this.playerVelocity.y = 0;
      }
    }

    // Floor detection using double-sided multi-hit Octree raycasting (no fake infinite y=0 floor!)
    let floorHeight = -999;
    const octreeFloor = this.arenaMap.getFloorHeight(currentPos, null, playerRadius, feetY);
    if (octreeFloor !== null) {
      floorHeight = octreeFloor;
    }

    const currentFeetY = currentPos.y - this.playerHeight;
    const isJumpingUp = this.playerVelocity.y > 0;
    const MAX_STEP_UP = 0.52;
    const MAX_STEP_DOWN = 0.52;

    if (!isJumpingUp) {
      if (floorHeight > -900) {
        // 1. Step UP onto stairs/ramps smoothly
        if (this.isGrounded && floorHeight > currentFeetY && (floorHeight - currentFeetY <= MAX_STEP_UP)) {
          currentPos.y = floorHeight + this.playerHeight;
          this.playerVelocity.y = 0;
          this.isGrounded = true;
        }
        // 2. Step DOWN stairs without losing ground contact / floating
        else if (this.isGrounded && floorHeight < currentFeetY && (currentFeetY - floorHeight <= MAX_STEP_DOWN)) {
          currentPos.y = floorHeight + this.playerHeight;
          this.playerVelocity.y = 0;
          this.isGrounded = true;
        }
        // 3. Normal floor landing or contact
        else if (currentFeetY <= floorHeight) {
          currentPos.y = floorHeight + this.playerHeight;
          this.playerVelocity.y = 0;
          this.isGrounded = true;
        } else {
          this.isGrounded = false;
        }
      } else {
        this.isGrounded = false;
      }
    } else {
      // Rising in jump trajectory: keep airborne, never cancel jump momentum
      this.isGrounded = false;
    }

    // Record last verified safe grounded position on solid map geometry
    if (
      this.isGrounded &&
      floorHeight > -900 &&
      this.arenaMap.hasFloorBelow(currentPos.x, currentPos.y - this.playerHeight, currentPos.z)
    ) {
      if (!this.lastSafePos) this.lastSafePos = new THREE.Vector3();
      this.lastSafePos.copy(currentPos);
    }

    // Instant recovery if player somehow exits map bounds or falls beneath the arena without floor underneath
    const outOfBounds = this.arenaMap.isOutOfPlayableBounds(currentPos, this.playerHeight);
    const fallingIntoVoid = (
      floorHeight <= -900 &&
      (currentPos.y - this.playerHeight) < -1.0 &&
      !this.arenaMap.hasFloorBelow(currentPos.x, currentPos.y - this.playerHeight, currentPos.z)
    );
    if (outOfBounds || fallingIntoVoid) {
      const recovery = this.lastSafePos || this.arenaMap.getRandomSpawn();
      currentPos.set(recovery.x, recovery.y, recovery.z);
      this.playerVelocity.set(0, 0, 0);
      this.isGrounded = true;
    }

    this.weapon.update(delta, isMoving, this.moveInput.sprint);

    // Tick screen shake timer (applied render-only in animate() so physics and PointerLockControls stay untouched)
    if (this.screenShakeTime > 0) {
      this.screenShakeTime = Math.max(0, this.screenShakeTime - delta);
    }

    // Sync position & rotation to server
    const now = performance.now();
    if (now - this.lastNetworkSync >= this.networkSyncInterval) {
      this.lastNetworkSync = now;

      const dirVector = new THREE.Vector3();
      this.camera.getWorldDirection(dirVector);
      const yaw = Math.atan2(dirVector.x, dirVector.z);

      this.socket.emit('player-movement', {
        position: { x: currentPos.x, y: currentPos.y, z: currentPos.z },
        rotation: { yaw: yaw, pitch: this.camera.rotation.x },
        isMoving: isMoving,
        isRunning: this.moveInput.sprint && isMoving,
        isJumping: !this.isGrounded
      });
    }
  }

  animate(timestamp) {
    requestAnimationFrame((t) => this.animate(t));

    const delta = Math.min(this.clock.getDelta(), 0.1);

    if (this.hudFps && delta > 0) {
      const fps = Math.round(1 / delta);
      this.hudFps.textContent = `${fps} FPS`;
    }

    if (this.state === 'playing') {
      this.updatePhysics(delta);
    }

    this.remotePlayers.forEach((player) => {
      player.update(delta);
    });

    // Apply temporary render-only explosion screen shake and immediately restore before next physics frame
    let shakeX = 0;
    let shakeY = 0;
    if (this.screenShakeTime > 0 && this.state === 'playing') {
      shakeX = (Math.random() - 0.5) * this.screenShakeIntensity * 0.25;
      shakeY = (Math.random() - 0.5) * this.screenShakeIntensity * 0.25;
      this.camera.position.x += shakeX;
      this.camera.position.y += shakeY;
    }

    this.renderer.render(this.scene, this.camera);

    if (shakeX !== 0 || shakeY !== 0) {
      this.camera.position.x -= shakeX;
      this.camera.position.y -= shakeY;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
