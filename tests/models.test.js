import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fitCharacter, fitGun, rotationClipsForRig } from '../public/js/model-utils.js';

async function load(file) {
  const bytes=await fs.readFile(`public/assets/models/${file}`);
  // Node tests exercise geometry/rigs; texture decoding is checked in the browser.
  const loader=new GLTFLoader();loader.register(()=>({name:'headless-textures',loadTexture:async()=>new THREE.Texture()}));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
test('downloaded GLBs are complete, match the pinned source hashes and contain renderable geometry', async () => {
  const manifest=JSON.parse(await fs.readFile('public/assets/models/new-assets.json','utf8'));
  assert.equal(manifest.length,9);
  for(const asset of manifest) {
    const bytes=await fs.readFile(`public/assets/models/${asset.file}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
    const gltf=await load(asset.file);
    let meshes=0;gltf.scene.traverse(node=>{if(node.isMesh)meshes++;});
    assert.ok(meshes>0,asset.file);
  }
});
test('character normalization and shared rotation clips preserve a usable humanoid rig', async () => {
  const source=await load('AnimationRig.glb');
  for(const file of ['Pathfinder.glb','Sentinel.glb','DesertRanger.glb']) {
    const gltf=await load(file);
    fitCharacter(gltf.scene);
    let box=new THREE.Box3().setFromObject(gltf.scene);
    assert.ok(Math.abs(box.min.y+1.6)<1e-5,file);
    assert.ok(Math.abs(box.max.y-.2)<1e-5,file);
    const clips=rotationClipsForRig(source.animations,gltf.scene);
    const walk=clips.find(clip=>clip.name.endsWith('|Walk'));
    assert.ok(walk?.tracks.length>0,file);
    assert.ok(walk.tracks.every(track=>track.name.endsWith('.quaternion')));
    const mixer=new THREE.AnimationMixer(gltf.scene);
    mixer.clipAction(walk).play();mixer.update(.4);
    gltf.scene.updateMatrixWorld(true);
    // Recompute skinned bounds after advancing the gait.
    gltf.scene.traverse(node=>{if(node.isSkinnedMesh)node.computeBoundingBox();});
    box=new THREE.Box3().setFromObject(gltf.scene);
    const height=box.max.y-box.min.y;
    assert.ok(Number.isFinite(height) && height>.8 && height<3,file);
    mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);
  }
});
test('downloaded guns fit FPS view bounds and all operator previews are real PNG renders', async () => {
  for(const file of ['VectorSMG.glb','SlugShotgun.glb','TacticalPistol.glb','SupportLMG.glb']) {
    const gltf=await load(file);fitGun(gltf.scene,.6);
    const size=new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
    assert.ok(Math.abs(Math.max(size.x,size.y,size.z)-.6)<1e-5,file);
  }
  for(const id of ['soldier','robot','cyborg','heavy','scout','sentinel','ranger']) {
    const image=await fs.readFile(`public/assets/images/characters/${id}.png`);
    assert.equal(image.readUInt32BE(16),480);assert.equal(image.readUInt32BE(20),400);
    assert.ok(image.length>10000,id);
  }
});

test('Cyborg and Titan normalize to player height from their actual GLBs',async()=>{
  for(const file of ['Xbot.glb','TitanMech.glb']) {
    const gltf=await load(file);fitCharacter(gltf.scene);
    const bounds=new THREE.Box3().setFromObject(gltf.scene);
    assert.ok(Math.abs(bounds.max.y-bounds.min.y-1.8)<1e-5,file);
    assert.ok(Math.abs(bounds.min.y+1.6)<1e-5,file);
    assert.ok(gltf.animations.length>0,file);
  }
});
