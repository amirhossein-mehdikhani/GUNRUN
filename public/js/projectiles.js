// projectiles.js - Physics-based Tactical Grenade & Flashbang System
import * as THREE from 'three';
import { SoundEffects } from './audio.js';

export class ProjectileManager {
  constructor(scene, arenaMap, camera) {
    this.scene = scene;
    this.arenaMap = arenaMap;
    this.camera = camera;

    this.projectiles = []; // Active flying grenades & flashbangs
    this.explosionEffects = []; // Active explosion particles
    this.fireZones = [];
    this.bottleGeo=new THREE.CylinderGeometry(.055,.075,.25,8);
    this.bottleMat=new THREE.MeshStandardMaterial({color:0x38612d,roughness:.35});
    this.neckGeo=new THREE.CylinderGeometry(.025,.025,.1,6);
    this.flameGeo=new THREE.ConeGeometry(.28,1,5);
    this.wickMat=new THREE.MeshBasicMaterial({color:0xffa522});

    // Pre-warmed shared geometries & materials (prevents runtime stutter/GC lag)
    this.fragGeo = new THREE.SphereGeometry(0.12, 10, 8);
    this.fragMat = new THREE.MeshStandardMaterial({ color: 0x3f4f24, roughness: 0.6, metalness: 0.4 });
    this.fragPinGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.06, 6);
    this.fragPinMat = new THREE.MeshStandardMaterial({ color: 0x1f2937 });

    this.flashGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.18, 10);
    this.flashMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
    this.flashStripeGeo = new THREE.CylinderGeometry(0.062, 0.062, 0.04, 10);
    this.flashStripeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    this.fireGeo = new THREE.SphereGeometry(0.6, 12, 10);
    this.flashBurstGeo = new THREE.SphereGeometry(0.5, 10, 8);
    this.debrisGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    this.debrisMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });

    // Single persistent light (intensity 0 when idle) so WebGL never recompiles scene shaders mid-match
    this.fxLight = new THREE.PointLight(0xff8822, 0, 26, 1.5);
    this.fxLightTimer = 0;
    this.fxLightDuration = 0.5;
    this.fxLightMaxIntensity = 0;
    this.scene.add(this.fxLight);
  }

  // Spawn a thrown projectile (Frag or Flash)
  spawnProjectile(type, startPos, velocity, isLocal = true, id = null, onDetonate = null) {
    const projId = id || 'proj_' + Math.random().toString(36).substring(2, 9);
    let mesh;

    if(type==='molotov') {
      mesh=new THREE.Mesh(this.bottleGeo,this.bottleMat);
      const neck=new THREE.Mesh(this.neckGeo,this.bottleMat);neck.position.y=.17;mesh.add(neck);
      const wick=new THREE.Mesh(this.flameGeo,this.wickMat);wick.scale.set(.15,.12,.15);wick.position.y=.28;mesh.add(wick);
    } else if (type === 'frag') {
      mesh = new THREE.Mesh(this.fragGeo, this.fragMat);
      const pin = new THREE.Mesh(this.fragPinGeo, this.fragPinMat);
      pin.position.y = 0.12;
      mesh.add(pin);
    } else {
      mesh = new THREE.Mesh(this.flashGeo, this.flashMat);
      const stripe = new THREE.Mesh(this.flashStripeGeo, this.flashStripeMat);
      mesh.add(stripe);
    }

    mesh.position.copy(startPos);
    this.scene.add(mesh);

    const projectile = {
      id: projId,
      type: type,
      mesh: mesh,
      velocity: velocity.clone(),
      life: type === 'flash' ? 1.8 : 2.5, // fuse duration
      isLocal: isLocal,
      bounces: 0,
      bounceCooldown: 0,
      onDetonate: onDetonate
    };

    this.projectiles.push(projectile);
    return projectile;
  }

  // Detonate Frag Grenade (Fireball, debris, sound)
  detonateFrag(pos, _isLocal = true) {
    const dist = this.camera.position.distanceTo(pos);
    SoundEffects.playExplosion(dist);

    this.fxLight.color.setHex(0xff7700);
    this.fxLight.position.copy(pos);
    this.fxLight.intensity = 8.0;
    this.fxLightMaxIntensity = 8.0;
    this.fxLightDuration = 0.7;
    this.fxLightTimer = 0.7;

    // Glowing expanding fireball core
    const fireMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const fireball = new THREE.Mesh(this.fireGeo, fireMat);
    fireball.position.copy(pos);
    this.scene.add(fireball);

    // Debris / Spark particles using shared geometry & material
    const particles = [];
    for (let i = 0; i < Math.ceil(16 * (this.effectScale ?? 1)); i++) {
      const p = new THREE.Mesh(this.debrisGeo, this.debrisMat);
      p.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 16,
        Math.random() * 11 + 2,
        (Math.random() - 0.5) * 16
      );
      this.scene.add(p);
      particles.push({ mesh: p, vel });
    }

    this.explosionEffects.push({
      fireball: fireball,
      particles: particles,
      time: 0,
      duration: 0.75
    });
  }

  // Detonate Flashbang (Blinding flash & tinnitus)
  detonateFlash(pos) {
    const dist = this.camera.position.distanceTo(pos);

    // Trigger flash light using pre-warmed persistent light
    this.fxLight.color.setHex(0xffffff);
    this.fxLight.position.copy(pos);
    this.fxLight.intensity = 12.0;
    this.fxLightMaxIntensity = 12.0;
    this.fxLightDuration = 0.2;
    this.fxLightTimer = 0.2;

    // Quick white flash burst sphere
    const burstMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const burst = new THREE.Mesh(this.flashBurstGeo, burstMat);
    burst.position.copy(pos);
    this.scene.add(burst);
    this.explosionEffects.push({
      fireball: burst,
      particles: [],
      time: 0,
      duration: 0.22
    });

    // Check if local player was blinded
    if (dist < 35) {
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);

      const toFlash = new THREE.Vector3().subVectors(pos, this.camera.position).normalize();
      const dot = camDir.dot(toFlash);

      // Wider forward exposure and a stronger close-range blast.
      if (dot > -0.15 || dist < 10) {
        SoundEffects.playFlashbang();
        const intensity = Math.min(1, Math.max(0.65, 1.35 - (dist / 35)));
        this.triggerFlashbangOverlay(intensity);
      }
    }
  }

  triggerFlashbangOverlay(intensity) {
    const overlay = document.getElementById('flashbang-overlay');
    if (!overlay) return;

    clearTimeout(this.flashFadeTimer);
    overlay.style.transition = 'none';
    overlay.style.opacity = `${intensity}`;

    setTimeout(() => {
      overlay.style.transition = 'opacity 3.5s cubic-bezier(0.2, 0.8, 0.3, 1)';
      overlay.style.opacity = '0';
    }, 350 + intensity * 900);
  }

  igniteMolotov({id,position,duration,radius}) {
    const flying=this.projectiles.findIndex(p=>p.id===id);
    if(flying>=0) {this.scene.remove(this.projectiles[flying].mesh);this.projectiles.splice(flying,1);}
    const group=new THREE.Group();group.position.set(position.x,position.y,position.z);
    const material=new THREE.MeshBasicMaterial({color:0xff7417,transparent:true,opacity:.8,depthWrite:false});
    const count=Math.max(5,Math.ceil(14*(this.effectScale??1)));
    for(let i=0;i<count;i++) {
      const flame=new THREE.Mesh(this.flameGeo,material);
      const angle=i*2.39996, r=radius*Math.sqrt(i/count)*.85;
      flame.position.set(Math.cos(angle)*r,.5,Math.sin(angle)*r);group.add(flame);
    }
    // A cheap ground footprint shows the full damage radius, including low quality mode.
    const discGeo=new THREE.CircleGeometry(radius,24);
    const discMat=new THREE.MeshBasicMaterial({color:0xe84d09,transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide});
    const disc=new THREE.Mesh(discGeo,discMat);disc.rotation.x=-Math.PI/2;disc.position.y=.02;group.add(disc);
    this.scene.add(group);this.fireZones.push({group,material,discGeo,discMat,time:0,duration});
  }

  removeFire(zone) {
    this.scene.remove(zone.group);zone.material.dispose();zone.discGeo.dispose();zone.discMat.dispose();
  }

  update(delta, gravity = 22.0) {
    const dt = Math.min(delta, 0.05);

    for(let i=this.fireZones.length-1;i>=0;i--) {
      const fire=this.fireZones[i];fire.time+=delta;
      fire.material.opacity=.8*Math.min(1,(fire.duration-fire.time)*2);
      fire.group.children.forEach((flame,j)=>{if(flame.geometry===this.flameGeo) {flame.scale.y=.65+Math.sin(fire.time*12+j)*.2;flame.rotation.y=fire.time+j;}});
      if(fire.time>=fire.duration) {this.removeFire(fire);this.fireZones.splice(i,1);}
    }
    // Fade persistent FX light smoothly
    if (this.fxLightTimer > 0) {
      this.fxLightTimer = Math.max(0, this.fxLightTimer - dt);
      const ratio = this.fxLightDuration > 0 ? this.fxLightTimer / this.fxLightDuration : 0;
      this.fxLight.intensity = this.fxLightMaxIntensity * ratio;
    }

    // 1. Update active flying projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.bounceCooldown > 0) p.bounceCooldown -= dt;

      // Apply gravity
      p.velocity.y -= gravity * dt;

      // Sub-step motion and swept collision against map Octree / AABBs
      const prevPos = p.mesh.position.clone();
      p.mesh.position.addScaledVector(p.velocity, dt);

      // Tumble / rotate projectile in flight
      p.mesh.rotation.x += dt * 10;
      p.mesh.rotation.z += dt * 7;

      const rad = 0.14;
      const hit = this.arenaMap.resolveProjectileStep
        ? this.arenaMap.resolveProjectileStep(prevPos, p.mesh.position, rad)
        : null;

      if (hit) {
        p.mesh.position.copy(hit.position);
        const vn = p.velocity.dot(hit.normal);
        if (vn < 0) {
          const restitution = Math.abs(hit.normal.y) > 0.6 ? 0.42 : 0.55;
          p.velocity.addScaledVector(hit.normal, -(1 + restitution) * vn);
          p.velocity.multiplyScalar(0.8);
        }
        p.bounces++;
        if (p.bounceCooldown <= 0 && p.velocity.lengthSq() > 2.0) {
          SoundEffects.playGrenadeBounce();
          p.bounceCooldown = 0.08;
        }
      } else if (!this.arenaMap.octree && p.mesh.position.y <= rad) {
        // Fallback floor clamp only when octree map hasn't loaded
        p.mesh.position.y = rad;
        p.velocity.y = -p.velocity.y * 0.45;
        p.velocity.x *= 0.72;
        p.velocity.z *= 0.72;
        p.bounces++;
        if (p.bounceCooldown <= 0 && Math.abs(p.velocity.y) > 1.0) {
          SoundEffects.playGrenadeBounce();
          p.bounceCooldown = 0.08;
        }
      }

      // Detonation time expired
      if (p.life <= 0) {
        const detonatePos = p.mesh.position.clone();

        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);

        if (p.type === 'frag') {
          this.detonateFrag(detonatePos, p.isLocal);
        } else {
          this.detonateFlash(detonatePos);
        }

        if (p.onDetonate) {
          p.onDetonate(detonatePos);
        }
      }
    }

    // 2. Update visual explosion effects
    for (let i = this.explosionEffects.length - 1; i >= 0; i--) {
      const eff = this.explosionEffects[i];
      eff.time += dt;
      const progress = eff.time / eff.duration;

      eff.fireball.scale.addScalar(dt * 14);
      eff.fireball.material.opacity = Math.max(0, 1 - progress);

      for (const pt of eff.particles) {
        pt.vel.y -= 25 * dt;
        pt.mesh.position.addScaledVector(pt.vel, dt);
        pt.mesh.scale.multiplyScalar(0.95);
      }

      if (progress >= 1.0) {
        this.scene.remove(eff.fireball);
        eff.fireball.material.dispose();

        for (const pt of eff.particles) {
          this.scene.remove(pt.mesh);
        }

        this.explosionEffects.splice(i, 1);
      }
    }
  }

  clear() {
    this.fireZones.forEach(zone=>this.removeFire(zone));this.fireZones=[];
    this.projectiles.forEach(p => {
      this.scene.remove(p.mesh);
    });
    this.projectiles = [];

    this.explosionEffects.forEach(eff => {
      this.scene.remove(eff.fireball);
      if (eff.fireball.material) eff.fireball.material.dispose();
      eff.particles.forEach(pt => this.scene.remove(pt.mesh));
    });
    this.explosionEffects = [];

    this.fxLight.intensity = 0;
    this.fxLightTimer = 0;
  }
}
