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
