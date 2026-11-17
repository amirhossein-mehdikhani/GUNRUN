import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import { ArenaMap } from '../public/js/map.js';
import { MovementBuffer } from '../public/js/movement-buffer.js';
import { WeaponController } from '../public/js/weapon.js';
import { SoundEffects } from '../public/js/audio.js';

test('movement interpolates through an uneven packet gap with short angular wrap', () => {
  const buffer = new MovementBuffer();
  buffer.push({x:0,y:1.6,z:0}, Math.PI - 0.01, 0);
  buffer.push({x:1,y:1,z:0}, -Math.PI + 0.01, 100, true);
  const out = {};
  buffer.sample(125, out);
  assert.equal(out.x, 0.5);
  assert.ok(Math.abs(out.yaw - Math.PI) < 1e-10);
  assert.equal(out.heightScale, 0.8125);
  // Eye height and model height move together, keeping feet at ground level.
  assert.ok(Math.abs(out.y - 1.6 * out.heightScale) < 1e-10);
});

test('prediction stops after 50ms and teleports clear stale movement', () => {
  const buffer = new MovementBuffer();
  buffer.push({x:0,y:0,z:0}, 0, 0);
  buffer.push({x:1,y:0,z:0}, 0, 100);
  const out = {};
  buffer.sample(10000, out);
  assert.equal(out.x, 1.5);
  buffer.push({x:100,y:0,z:0}, 1, 10001);
  buffer.sample(10002, out);
  assert.equal(out.x, 100);
  assert.equal(buffer.samples.length, 1);
});

test('cannot stand under a low ceiling but can stand in clear space', () => {
  class TestMap extends ArenaMap { loadMap() {} }
  const map = new TestMap(new THREE.Scene());
  map.octree = new Octree();
  map.octree.addTriangle(new THREE.Triangle(new THREE.Vector3(-5,1.3,-5), new THREE.Vector3(5,1.3,-5), new THREE.Vector3(0,1.3,5)));
  map.octree.addTriangle(new THREE.Triangle(new THREE.Vector3(-5,0,-5), new THREE.Vector3(0,0,5), new THREE.Vector3(5,0,-5)));
  map.octree.build();
  assert.equal(map.canStandAt(new THREE.Vector3(0,1,0), 0), false);
  assert.equal(map.canStandAt(new THREE.Vector3(10,1,10), 0), true);
});

test('auto reload starts only for empty firearms when ready', () => {
  let reloads = 0;
  const weapon = { config: {isMelee:false}, currentAmmo:0, reload(){reloads++;} };
  WeaponController.prototype.autoReload.call(weapon);
  assert.equal(reloads, 1);
  for (const patch of [{isReloading:true}, {isSwitching:true}, {currentAmmo:1}, {config:{isMelee:true}}]) {
    WeaponController.prototype.autoReload.call({...weapon, ...patch});
  }
  assert.equal(reloads, 1);
});

test('reload fills its magazine, and a cancelled callback cannot refill another gun', t => {
  const callbacks = [];
  t.mock.method(SoundEffects, 'playReload', () => {});
  const priorRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = cb => callbacks.push(cb);
  t.after(() => { if (priorRaf) globalThis.requestAnimationFrame = priorRaf; else delete globalThis.requestAnimationFrame; });
  let now = 0;
  t.mock.method(performance, 'now', () => now);
  const weapon = Object.assign(Object.create(WeaponController.prototype), {
    currentSlot:1, ammoState:{1:0,2:0,3:0,4:Infinity}, rootGroup:new THREE.Group()
  });
  weapon.reload();
  assert.equal(weapon.isReloading, true);
  now = 2000;
  callbacks.shift()();
  assert.equal(weapon.currentAmmo, 30);
  assert.equal(weapon.isReloading, false);
  weapon.currentAmmo = 0;
  weapon.reload();
  weapon.currentSlot = 2;
  weapon.isReloading = false;
  now = 4000;
  callbacks.shift()();
  assert.equal(weapon.currentAmmo, 0);
  weapon.reload();
  weapon.resetAmmo();
  assert.deepEqual(weapon.ammoState, {1:30, 2:12, 4:999});
  assert.equal(weapon.isReloading, false);
  assert.equal(weapon.currentSlot, 2);
  // A pending reload from before respawn must not overwrite the new life's ammo.
  weapon.currentAmmo = 7;
  now = 6000;
  callbacks.shift()();
  assert.equal(weapon.currentAmmo, 7);
});
