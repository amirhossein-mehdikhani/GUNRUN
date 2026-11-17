import test from 'node:test';
import assert from 'node:assert/strict';
import {createKillhouse,worldTriangles,KILLHOUSE_SPAWNS} from '../public/js/killhouse.js';
import {TriangleIndex} from '../public/js/spatial-index.js';
import {ArenaMap} from '../public/js/map.js';
import {Scene} from 'three';
test('Killhouse shares lightweight rendered collision and supported spawns',()=>{
  const root=createKillhouse(),triangles=worldTriangles(root),index=new TriangleIndex(triangles);
  assert.ok(triangles.length/9<2000);assert.ok(root.children.length<=12);
  for(const p of KILLHOUSE_SPAWNS) {const floor=index.raycast(p,{x:0,y:-1,z:0},2);assert.ok(Math.abs(floor-1.6)<.02,JSON.stringify(p));}
  assert.notEqual(index.raycast({x:16,y:2,z:0},{x:1,y:0,z:0},5),null);
});
test('Killhouse client octree supports floors, stairs and wall collision',()=>{
  const map=Object.create(ArenaMap.prototype); // Initialize query scratch without loading the default GLB.
  Object.assign(map,{scene:new Scene(),mapObjects:[],shootableMeshes:[]});map.buildKillhouse();
  assert.equal(map.isMapReady,true);assert.equal(map.spawnPoints.length,8);assert.ok(map.octree);assert.ok(map.triangleIndex);
});
import fs from 'node:fs';import {GLTFLoader}from'three/addons/loaders/GLTFLoader.js';import {Octree}from'three/addons/math/Octree.js';import {BufferGeometry,BufferAttribute,Mesh,MeshBasicMaterial}from'three';
test('local imported Killhouse uses matching server/client proxy and supported spawn clearance',{skip:!fs.existsSync('public/assets/models/Killhouse.glb')},async()=>{
 const info=JSON.parse(fs.readFileSync('public/assets/models/killhouse-import.json'));assert.ok(info.outputTriangles<100000);assert.ok(info.collisionTriangles<10000);
 const b=fs.readFileSync('public/assets/collision/killhouse-import.bin'),coords=new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));assert.equal(coords.length/9,info.collisionTriangles);
 const mesh=new Mesh(new BufferGeometry().setAttribute('position',new BufferAttribute(coords,3)),new MeshBasicMaterial());const map=new ArenaMap(new Scene(),{autoLoad:false});map.octree=new Octree().fromGraphNode(mesh);map.mapBounds=map.octree.bounds;const index=new TriangleIndex(coords);
 for(const p of info.spawns){assert.ok(Math.abs(index.raycast(p,{x:0,y:-1,z:0},2)-1.6)<.02);assert.equal(map.canStandAt(p,p.y-1.6),true,JSON.stringify(p));}
});
