import * as THREE from 'three';

export function rotationClipsForRig(clips, root) {
  return clips.map(clip => new THREE.AnimationClip(clip.name, clip.duration,
    clip.tracks.filter(track => track.name.endsWith('.quaternion') &&
      root.getObjectByName(track.name.slice(0,-11))).map(track => track.clone()))).filter(clip => clip.tracks.length);
}

export function fitCharacter(root, height = 1.8) {
  root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0) throw new Error('Character has no visible bounds');
  root.scale.multiplyScalar(height / size.y);
  root.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  root.position.add(new THREE.Vector3(-center.x, -1.6 - box.min.y, -center.z));
  root.updateMatrixWorld(true);
}

export function fitGun(root, length) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
  // Quaternius weapons use X as their barrel axis; FPS weapons point down -Z.
  if (size.x > size.z) root.rotation.y = Math.PI / 2;
  root.updateMatrixWorld(true);
  const turned = new THREE.Box3().setFromObject(root), dimensions = turned.getSize(new THREE.Vector3());
  root.scale.multiplyScalar(length / Math.max(dimensions.x, dimensions.y, dimensions.z));
  root.updateMatrixWorld(true);
  const normalized = new THREE.Box3().setFromObject(root), center = normalized.getCenter(new THREE.Vector3());
  root.position.sub(center);
  root.updateMatrixWorld(true);
}
