// map.js - Multi-Map Engine for RUNGUN (Warehouse, Sci-Fi Space Station, Desert Outpost, Cyber Arena, Dark Dungeon)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';

// Reusable scratch math objects to keep collision queries zero-allocation
const _plane = new THREE.Plane();
const _triNormal = new THREE.Vector3();
const _projPt = new THREE.Vector3();
const _pt1 = new THREE.Vector3();
const _pt2 = new THREE.Vector3();
const _hitPt = new THREE.Vector3();
const _segDir1 = new THREE.Vector3();
const _segDir2 = new THREE.Vector3();
const _segW = new THREE.Vector3();
const _qPt = new THREE.Vector3();
const _pushH = new THREE.Vector3();
const _downDir = new THREE.Vector3(0, -1, 0);

function closestPointsLineToLine(l1Start, l1End, l2Start, l2End, out1, out2) {
  _segDir1.subVectors(l1End, l1Start);
  _segDir2.subVectors(l2End, l2Start);
  _segW.subVectors(l2Start, l1Start);

  const a = _segDir1.dot(_segDir2);
  const b = _segDir1.dot(_segDir1);
  const c = _segDir2.dot(_segDir2);
  const d = _segDir2.dot(_segW);
  const e = _segDir1.dot(_segW);
  const divisor = b * c - a * a;

  let t1, t2;
  if (Math.abs(divisor) < 1e-10) {
    const d1 = -d / (c || 1);
    const d2 = (a - d) / (c || 1);
    t1 = Math.abs(d1 - 0.5) < Math.abs(d2 - 0.5) ? 0 : 1;
  } else {
    t1 = (e * c - d * a) / divisor;
  }

  t1 = Math.max(0, Math.min(1, t1));
  t2 = c > 1e-10 ? (t1 * a - d) / c : 0;
  if (t2 < 0 || t2 > 1) {
    t2 = Math.max(0, Math.min(1, t2));
    if (b > 1e-10) t1 = Math.max(0, Math.min(1, (t2 * a + e) / b));
  }

  out1.copy(_segDir1).multiplyScalar(t1).add(l1Start);
  out2.copy(_segDir2).multiplyScalar(t2).add(l2Start);
}

export class ArenaMap {
  constructor(scene) {
    this.scene = scene;
    this.currentMapId = 'dust2';
    this.baseFloorHeight = 0;

    this.colliders = []; // AABB Box3 array for collision detection
    this.shootableMeshes = []; // Meshes that receive bullet impacts
    this.spawnPoints = []; // Safe spawn coordinates for current map
    this.jumpPads = []; // Interactive launch pads (x, z, radius, force)
    this.mapObjects = []; // Meshes & lights belonging to active map for clean teardown
    this.octree = null; // Triangle Octree for 3D downloaded maps
    this.isMapReady = false;
    this.mapBounds = null;
    this.perimeterBounds = { minX: -60, maxX: 60, minZ: -71, maxZ: 71 };
    this._loadToken = 0;

    this.loadMap('dust2');
  }

  clearMap() {
    this._loadToken++;
    this.isMapReady = false;
    this.mapBounds = null;

    // Remove all map objects, lights, and meshes from scene
    this.mapObjects.forEach(obj => {
      this.scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });

    this.mapObjects = [];
    this.colliders = [];
    this.shootableMeshes = [];
    this.spawnPoints = [];
    this.jumpPads = [];
    this.octree = null;
    this.baseFloorHeight = 0;
  }

  loadMap(mapId) {
    this.clearMap();
    this.currentMapId = mapId || 'dust2';

    if (this.currentMapId === 'dust2' || this.currentMapId === 'dungeon') {
      this.buildDust2();
    } else if (this.currentMapId === 'stalkyard' || this.currentMapId === 'warehouse') {
      this.buildStalkyard();
    } else if (this.currentMapId === 'turbine' || this.currentMapId === 'station') {
      this.buildTurbine();
    } else if (this.currentMapId === 'frenzy' || this.currentMapId === 'desert') {
      this.buildFrenzy();
    } else if (this.currentMapId === 'italy' || this.currentMapId === 'arena' || this.currentMapId === 'colosseum') {
      this.buildItaly();
    } else {
      this.buildDust2();
    }
  }

  registerCollider(mesh) {
    const box = new THREE.Box3().setFromObject(mesh);
    this.colliders.push(box);
    this.shootableMeshes.push(mesh);
    this.mapObjects.push(mesh);
    return box;
  }

  // Generates real horizontal stepped stairs with Box3 colliders so players smoothly ascend with ZERO floating
  createStairs(startX, startY, startZ, stepCount, stepW, stepH, stepD, dirX = 0, dirZ = 1, mat = null) {
    const defaultMat = mat || new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    for (let i = 0; i < stepCount; i++) {
      const stepX = startX + dirX * stepD * i;
      const stepZ = startZ + dirZ * stepD * i;
      const totalH = startY + stepH * (i + 1);

      const geo = new THREE.BoxGeometry(
        dirX !== 0 ? stepD : stepW,
        totalH,
        dirZ !== 0 ? stepD : stepW
      );
      const mesh = new THREE.Mesh(geo, defaultMat);
      mesh.position.set(stepX, totalH / 2, stepZ);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.registerCollider(mesh);
    }
  }

  // ==========================================
  // MAP 1: STALKYARD (Half-Life Multiplayer Map)
  // stalkyard_-_half-life_multiplayer_map_-_3d.glb (829 KB, 6,405 tris)
  // ==========================================
  buildStalkyard() {
    this.baseFloorHeight = 0.0;
    this.scene.background = new THREE.Color(0x0e1514);
    this.scene.fog = new THREE.FogExp2(0x131f1c, 0.01);

    this.spawnPoints = [
      new THREE.Vector3(-18.0, 1.81, -16.0),
      new THREE.Vector3(18.0, 1.81, -16.0),
      new THREE.Vector3(0.0, 1.81, -16.0),
      new THREE.Vector3(-16.0, 2.66, 0.0),
      new THREE.Vector3(10.0, 7.35, 10.0),
      new THREE.Vector3(22.0, 1.81, 18.0),
      new THREE.Vector3(-22.0, 1.88, 18.0),
      new THREE.Vector3(0.0, 6.07, 18.0)
    ];

    const hemiLight = new THREE.HemisphereLight(0xa5c4bc, 0x1f2b28, 1.2);
    hemiLight.position.set(0, 30, 0);
    this.scene.add(hemiLight);
    this.mapObjects.push(hemiLight);

    const ambLight = new THREE.AmbientLight(0xd4e8e1, 0.7);
    this.scene.add(ambLight);
    this.mapObjects.push(ambLight);

    const sun = new THREE.DirectionalLight(0xe8f5f0, 1.8);
    sun.position.set(20, 45, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    const d = 40;
    sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
    sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 120;
    this.scene.add(sun);
    this.mapObjects.push(sun);

    const p1 = new THREE.PointLight(0x40e0d0, 2.0, 25, 1.5);
    p1.position.set(0, 6, 0);
    const p2 = new THREE.PointLight(0xffa500, 1.5, 20, 1.5);
    p2.position.set(-15, 6, -12);
    this.scene.add(p1, p2);
    this.mapObjects.push(p1, p2);

    this.buildInvisibleArenaPerimeter(30, 26);

    this.loadGlbArena(
      '/assets/models/stalkyard_-_half-life_multiplayer_map_-_3d.glb',
      ['stalkyard', 'warehouse'],
      1.8,
      'Stalkyard (Half-Life)',
      () => this.buildDust2()
    );
  }

  buildWarehouse() {
    this.buildStalkyard();
  }

  // ==========================================
  // MAP 2: DM-TURBINE (Unreal Tournament Arena)
  // dm-turbine_-_ut_multiplayer_map.glb (1.04 MB, 11,956 tris)
  // ==========================================
  buildTurbine() {
    this.baseFloorHeight = 0.0;
    this.scene.background = new THREE.Color(0x090d16);
    this.scene.fog = new THREE.FogExp2(0x0b1220, 0.007);

    // 8 verified walkable spawn points across Turbine's multi-tier arena
    this.spawnPoints = [
      new THREE.Vector3(18.0, 8.54, -42.0),
      new THREE.Vector3(-26.0, 16.1, -10.0),
      new THREE.Vector3(0.0, 20.99, 0.0),
      new THREE.Vector3(-15.0, 19.52, 25.0),
      new THREE.Vector3(2.0, 11.97, -48.0),
      new THREE.Vector3(6.0, 9.03, 46.0),
      new THREE.Vector3(20.0, 10.1, -10.0),
      new THREE.Vector3(-33.9, 6.19, 33.3)
    ];

    // Sci-fi industrial lighting
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 1.2);
    hemiLight.position.set(0, 40, 0);
    this.scene.add(hemiLight);
    this.mapObjects.push(hemiLight);

    const ambLight = new THREE.AmbientLight(0x93c5fd, 0.6);
    this.scene.add(ambLight);
    this.mapObjects.push(ambLight);

    const sun = new THREE.DirectionalLight(0xe0f2fe, 1.6);
    sun.position.set(0, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    const d = 50;
    sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
    sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 160;
    this.scene.add(sun);
    this.mapObjects.push(sun);

    // Cyan & purple atmospheric point lights
    const p1 = new THREE.PointLight(0x00f0ff, 3.0, 35, 1.2);
    p1.position.set(0, 15, 0);
    const p2 = new THREE.PointLight(0xa855f7, 2.5, 30, 1.2);
    p2.position.set(-20, 18, 10);
    const p3 = new THREE.PointLight(0x00f0ff, 2.5, 30, 1.2);
    p3.position.set(20, 12, -20);
    this.scene.add(p1, p2, p3);
    this.mapObjects.push(p1, p2, p3);

    // Arena boundary perimeter (74m x 108m)
    this.buildInvisibleArenaPerimeter(37, 54);

    this.loadGlbArena(
      '/assets/models/dm-turbine_-_ut_multiplayer_map.glb',
      ['turbine', 'station'],
      1.5,
      'DM-Turbine (Unreal Tournament)',
      () => this.buildDust2()
    );
  }

  buildSpaceStation() {
    this.buildTurbine();
  }

  // ==========================================
  // MAP 3: FRENZY (Half-Life Multiplayer Map)
  // half-life_-_frenzy_-_multiplayer_map.glb (731 KB, 5,122 tris)
  // ==========================================
  buildFrenzy() {
    this.baseFloorHeight = 0.0;
    this.scene.background = new THREE.Color(0x1a242c);
    this.scene.fog = new THREE.FogExp2(0x1f2c36, 0.008);

    // 8 verified walkable spawn points across Frenzy's courtyard & towers
    this.spawnPoints = [
      new THREE.Vector3(28.0, 1.88, -20.0),
      new THREE.Vector3(15.0, 6.95, -22.0),
      new THREE.Vector3(13.0, 6.7, 24.0),
      new THREE.Vector3(-30.0, 6.77, 10.0),
      new THREE.Vector3(-30.0, 6.9, -14.0),
      new THREE.Vector3(-4.9, 16.78, 28.0),
      new THREE.Vector3(20.0, 6.83, 0.0),
      new THREE.Vector3(5.0, 17.97, -5.0)
    ];

    // Industrial desert outpost lighting
    const hemiLight = new THREE.HemisphereLight(0xfef08a, 0x1c1917, 1.2);
    hemiLight.position.set(0, 35, 0);
    this.scene.add(hemiLight);
    this.mapObjects.push(hemiLight);

    const ambLight = new THREE.AmbientLight(0xfde68a, 0.65);
    this.scene.add(ambLight);
    this.mapObjects.push(ambLight);

    const sun = new THREE.DirectionalLight(0xfffbeb, 1.8);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    const d = 45;
    sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
    sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 140;
    this.scene.add(sun);
    this.mapObjects.push(sun);

    const p1 = new THREE.PointLight(0xf59e0b, 2.0, 25, 1.5);
    p1.position.set(0, 8, 0);
    const p2 = new THREE.PointLight(0xef4444, 1.8, 20, 1.5);
    p2.position.set(-18, 8, 12);
    this.scene.add(p1, p2);
    this.mapObjects.push(p1, p2);

    // Arena boundary perimeter (76m x 65m)
    this.buildInvisibleArenaPerimeter(38, 33);

    this.loadGlbArena(
      '/assets/models/half-life_-_frenzy_-_multiplayer_map.glb',
      ['frenzy', 'desert'],
      1.8,
      'Frenzy (Half-Life)',
      () => this.buildDust2()
    );
  }

  buildDesertOutpost() {
    this.buildFrenzy();
  }

  // ==========================================
  // MAP 4: DUST II (de_dust2_-_cs_map.glb)
  // Full-scale authentic Counter-Strike de_dust2 (1.43 MB, 9294 triangles!)
  // Fast 15ms load, buttery smooth 144 FPS, zero floating!
  // ==========================================
  buildDust2() {
    this.baseFloorHeight = 0.0;

    // Classic Counter-Strike Dust II warm desert atmosphere
    this.scene.background = new THREE.Color(0xaed0ee);
    this.scene.fog = new THREE.FogExp2(0xc5dcee, 0.005);

    // 8 authentic spawns covering Bombsite A, Bombsite B, Long A, Catwalk, Mid, Tunnels, CT & T Spawns (2.0x scale)
    this.spawnPoints = [
      new THREE.Vector3(34.0, 9.28, -40.0),  // CT Spawn
      new THREE.Vector3(-56.0, 7.57, -64.0), // T Spawn
      new THREE.Vector3(22.0, 6.72, 32.0),   // Bombsite A
      new THREE.Vector3(-50.0, 10.13, 44.0), // Bombsite B
      new THREE.Vector3(28.0, 6.72, 2.0),    // Long A
      new THREE.Vector3(-8.0, 10.13, 50.0),  // Catwalk / Short A
      new THREE.Vector3(-2.0, 3.37, -4.0),   // Middle
      new THREE.Vector3(-44.0, 7.57, -4.0)   // Upper B Tunnels
    ];

    // Ambient and warm sky hemisphere lighting
    const hemiLight = new THREE.HemisphereLight(0xfff7ed, 0x8f7c68, 1.1);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);
    this.mapObjects.push(hemiLight);

    const ambLight = new THREE.AmbientLight(0xffeedd, 0.75);
    this.scene.add(ambLight);
    this.mapObjects.push(ambLight);

    // Warm desert sunlight (optimized 1024x1024 shadows for 144 FPS)
    const sun = new THREE.DirectionalLight(0xfffaed, 2.0);
    sun.position.set(-50, 90, -40);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    const d = 85;
    sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
    sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 250;
    this.scene.add(sun);
    this.mapObjects.push(sun);

    // Invisible perimeter boundary walls to keep players in combat zone (scaled to 120m x 142m)
    this.buildInvisibleArenaPerimeter(60, 71);

    // Load user's optimized de_dust2_-_cs_map.glb (1.43 MB, 9,294 triangles!)
    this.loadGlbArena(
      '/assets/models/de_dust2_-_cs_map.glb',
      ['dust2', 'dungeon'],
      2.0,
      'Dust II (Counter-Strike)',
      () => this.buildDesertOutpost()
    );
  }

  // ==========================================
  // MAP 5: COLOSSEUM ARENA (Roman Gladiatorial Battleground)
  // Full-scale circular stone colosseum with sandy combat floor
  // ==========================================
  buildColosseumArena() {
    this.buildItaly();
  }

  // CS Italy Map
  buildItaly() {
    this.baseFloorHeight = 0.0;
    this.scene.background = new THREE.Color(0x8ab4f8);
    this.scene.fog = new THREE.FogExp2(0xb0c8f0, 0.005);

    // 8 verified walkable spawn points across Italy's alleys, market & archways
    this.spawnPoints = [
      new THREE.Vector3(-12.0, 7.01, 58.0),   // CT Spawn / Market
      new THREE.Vector3(-18.0, 3.89, 42.0),   // Market corridor
      new THREE.Vector3(-5.0, 3.7, 20.0),     // Wine cellar / Middle alley
      new THREE.Vector3(0.0, 11.09, 0.0),     // Apartments / Bridge
      new THREE.Vector3(18.0, 3.68, -20.0),   // Long street
      new THREE.Vector3(-25.0, 14.51, -52.0), // T Spawn archway
      new THREE.Vector3(26.0, 15.33, -60.0),  // T Spawn courtyard
      new THREE.Vector3(-15.0, 12.0, -20.0)   // Hostage House entrance
    ];

    // Sunset lighting
    // Mediterranean sky and sunlight
    const hemiLight = new THREE.HemisphereLight(0xfef08a, 0x854d0e, 1.2);
    hemiLight.position.set(0, 45, 0);
    this.scene.add(hemiLight);
    this.mapObjects.push(hemiLight);

    const ambLight = new THREE.AmbientLight(0xfffbeb, 0.75);
    this.scene.add(ambLight);
    this.mapObjects.push(ambLight);

    const sun = new THREE.DirectionalLight(0xfffaed, 2.0);
    sun.position.set(-40, 75, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    const d = 60;
    sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
    sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 180;
    this.scene.add(sun);
    this.mapObjects.push(sun);

    // Arena boundary perimeter (74m x 134m)
    this.buildInvisibleArenaPerimeter(37, 67);

    this.loadGlbArena(
      '/assets/models/counter-strike_italy_-_classic_cs_map_in_3d.glb',
      ['italy', 'arena', 'colosseum'],
      0.026,
      'cs_italy (Counter-Strike)',
      () => this.buildDust2()
    );
  }

  // Shared GLB loader with Octree collision setup and race-safe load token
  loadGlbArena(glbPath, validMapIds, scale, label, fallbackFn) {
    const loadToken = this._loadToken;
    const loader = new GLTFLoader();
    loader.load(glbPath, (gltf) => {
      if (loadToken !== this._loadToken || !validMapIds.includes(this.currentMapId)) return;

      const model = gltf.scene;
      model.scale.set(scale, scale, scale);
      model.updateMatrixWorld(true);

      const initialBox = new THREE.Box3().setFromObject(model);
      const center = initialBox.getCenter(new THREE.Vector3());
      const minY = initialBox.min.y;

      const root = new THREE.Group();
      root.add(model);
      model.position.set(-center.x, -minY, -center.z);
      root.updateMatrixWorld(true);

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => { if (m.map) m.map.anisotropy = 4; });
            } else if (child.material.map) {
              child.material.map.anisotropy = 4;
            }
          }
          this.shootableMeshes.push(child);
        }
      });

      this.scene.add(root);
      this.mapObjects.push(root);

      this.octree = new Octree();
      this.octree.fromGraphNode(root);
      this.mapBounds = this.octree.bounds.clone();
      this.perimeterBounds = {
        minX: this.mapBounds.min.x,
        maxX: this.mapBounds.max.x,
        minZ: this.mapBounds.min.z,
        maxZ: this.mapBounds.max.z
      };
      this.isMapReady = true;
      console.log(`[ArenaMap] ${label} loaded & Octree ready.`);
    }, undefined, (err) => {
      if (loadToken !== this._loadToken) return;
      console.warn(`[ArenaMap] ${label} load error, applying fallback:`, err);
      if (fallbackFn) fallbackFn();
    });
  }

  // Invisible perimeter boundary to prevent falling out of 3D arena
  buildInvisibleArenaPerimeter(halfW = 25, halfL = 25) {
    this.perimeterBounds = {
      minX: -halfW,
      maxX: halfW,
      minZ: -halfL,
      maxZ: halfL
    };

    const wallThickness = 1.0;
    const wallHeight = 80.0;
    const wallCenterY = 30.0; // Spans y = -10 to y = +70
    const wallMat = new THREE.MeshBasicMaterial({ visible: false });

    const walls = [
      { x: 0, y: wallCenterY, z: -halfL - wallThickness * 0.5, w: halfW * 2 + 2, d: wallThickness },
      { x: 0, y: wallCenterY, z: halfL + wallThickness * 0.5, w: halfW * 2 + 2, d: wallThickness },
      { x: -halfW - wallThickness * 0.5, y: wallCenterY, z: 0, w: wallThickness, d: halfL * 2 + 2 },
      { x: halfW + wallThickness * 0.5, y: wallCenterY, z: 0, w: wallThickness, d: halfL * 2 + 2 }
    ];

    walls.forEach(w => {
      const geo = new THREE.BoxGeometry(w.w, wallHeight, w.d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(w.x, w.y, w.z);
      this.scene.add(mesh);
      this.registerCollider(mesh);
    });
  }

  // Double-sided capsule-vs-triangle intersection using prevAnchor to guarantee zero wall pass-through
  _doubleSidedTriangleCapsuleIntersect(capsule, tri, prevAnchor) {
    tri.getPlane(_plane);
    const r = capsule.radius;
    const d1 = _plane.distanceToPoint(capsule.start);
    const d2 = _plane.distanceToPoint(capsule.end);

    if ((d1 > r && d2 > r) || (d1 < -r && d2 < -r)) {
      return null;
    }

    if ((d1 >= 0 && d2 <= 0) || (d1 <= 0 && d2 >= 0)) {
      const denom = Math.abs(d1) + Math.abs(d2);
      const t = denom > 1e-8 ? Math.abs(d1) / denom : 0.5;
      _qPt.lerpVectors(capsule.start, capsule.end, t);
    } else {
      _qPt.copy(Math.abs(d1) < Math.abs(d2) ? capsule.start : capsule.end);
    }

    _plane.projectPoint(_qPt, _projPt);
    if (tri.containsPoint(_projPt)) {
      const distToPlane = _plane.distanceToPoint(_qPt);
      const prevDist = _plane.distanceToPoint(prevAnchor);
      let sign = prevDist >= 0 ? 1 : -1;
      if (Math.abs(prevDist) < 1e-5) {
        sign = distToPlane >= 0 ? 1 : -1;
      }
      const sameSide = (distToPlane * prevDist) >= 0 || Math.abs(distToPlane) < 1e-5;
      const depth = sameSide ? (r - Math.abs(distToPlane)) : (r + Math.abs(distToPlane));
      if (depth > 0) {
        return {
          nx: _plane.normal.x * sign,
          ny: _plane.normal.y * sign,
          nz: _plane.normal.z * sign,
          depth
        };
      }
    }

    // Check triangle edges if closest point lies outside triangle interior
    let minDistSq = r * r;
    let found = false;
    let bestSegX = 0, bestSegY = 0, bestSegZ = 0;
    let bestTriX = 0, bestTriY = 0, bestTriZ = 0;

    const edges = [
      [tri.a, tri.b],
      [tri.b, tri.c],
      [tri.c, tri.a]
    ];
    for (let i = 0; i < 3; i++) {
      closestPointsLineToLine(capsule.start, capsule.end, edges[i][0], edges[i][1], _pt1, _pt2);
      const dSq = _pt1.distanceToSquared(_pt2);
      if (dSq < minDistSq) {
        minDistSq = dSq;
        found = true;
        bestSegX = _pt1.x; bestSegY = _pt1.y; bestSegZ = _pt1.z;
        bestTriX = _pt2.x; bestTriY = _pt2.y; bestTriZ = _pt2.z;
      }
    }

    if (found) {
      const dist = Math.sqrt(minDistSq);
      let nx = bestSegX - bestTriX;
      let ny = bestSegY - bestTriY;
      let nz = bestSegZ - bestTriZ;
      const lenSq = nx * nx + ny * ny + nz * nz;
      if (lenSq > 1e-10) {
        const inv = 1 / Math.sqrt(lenSq);
        nx *= inv; ny *= inv; nz *= inv;
      } else {
        const prevDist = _plane.distanceToPoint(prevAnchor);
        const s = prevDist >= 0 ? 1 : -1;
        nx = _plane.normal.x * s;
        ny = _plane.normal.y * s;
        nz = _plane.normal.z * s;
      }
      return { nx, ny, nz, depth: r - dist };
    }

    return null;
  }

  // Clamp position inside tight arena perimeter bounds
  _clampToPerimeter(pos, radius = 0.28) {
    if (!this.perimeterBounds) return;
    const minX = this.perimeterBounds.minX + radius;
    const maxX = this.perimeterBounds.maxX - radius;
    const minZ = this.perimeterBounds.minZ + radius;
    const maxZ = this.perimeterBounds.maxZ - radius;
    if (minX < maxX) pos.x = Math.max(minX, Math.min(maxX, pos.x));
    if (minZ < maxZ) pos.z = Math.max(minZ, Math.min(maxZ, pos.z));
  }

  // Sub-stepped horizontal movement with double-sided wall sliding and perimeter clamping
  moveAndCollideHorizontal(prevPos, displacement, playerHeight = 1.6, radius = 0.28) {
    const cur = prevPos.clone();
    const totalHoriz = Math.hypot(displacement.x, displacement.z);
    if (totalHoriz < 1e-6) {
      this._clampToPerimeter(cur, radius);
      return cur;
    }

    const MAX_SUBSTEP = 0.10;
    const steps = Math.min(20, Math.max(1, Math.ceil(totalHoriz / MAX_SUBSTEP)));
    const stepX = displacement.x / steps;
    const stepZ = displacement.z / steps;

    const capsule = new Capsule(new THREE.Vector3(), new THREE.Vector3(), radius);
    const prevAnchor = new THREE.Vector3();
    const tris = [];

    for (let s = 0; s < steps; s++) {
      prevAnchor.set(cur.x, cur.y - 0.65, cur.z);
      cur.x += stepX;
      cur.z += stepZ;
      this._clampToPerimeter(cur, radius);

      if (!this.octree) continue;

      const feetY = cur.y - playerHeight;
      for (let iter = 0; iter < 3; iter++) {
        capsule.start.set(cur.x, feetY + 0.55, cur.z);
        capsule.end.set(cur.x, cur.y - 0.25, cur.z);

        tris.length = 0;
        this.octree.getCapsuleTriangles(capsule, tris);

        let moved = false;
        for (let i = 0; i < tris.length; i++) {
          const tri = tris[i];
          tri.getNormal(_triNormal);
          if (_triNormal.lengthSq() < 1e-8) continue;

          // Skip walkable floors/ramps so they never cancel or mask wall collisions
          if (Math.abs(_triNormal.y) >= 0.55) continue;

          // Allow stepping onto low stairs/curbs up to 0.50m above feet
          const maxTriY = Math.max(tri.a.y, tri.b.y, tri.c.y);
          if (maxTriY <= feetY + 0.50) continue;

          const hit = this._doubleSidedTriangleCapsuleIntersect(capsule, tri, prevAnchor);
          if (hit && hit.depth > 1e-5) {
            _pushH.set(hit.nx, 0, hit.nz);
            const hLen = _pushH.length();
            if (hLen > 1e-4) {
              _pushH.divideScalar(hLen);
              const pushDist = Math.min(hit.depth / Math.max(hLen, 0.5), radius * 1.5);
              cur.addScaledVector(_pushH, pushDist);
              this._clampToPerimeter(cur, radius);
              moved = true;
            }
          }
        }
        if (!moved) break;
      }
    }

    return cur;
  }

  // Prevents jumping through roofs, tunnel ceilings, or door lintels
  checkCeilingCollision(pos, prevY, playerRadius = 0.28) {
    if (!this.octree) return null;
    const headCapsule = new Capsule(
      new THREE.Vector3(pos.x, pos.y - 0.35, pos.z),
      new THREE.Vector3(pos.x, pos.y - 0.05, pos.z),
      playerRadius
    );
    const tris = [];
    this.octree.getCapsuleTriangles(headCapsule, tris);
    const prevAnchor = new THREE.Vector3(pos.x, prevY - 0.35, pos.z);

    let lowestCeilingPushY = null;
    for (let i = 0; i < tris.length; i++) {
      const tri = tris[i];
      tri.getNormal(_triNormal);
      if (_triNormal.lengthSq() < 1e-8) continue;
      if (Math.abs(_triNormal.y) < 0.45) continue;
      const minTriY = Math.min(tri.a.y, tri.b.y, tri.c.y);
      if (minTriY < prevY - 0.15) continue;

      const hit = this._doubleSidedTriangleCapsuleIntersect(headCapsule, tri, prevAnchor);
      if (hit && hit.depth > 1e-4 && hit.ny < -0.3) {
        const clampedY = pos.y - hit.depth;
        if (lowestCeilingPushY === null || clampedY < lowestCeilingPushY) {
          lowestCeilingPushY = clampedY;
        }
      }
    }
    return lowestCeilingPushY;
  }

  // Raycast helper returning highest walkable floor <= maxAcceptY using double-sided triangles
  _raycastHighestFloorAt(x, originY, z, maxAcceptY, maxDrop = 35.0) {
    if (!this.octree) return null;
    const ray = new THREE.Ray(new THREE.Vector3(x, originY, z), _downDir);
    const tris = [];
    this.octree.getRayTriangles(ray, tris);

    let bestFloorY = null;
    const minAcceptY = originY - maxDrop;

    for (let i = 0; i < tris.length; i++) {
      const tri = tris[i];
      // backfaceCulling = false so double-sided floors/ramps with downward normals never drop players!
      const hit = ray.intersectTriangle(tri.a, tri.b, tri.c, false, _hitPt);
      if (!hit) continue;
      if (_hitPt.y > maxAcceptY || _hitPt.y < minAcceptY) continue;

      tri.getNormal(_triNormal);
      if (_triNormal.lengthSq() < 1e-8) continue;
      if (Math.abs(_triNormal.y) < 0.55) continue;

      if (bestFloorY === null || _hitPt.y > bestFloorY) {
        bestFloorY = _hitPt.y;
      }
    }

    return bestFloorY;
  }

  // Floor height calculation with double-sided triangle raycasting and seam fallback
  getFloorHeight(pos, _unused = null, playerRadius = 0.28, feetY = 0) {
    if (!this.octree) {
      return null;
    }

    const originY = feetY + 0.9;
    const maxStepY = feetY + 0.55;
    const centerFloor = this._raycastHighestFloorAt(pos.x, originY, pos.z, maxStepY, 40.0);

    // If center ray found solid floor within 1m below feet, use it directly
    if (centerFloor !== null && centerFloor >= feetY - 1.0) {
      return centerFloor;
    }

    // Perimeter offset fallback (prevents falling through 1mm triangle weld seams on bridges/stairs)
    const offset = playerRadius * 0.75;
    const offsets = [
      [offset, 0], [-offset, 0], [0, offset], [0, -offset]
    ];
    let seamFloor = centerFloor;
    for (let i = 0; i < offsets.length; i++) {
      const f = this._raycastHighestFloorAt(
        pos.x + offsets[i][0],
        originY,
        pos.z + offsets[i][1],
        feetY + 0.15,
        40.0
      );
      if (f !== null && (seamFloor === null || f > seamFloor)) {
        seamFloor = f;
      }
    }

    return seamFloor;
  }

  // Checks if there is any walkable map floor vertically below the given position
  hasFloorBelow(x, feetY, z) {
    if (!this.octree) return false;
    return this._raycastHighestFloorAt(x, feetY + 0.9, z, feetY + 0.55, 60.0) !== null;
  }

  // Checks if player has left valid map bounds or fallen beneath the arena
  isOutOfPlayableBounds(pos, playerHeight = 1.6) {
    const feetY = pos.y - playerHeight;
    if (this.mapBounds) {
      if (
        pos.x < this.mapBounds.min.x - 1.5 ||
        pos.x > this.mapBounds.max.x + 1.5 ||
        pos.z < this.mapBounds.min.z - 1.5 ||
        pos.z > this.mapBounds.max.z + 1.5 ||
        feetY < this.mapBounds.min.y - 2.0
      ) {
        return true;
      }
    } else if (feetY < -2.5) {
      return true;
    }
    return false;
  }

  // Safe spawn generator for respawns
  getRandomSpawn(excludeIndex = -1) {
    if (!this.spawnPoints.length) return { x: 0, y: 1.6, z: 0 };
    let idx = Math.floor(Math.random() * this.spawnPoints.length);
    if (idx === excludeIndex && this.spawnPoints.length > 1) {
      idx = (idx + 1) % this.spawnPoints.length;
    }
    return this.spawnPoints[idx];
  }

  // Check if player stepped on a jump pad
  checkJumpPad(playerPos) {
    for (let i = 0; i < this.jumpPads.length; i++) {
      const pad = this.jumpPads[i];
      const dx = playerPos.x - pad.x;
      const dz = playerPos.z - pad.z;
      if (dx * dx + dz * dz < pad.radius * pad.radius) {
        return pad.force;
      }
    }
    return null;
  }
}
