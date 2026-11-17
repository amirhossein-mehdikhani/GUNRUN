import { playerLoadout, fullMagazines } from './loadout.js';
// weapon.js - Multi-Weapon Loadout Engine: Assault Rifle, Semi-Auto DMR, Sniper Rifle, & Combat Knife
import * as THREE from 'three';
import { SoundEffects } from './audio.js';

import { WEAPON_TYPES } from './weapons.js';
export { WEAPON_TYPES } from './weapons.js';

export class WeaponController {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;

    this.rootGroup = new THREE.Group();
    this.loadout = [1,2];
    this.currentSlot = 1;
    this.isScoped = false;
    this.isReloading = false;
    this.isSwitching = false;

    // Per-weapon ammo store
    this.ammoState = {
      1: 30,
      2: 12,
      3: 5,
      4: 999
    };

    this.lastShotTime = 0;
    this.walkBobTimer = 0;
    this.recoilAmount = 0;

    // Base positions
    this.idlePos = new THREE.Vector3(0.24, -0.22, -0.48);
    this.knifeIdlePos = new THREE.Vector3(0.22, -0.20, -0.42);

    // Bullet tracers pool & impacts
    this.tracers = [];
    this.impactParticles = [];

    // Weapon Meshes container
    this.weaponMeshes = {};
    this.buildAllWeapons();

    this.camera.add(this.rootGroup);
    this.equipSlot(1, false);
  }

  get config() {
    return WEAPON_TYPES[this.currentSlot];
  }

  get currentAmmo() {
    return this.ammoState[this.currentSlot];
  }

  set currentAmmo(val) {
    this.ammoState[this.currentSlot] = val;
  }

  buildAllWeapons() {
    this.weaponMeshes[1] = this.buildAssaultRifle();
    this.weaponMeshes[2] = this.buildDmrPistol();
    this.weaponMeshes[3] = this.buildSniperRifle();
    this.weaponMeshes[4] = this.buildCombatKnife();

    for (const id of [5,6,7,8]) this.weaponMeshes[id] = this.buildExtraGun(id);
    for (const slot of Object.keys(this.weaponMeshes)) {
      this.rootGroup.add(this.weaponMeshes[slot]);
    }
  }

  configureLoadout(ids) {
    this.loadout = playerLoadout(ids);
    this.ammoState = fullMagazines(this.loadout);
    this.equipSlot(this.loadout[0],false);
  }

  buildExtraGun(id) {
    const group=new THREE.Group();
    const colors={5:0x0891b2,6:0xb45309,7:0x475569,8:0x4d7c0f};
    const body=new THREE.MeshStandardMaterial({color:colors[id],metalness:.65,roughness:.4});
    const dark=new THREE.MeshStandardMaterial({color:0x151923,metalness:.5,roughness:.5});
    const length=id===7?.22:id===5?.32:id===6?.58:.7;
    const add=(w,h,d,x,y,z,mat=body)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);group.add(m);return m;};
    add(.075,.095,length,0,0,0);
    add(.04,.12,.065,0,-.08,length*.27,dark);
    add(.04,id===8?.16:.12,id===8?.16:.065,0,-.09,-.02,dark);
    if(id!==7) add(.05,.055,.18,0,0,length/2+.06,dark);
    if(id===6) add(.085,.065,.16,0,-.03,-length*.25,dark);
    if(id===8) {add(.02,.18,.025,-.06,-.1,-length*.35,dark);add(.02,.18,.025,.06,-.1,-length*.35,dark);}
    const flash=this.createMuzzleFlash();flash.position.set(0,.02,-length/2-.03);group.add(flash);
    group.userData.muzzleFlash=flash;group.userData.muzzlePos=flash.position.clone();
    return group;
  }

  // 1. Assault Rifle 3D Model
  buildAssaultRifle() {
    const group = new THREE.Group();
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, metalness: 0.85, roughness: 0.25 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0d1117, metalness: 0.5, roughness: 0.5 });
    const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const redDot = new THREE.MeshBasicMaterial({ color: 0xff1e42 });

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.36), gunMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.26, 12), gunMat);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.015, -0.28);
    const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.02, 0.06, 8), darkMat);
    muzzleBrake.rotation.x = Math.PI / 2; muzzleBrake.position.set(0, 0.015, -0.42);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.28), darkMat);
    rail.position.set(0, 0.046, -0.02);
    const sightMount = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.07), darkMat);
    sightMount.position.set(0, 0.065, -0.04);
    const sightFrame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.01), gunMat);
    sightFrame.position.set(0, 0.08, -0.06);
    const reticleDot = new THREE.Mesh(new THREE.SphereGeometry(0.003, 8, 8), redDot);
    reticleDot.position.set(0, 0.08, -0.055);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.07), darkMat);
    mag.position.set(0, -0.1, -0.02); mag.rotation.x = 0.2;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.055), darkMat);
    grip.position.set(0, -0.08, 0.12); grip.rotation.x = -0.35;
    const foregrip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.09, 8), darkMat);
    foregrip.position.set(0, -0.06, -0.16);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.065, 0.16), darkMat);
    stock.position.set(0, -0.01, 0.24);

    const powerStrip = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.006, 0.14), cyanGlow);
    powerStrip.position.set(0, 0.02, 0.04);

    // Muzzle Flash
    const flashGroup = this.createMuzzleFlash();
    flashGroup.position.set(0, 0.015, -0.46);

    group.add(receiver, barrel, muzzleBrake, rail, sightMount, sightFrame, reticleDot, mag, grip, foregrip, stock, powerStrip, flashGroup);
    group.userData.muzzleFlash = flashGroup;
    group.userData.muzzlePos = new THREE.Vector3(0, 0.015, -0.46);
    return group;
  }

  // 2. Semi-Auto DMR / Tactical Pistol 3D Model
  buildDmrPistol() {
    const group = new THREE.Group();
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
    const amberGlow = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

    // Extended slide & receiver
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.28), steelMat);
    slide.position.set(0, 0.02, -0.04);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 8), steelMat);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, -0.22);

    // Compensator
    const comp = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.055, 0.06), gripMat);
    comp.position.set(0, 0.02, -0.27);

    // Pistol grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.14, 0.06), gripMat);
    grip.position.set(0, -0.06, 0.04); grip.rotation.x = -0.28;

    // Tactical mini reflex sight
    const reflex = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.04), gripMat);
    reflex.position.set(0, 0.06, -0.02);
    const reflexDot = new THREE.Mesh(new THREE.SphereGeometry(0.003, 8, 8), amberGlow);
    reflexDot.position.set(0, 0.06, -0.018);

    const flashGroup = this.createMuzzleFlash();
    flashGroup.position.set(0, 0.02, -0.31);

    group.add(slide, barrel, comp, grip, reflex, reflexDot, flashGroup);
    group.userData.muzzleFlash = flashGroup;
    group.userData.muzzlePos = new THREE.Vector3(0, 0.02, -0.31);
    return group;
  }

  // 3. Heavy Sniper Rifle 3D Model
  buildSniperRifle() {
    const group = new THREE.Group();
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.9, roughness: 0.2 });
    const stockMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    const scopeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.3 });

    // Long receiver & heavy fluted barrel
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.44), gunMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.55, 12), gunMat);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, -0.48);

    // Large tactical muzzle brake
    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.1), gunMat);
    brake.position.set(0, 0.02, -0.78);

    // High-powered Telescopic Optical Scope
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.32, 12), scopeMat);
    scopeTube.rotation.x = Math.PI / 2; scopeTube.position.set(0, 0.09, -0.06);

    const scopeLensFront = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.026, 0.08, 12), scopeMat);
    scopeLensFront.rotation.x = Math.PI / 2; scopeLensFront.position.set(0, 0.09, -0.24);

    const scopeLensRear = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.06, 12), scopeMat);
    scopeLensRear.rotation.x = Math.PI / 2; scopeLensRear.position.set(0, 0.09, 0.12);

    // Scope Mount Rings
    const ring1 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.025), stockMat);
    ring1.position.set(0, 0.06, -0.14);
    const ring2 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.025), stockMat);
    ring2.position.set(0, 0.06, 0.02);

    // Bolt handle & knob
    const boltHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 6), gunMat);
    boltHandle.rotation.z = Math.PI / 2; boltHandle.position.set(0.05, 0.03, 0.08);

    // Sniper Stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.28), stockMat);
    stock.position.set(0, -0.03, 0.34);

    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.13, 0.06), stockMat);
    grip.position.set(0, -0.09, 0.14); grip.rotation.x = -0.3;

    const flashGroup = this.createMuzzleFlash();
    flashGroup.position.set(0, 0.02, -0.84);

    group.add(receiver, barrel, brake, scopeTube, scopeLensFront, scopeLensRear, ring1, ring2, boltHandle, stock, grip, flashGroup);
    group.userData.muzzleFlash = flashGroup;
    group.userData.muzzlePos = new THREE.Vector3(0, 0.02, -0.84);
    return group;
  }

  // 4. Combat Knife 3D Model
  buildCombatKnife() {
    const group = new THREE.Group();
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.15 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const guardMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 });

    // Serrated blade
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.055, 0.28), bladeMat);
    blade.position.set(0, 0.01, -0.16);

    // Pointed tip
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.07, 4), bladeMat);
    tip.rotation.x = -Math.PI / 2; tip.position.set(0, 0.01, -0.32);

    // Crossguard
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.09, 0.02), guardMat);
    guard.position.set(0, 0.01, -0.02);

    // Textured grip
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.16, 8), handleMat);
    handle.rotation.x = Math.PI / 2; handle.position.set(0, -0.005, 0.08);

    // Skull crusher pommel
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), guardMat);
    pommel.position.set(0, -0.005, 0.17);

    group.add(blade, tip, guard, handle, pommel);
    group.position.copy(this.knifeIdlePos);
    group.rotation.set(-0.2, 0.15, -0.3);
    return group;
  }

  createMuzzleFlash() {
    const flashGroup = new THREE.Group();
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9 });

    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), flashMat);
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), flashMat);
    p2.rotation.z = Math.PI / 4;
    const p3 = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), flashMat);
    p3.rotation.y = Math.PI / 2;

    const flashLight = new THREE.PointLight(0xffb703, 4.0, 14);
    flashGroup.add(p1, p2, p3, flashLight);
    flashGroup.visible = false;
    return flashGroup;
  }

  equipSlot(slotIndex, animate = true) {
    if (!this.weaponMeshes[slotIndex] || (!this.loadout.includes(slotIndex) && slotIndex !== 4) || this.currentSlot === slotIndex && animate) return;

    this.currentSlot = slotIndex;
    this.isScoped = false;
    this.isReloading = false;

    // Reset camera zoom
    this.camera.fov = 75;
    this.camera.updateProjectionMatrix();

    // Toggle active 3D model
    for (const key of Object.keys(this.weaponMeshes)) {
      const s=Number(key);
      if (this.weaponMeshes[s]) {
        this.weaponMeshes[s].visible = (s === this.currentSlot);
      }
    }

    if (animate) {
      // Rapid weapon draw transition
      this.isSwitching = true;
      this.rootGroup.position.y = -0.4;
      setTimeout(() => {
        this.rootGroup.position.y = 0;
        this.isSwitching = false;
      }, 140);
    }
  }

  toggleScope(forceState = null) {
    if (!this.config.hasScope || this.isReloading) {
      this.isScoped = false;
      this.camera.fov = 75;
      this.camera.updateProjectionMatrix();
      return false;
    }

    this.isScoped = (forceState !== null) ? forceState : !this.isScoped;
    this.camera.fov = this.isScoped ? 20 : 75;
    this.camera.updateProjectionMatrix();

    // Hide weapon model when looking down high-power sniper scope
    this.weaponMeshes[this.currentSlot].visible = !this.isScoped;
    return this.isScoped;
  }

  canShoot() {
    if (this.isReloading || this.isSwitching) return false;
    const now = performance.now();
    if (now - this.lastShotTime < this.config.fireRate) return false;

    if (this.config.isMelee) return true;
    return this.currentAmmo > 0;
  }

  triggerShootAnimation() {
    const now = performance.now();
    this.lastShotTime = now;

    if (!this.config.isMelee) {
      this.currentAmmo--;
    }

    // Play procedural sound for current weapon
    if ([1,5,8].includes(this.currentSlot)) {
      SoundEffects.playShoot();
    } else if ([2,7].includes(this.currentSlot)) {
      SoundEffects.playDmrShoot();
    } else if ([3,6].includes(this.currentSlot)) {
      SoundEffects.playSniperShoot();
    } else if (this.currentSlot === 4) {
      SoundEffects.playKnifeSlash();
    }

    // Weapon animations
    if (this.config.isMelee) {
      // Knife slash animation
      this.animateKnifeSlash();
      return;
    }

    // Recoil kick
    this.recoilAmount = (this.currentSlot === 3) ? 2.5 : 1.0;

    // Muzzle flash
    const curMesh = this.weaponMeshes[this.currentSlot];
    if (curMesh && curMesh.userData.muzzleFlash && !this.isScoped) {
      const flash = curMesh.userData.muzzleFlash;
      flash.visible = true;
      flash.rotation.z = Math.random() * Math.PI;
      setTimeout(() => { flash.visible = false; }, 45);
    }
  }

  animateKnifeSlash() {
    const knife = this.weaponMeshes[4];
    if (!knife) return;

    let progress = 0;
    const slash = () => {
      progress += 0.18;
      if (progress < 0.5) {
        // Windup & stab forward
        knife.position.z = this.knifeIdlePos.z - 0.25 * (progress / 0.5);
        knife.rotation.x = -0.2 - 0.4 * (progress / 0.5);
        knife.rotation.z = -0.3 + 0.6 * (progress / 0.5);
      } else if (progress < 1.0) {
        // Return to idle
        const p = (progress - 0.5) / 0.5;
        knife.position.z = (this.knifeIdlePos.z - 0.25) + 0.25 * p;
        knife.rotation.x = -0.6 + 0.4 * p;
        knife.rotation.z = 0.3 - 0.6 * p;
      } else {
        knife.position.copy(this.knifeIdlePos);
        knife.rotation.set(-0.2, 0.15, -0.3);
        return;
      }
      requestAnimationFrame(slash);
    };
    requestAnimationFrame(slash);
  }

  reload() {
    if (this.isReloading || this.config.isMelee || this.currentAmmo === this.config.maxAmmo) return;

    this.isReloading = true;
    this.onReload?.();
    const slot = this.currentSlot;
    const generation = this.reloadGeneration = (this.reloadGeneration || 0) + 1;
    if (this.isScoped) this.toggleScope(false);

    SoundEffects.playReload();

    const startTime = performance.now();
    const duration = this.config.reloadDuration;

    const animateReload = () => {
      if (!this.isReloading || this.currentSlot !== slot || this.reloadGeneration !== generation) return;
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1.0, elapsed / duration);

      if (progress < 0.3) {
        const p = progress / 0.3;
        this.rootGroup.position.y = -0.18 * p;
        this.rootGroup.rotation.z = -0.35 * p;
      } else if (progress < 0.7) {
        this.rootGroup.position.y = -0.18;
      } else if (progress < 1.0) {
        const p = (progress - 0.7) / 0.3;
        this.rootGroup.position.y = -0.18 * (1 - p);
        this.rootGroup.rotation.z = -0.35 * (1 - p);
      } else {
        this.currentAmmo = this.config.maxAmmo;
        this.isReloading = false;
        this.rootGroup.position.set(0, 0, 0);
        this.rootGroup.rotation.set(0, 0, 0);
        return;
      }

      if (this.isReloading) {
        requestAnimationFrame(animateReload);
      }
    };

    requestAnimationFrame(animateReload);
  }

  getMuzzleWorldPosition() {
    const curMesh = this.weaponMeshes[this.currentSlot];
    if (curMesh && curMesh.userData.muzzleFlash) {
      const v = new THREE.Vector3();
      curMesh.userData.muzzleFlash.getWorldPosition(v);
      return v;
    }
    return this.camera.position;
  }

  createTracer(startWorldPos, endWorldPos, isLocal = true) {
    const dir = new THREE.Vector3().subVectors(endWorldPos, startWorldPos);
    const dist = dir.length();
    if (dist < 0.1) return;

    const tracerGeo = new THREE.CylinderGeometry(0.015, 0.015, Math.min(dist, 2.0), 6);
    tracerGeo.rotateX(Math.PI / 2);

    const tracerMat = new THREE.MeshBasicMaterial({
      color: isLocal ? 0x00f0ff : 0xf59e0b,
      transparent: true,
      opacity: 0.95
    });

    const tracer = new THREE.Mesh(tracerGeo, tracerMat);
    tracer.position.copy(startWorldPos);
    tracer.lookAt(endWorldPos);
    this.scene.add(tracer);

    this.tracers.push({
      mesh: tracer,
      start: startWorldPos.clone(),
      end: endWorldPos.clone(),
      progress: 0,
      speed: 140
    });

    this.createImpactSparks(endWorldPos);
  }

  createImpactSparks(pos) {
    const count = Math.ceil(7 * (this.effectScale ?? 1));
    const mat = this.sparkMaterial ||= new THREE.MeshBasicMaterial({ color: 0xffd166 });
    const geometry = this.sparkGeometry ||= new THREE.BoxGeometry(0.035, 0.035, 0.035);
    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(geometry, mat);
      p.position.copy(pos);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 4 + 1, (Math.random() - 0.5) * 6);
      this.scene.add(p);
      this.impactParticles.push({ mesh: p, vel, life: 1.0 });
    }
  }

  clearEffects() {
    for (const tracer of this.tracers) {
      this.scene.remove(tracer.mesh);
      tracer.mesh.geometry.dispose();
      tracer.mesh.material.dispose();
    }
    for (const particle of this.impactParticles) this.scene.remove(particle.mesh);
    this.tracers.length = this.impactParticles.length = 0;
  }

  resetAmmo() {
    // Invalidate callbacks from the previous life before refilling every slot.
    this.reloadGeneration = (this.reloadGeneration || 0) + 1;
    this.isReloading = false;
    this.isSwitching = false;
    this.ammoState = fullMagazines(this.loadout);
    if (this.isScoped) this.toggleScope(false);
    this.lastShotTime = 0;
    this.recoilAmount = 0;
    this.rootGroup.position.set(0, 0, 0);
    this.rootGroup.rotation.set(0, 0, 0);
  }

  autoReload() {
    if (!this.config.isMelee && this.currentAmmo <= 0 && !this.isReloading && !this.isSwitching) this.reload();
  }

  update(delta, isMoving, isRunning) {
    this.autoReload();
    // 1. Tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.progress += t.speed * delta;
      const totalDist = t.start.distanceTo(t.end);
      const alpha = Math.min(1.0, t.progress / totalDist);
      t.mesh.position.lerpVectors(t.start, t.end, alpha);
      if (alpha >= 1.0) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
        this.tracers.splice(i, 1);
      }
    }

    // 2. Impact particles
    for (let i = this.impactParticles.length - 1; i >= 0; i--) {
      const p = this.impactParticles[i];
      p.life -= delta * 3.5;
      p.vel.y -= 9.8 * delta;
      p.mesh.position.addScaledVector(p.vel, delta);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        // Spark geometry and material are shared for the app lifetime.
        this.impactParticles.splice(i, 1);
      }
    }

    if (this.isReloading || this.isSwitching) return;

    // 3. Recoil spring recovery
    if (this.recoilAmount > 0) {
      this.recoilAmount = Math.max(0, this.recoilAmount - delta * 6.0);
    }

    const recoilZ = 0.06 * this.recoilAmount;
    const recoilRotX = 0.12 * this.recoilAmount;

    // 4. Bobbing & sway
    let bobX = 0;
    let bobY = 0;

    if (isMoving) {
      const bobFreq = isRunning ? 15 : 10;
      const bobAmp = isRunning ? 0.016 : 0.009;
      this.walkBobTimer += delta * bobFreq;
      bobX = Math.cos(this.walkBobTimer * 0.5) * bobAmp;
      bobY = Math.abs(Math.sin(this.walkBobTimer)) * bobAmp;
    }

    const basePos = (this.currentSlot === 4) ? this.knifeIdlePos : this.idlePos;

    if (this.currentSlot !== 4) {
      this.rootGroup.position.set(basePos.x + bobX, basePos.y + bobY, basePos.z + recoilZ);
      this.rootGroup.rotation.set(recoilRotX, 0, bobX * 1.5);
    } else {
      this.weaponMeshes[4].position.set(basePos.x + bobX, basePos.y + bobY, basePos.z);
    }
  }
}
