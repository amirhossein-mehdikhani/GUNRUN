import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import { ArenaMap } from '../public/js/map.js';
import { RemotePlayer } from '../public/js/character.js';

class TestMap extends ArenaMap { loadMap() {} }

test('reused floor query clears previous candidates and accepts reversed winding', () => {
  const map = new TestMap(new THREE.Scene());
  map.octree = new Octree();
  map.octree.addTriangle(new THREE.Triangle(
    new THREE.Vector3(-10, 0, -10), new THREE.Vector3(10, 0, -10), new THREE.Vector3(0, 0, 10)
  ));
  map.octree.build();
  assert.equal(map.getFloorHeight(new THREE.Vector3(0, 1.6, 0), null, 0.28, 0), 0);
  assert.equal(map.getFloorHeight(new THREE.Vector3(50, 1.6, 50), null, 0.28, 0), null);
  assert.equal(map.getFloorHeight(new THREE.Vector3(0, 1.6, 0), null, 0.28, 0), 0);
});

test('horizontal scratch state preserves wall collision across repeated queries', () => {
  const map = new TestMap(new THREE.Scene());
  map.perimeterBounds = null;
  map.octree = new Octree();
  map.octree.addTriangle(new THREE.Triangle(
    new THREE.Vector3(1, -5, -10), new THREE.Vector3(1, 10, -10), new THREE.Vector3(1, 0, 10)
  ));
  map.octree.build();
  for (let i = 0; i < 5; i++) {
    const result = map.moveAndCollideHorizontal(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(2, 0, 0));
    assert.ok(result.x <= 0.721, `wall crossed: ${result.x}`);
    assert.ok(result.x >= 0.6);
  }
});

function remote(yaw = 0) {
  return Object.assign(Object.create(RemotePlayer.prototype), { group: new THREE.Group() });
}

test('remote rotation crosses the angle seam by the short path', () => {
  const player = remote();
  player.group.rotation.y = Math.PI - 0.01;
  player.setTransform({ x: 0, y: 0, z: 0 }, { yaw: -Math.PI + 0.01 }, false, false);
  player.update(1 / 60);
  assert.ok(Math.abs(player.group.rotation.y - (Math.PI - 0.01)) < 0.02);
});

test('smoothing converges equally at 30 and 144 FPS and copies packet positions', () => {
  const packet = { x: 10, y: 2, z: 4 };
  const positions = [30, 144].map(fps => {
    const player = remote();
    player.setTransform(packet, { yaw: 1 }, false, false);
    for (let i = 0; i < fps; i++) player.update(1 / fps);
    return player.group.position.x;
  });
  assert.ok(Math.abs(positions[0] - positions[1]) < 1e-10);
  const player = remote();
  player.setTransform(packet, { yaw: 0 }, false, false);
  packet.x = 999;
  assert.equal(player.targetPos.x, 10);
});
