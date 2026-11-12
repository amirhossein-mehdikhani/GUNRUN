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
  }

  // Spawn a thrown projectile (Frag or Flash)
  spawnProjectile(type, startPos, velocity, isLocal = true, id = null, onDetonate = null) {
    const projId = id || 'proj_' + Math.random().toString(36).substring(2, 9);
    let mesh;

    if (type === 'frag') {
      // 3D Frag Grenade Mesh (Dark olive green pineapple sphere)
      const geo = new THREE.SphereGeometry(0.12, 10, 8);
      const mat = new THREE.MeshStandardMaterial({ color: 0x3f4f24, roughness: 0.6, metalness: 0.4 });
      mesh = new THREE.Mesh(geo, mat);

      // Grenade pin collar
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 6), new THREE.MeshStandardMaterial({ color: 0x1f2937 }));
      pin.position.y = 0.12;
      mesh.add(pin);
    } else {
      // 3D Flashbang Canister Mesh (Silver cylinder with blue stripe)
      const geo = new THREE.CylinderGeometry(0.06, 0.06, 0.18, 10);
      const mat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
      mesh = new THREE.Mesh(geo, mat);

      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.04, 10), new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
      mesh.add(stripe);
    }

    mesh.position.copy(startPos);
    mesh.castShadow = true;
    this.scene.add(mesh);

    const projectile = {
      id: projId,
      type: type,
      mesh: mesh,
      velocity: velocity.clone(),
      life: type === 'frag' ? 2.5 : 2.0, // fuse duration
      isLocal: isLocal,
      bounces: 0,
      onDetonate: onDetonate
    };

    this.projectiles.push(projectile);
    return projectile;
  }

  // Detonate Frag Grenade (Fireball, debris, sound)
  detonateFrag(pos, isLocal = true) {
    const dist = this.camera.position.distanceTo(pos);
    SoundEffects.playExplosion(dist);

    // Dynamic explosion point light
    const blastLight = new THREE.PointLight(0xff7700, 8.0, 22, 1.5);
    blastLight.position.copy(pos);
    this.scene.add(blastLight);

    // Glowing expanding fireball core
    const fireGeo = new THREE.SphereGeometry(0.6, 12, 10);
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 1.0 });
    const fireball = new THREE.Mesh(fireGeo, fireMat);
    fireball.position.copy(pos);
    this.scene.add(fireball);

    // 25 Debris / Spark particles
    const particles = [];
    const pMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
    for (let i = 0; i < 24; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), pMat);
      p.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 18,
        Math.random() * 12 + 2,
        (Math.random() - 0.5) * 18
      );
      this.scene.add(p);
      particles.push({ mesh: p, vel, life: 1.0 });
    }

    this.explosionEffects.push({
      light: blastLight,
      fireball: fireball,
      particles: particles,
      time: 0,
      duration: 0.8
    });
  }

  // Detonate Flashbang (Blinding flash light & tinnitus)
  detonateFlash(pos) {
    const dist = this.camera.position.distanceTo(pos);

    // Blinding white flash light in scene
    const flashLight = new THREE.PointLight(0xffffff, 15.0, 35);
    flashLight.position.copy(pos);
    this.scene.add(flashLight);
    setTimeout(() => {
      this.scene.remove(flashLight);
      flashLight.dispose();
    }, 150);

    // Check if local player was blinded
    if (dist < 22) {
      // Calculate angle between player camera look vector and flash position
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);

      const toFlash = new THREE.Vector3().subVectors(pos, this.camera.position).normalize();
      const dot = camDir.dot(toFlash);

      // If looking toward flash (dot > 0.2) or very close (dist < 6), trigger blindness
      if (dot > 0.2 || dist < 6) {
        SoundEffects.playFlashbang();
        const intensity = Math.max(0.4, 1.0 - (dist / 22));
        this.triggerFlashbangOverlay(intensity);
      }
    }
  }

  triggerFlashbangOverlay(intensity) {
    const overlay = document.getElementById('flashbang-overlay');
    if (!overlay) return;

    overlay.style.transition = 'none';
    overlay.style.opacity = `${intensity}`;

    setTimeout(() => {
      overlay.style.transition = 'opacity 3.5s cubic-bezier(0.2, 0.8, 0.3, 1)';
      overlay.style.opacity = '0';
    }, 100);
  }

  update(delta) {
    // 1. Update active flying projectiles
    const gravity = 22.0;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= delta;

      // Apply gravity
      p.velocity.y -= gravity * delta;

      // Position update
      const prevPos = p.mesh.position.clone();
      p.mesh.position.addScaledVector(p.velocity, delta);

      // Tumble / rotate projectile in flight
      p.mesh.rotation.x += delta * 10;
      p.mesh.rotation.z += delta * 7;

      // AABB Collision with arena map
      const rad = 0.15;
      const testBox = new THREE.Box3(
        new THREE.Vector3(p.mesh.position.x - rad, p.mesh.position.y - rad, p.mesh.position.z - rad),
        new THREE.Vector3(p.mesh.position.x + rad, p.mesh.position.y + rad, p.mesh.position.z + rad)
      );

      // Floor bounce check
      if (p.mesh.position.y <= 0.1) {
        p.mesh.position.y = 0.1;
        p.velocity.y = -p.velocity.y * 0.45;
        p.velocity.x *= 0.7;
        p.velocity.z *= 0.7;
        p.bounces++;
        if (Math.abs(p.velocity.y) > 1.0) SoundEffects.playGrenadeBounce();
      } else if (this.arenaMap.testCollision(testBox)) {
        // Obstacle bounce: revert to prev and reflect
        p.mesh.position.copy(prevPos);
        p.velocity.x = -p.velocity.x * 0.5;
        p.velocity.z = -p.velocity.z * 0.5;
        p.bounces++;
        SoundEffects.playGrenadeBounce();
      }

      // Detonation time expired
      if (p.life <= 0) {
        const detonatePos = p.mesh.position.clone();

        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
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
      eff.time += delta;
      const progress = eff.time / eff.duration;

      // Expand fireball and fade
      eff.fireball.scale.addScalar(delta * 14);
      eff.fireball.material.opacity = Math.max(0, 1 - progress);
      eff.light.intensity = Math.max(0, 8 * (1 - progress));

      // Update explosion debris
      for (const pt of eff.particles) {
        pt.vel.y -= 25 * delta;
        pt.mesh.position.addScaledVector(pt.vel, delta);
        pt.life -= delta * 1.5;
        pt.mesh.scale.multiplyScalar(0.96);
      }

      if (progress >= 1.0) {
        this.scene.remove(eff.fireball);
        eff.fireball.geometry.dispose();
        eff.fireball.material.dispose();

        this.scene.remove(eff.light);
        eff.light.dispose();

        for (const pt of eff.particles) {
          this.scene.remove(pt.mesh);
          pt.mesh.geometry.dispose();
          pt.mesh.material.dispose();
        }

        this.explosionEffects.splice(i, 1);
      }
    }
  }

  clear() {
    this.projectiles.forEach(p => {
      this.scene.remove(p.mesh);
      if (p.mesh.geometry) p.mesh.geometry.dispose();
    });
    this.projectiles = [];
  }
}
