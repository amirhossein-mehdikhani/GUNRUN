import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { disposeTrees, sharedModelResources } from '../public/js/resources.js';
import { TriangleIndex, collectTriangles } from '../public/js/spatial-index.js';
import { validatePacket, cleanSettings } from '../server/validation.js';
import { safeAssetPath } from '../server/assets.js';
import path from 'node:path';

test('nested owned resources are disposed once and cached model data stays alive', () => {
  const geometry=new THREE.BoxGeometry(), texture=new THREE.Texture(), material=new THREE.MeshBasicMaterial({map:texture});
  const root=new THREE.Group(); root.add(new THREE.Mesh(geometry,material),new THREE.Mesh(geometry,material));
  const count={geometry:0,texture:0,material:0};
  for(const [key,value] of Object.entries({geometry,texture,material})) value.addEventListener('dispose',()=>count[key]++);
  disposeTrees([root]); assert.deepEqual(count,{geometry:1,texture:1,material:1});
  const original=new THREE.Mesh(geometry,material), borrowed=sharedModelResources(original);
  const clone=new THREE.Mesh(geometry,material.clone()); disposeTrees([clone],borrowed);
  assert.deepEqual(count,{geometry:1,texture:1,material:1});
});
test('BVH agrees with double-sided brute force rays over spatially separated triangles', () => {
  const coordinates=[];
  for(let i=1;i<=100;i++) coordinates.push(-1,-1,i,1,-1,i,0,1,i);
  const index=new TriangleIndex(new Float32Array(coordinates));
  assert.equal(index.raycast({x:0,y:0,z:0},{x:0,y:0,z:1},100),1);
  assert.equal(index.raycast({x:0,y:0,z:101},{x:0,y:0,z:-1},100),1);
  assert.equal(index.raycast({x:4,y:0,z:0},{x:0,y:0,z:1},100),null);
  assert.equal(index.raycast({x:0,y:0,z:0},{x:0,y:0,z:1},.5),null);
});
test('octree candidates use unique identity across overlapping leaves', () => {
  const tri={}, box={};
  const tree={box,triangles:[],subTrees:[{box,triangles:[tri],subTrees:[]},{box,triangles:[tri],subTrees:[]}]};
  const out=[]; collectTriangles(tree,()=>true,out,new Set()); assert.equal(out.length,1);
});
test('malformed settings, names, colors and packet shapes cannot reach handlers unvalidated', () => {
  const packet=['create-room',{playerName:[],playerColor:'red;bad',roomName:'<b>Room</b>',characterType:'unknown',settings:{scoreLimit:'NaN',mapId:'missing'}}];
  assert.equal(validatePacket(packet),true); assert.equal(packet[1].playerName,'Player');
  assert.equal(packet[1].playerColor,'#3b82f6'); assert.ok(!packet[1].roomName.includes('<'));
  assert.deepEqual(packet[1].settings,{});
  assert.equal(validatePacket(['join-room',null]),false);
  assert.equal(validatePacket(['weapon-switch',{slot:42}]),false);
  assert.deepEqual(cleanSettings({scoreLimit:'25',gravity:'low',gameMode:'tdm',mapId:'italy'}),{scoreLimit:25,gravity:'low',gameMode:'tdm',mapId:'italy'});
});
test('asset path containment rejects traversal, bad encodings and Windows separators', () => {
  const root=path.resolve('public');
  for(const url of ['/%2e%2e/server.js','/..%5cserver.js','/%00','/%ZZ']) assert.equal(safeAssetPath(root,url),null);
  assert.equal(safeAssetPath(root,'/js/game.js'),path.join(root,'js','game.js'));
});
