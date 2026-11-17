import {ArenaMap} from '../public/js/map.js';
import {Octree} from 'three/addons/math/Octree.js';
// Convert the user's locally downloaded FBX into a game-ready map. Do not publish the source asset.
import fs from 'node:fs';import {createHash} from 'node:crypto';
import * as THREE from 'three';import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';import {mergeVertices,mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';import {MeshoptSimplifier} from 'meshoptimizer';import {worldTriangles} from '../public/js/killhouse.js';import {TriangleIndex} from '../public/js/spatial-index.js';
globalThis.window={innerWidth:960,innerHeight:640};globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
await MeshoptSimplifier.ready;const bytes=fs.readFileSync(process.argv[2]||'killhouse.fbx');const source=new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');source.updateMatrixWorld(true);
const buckets=new Map(),collisionMeshes=[];let inputTriangles=0,outputTriangles=0;
source.traverse(mesh=>{if(!mesh.isMesh)return;let g=mesh.geometry.clone();g.applyMatrix4(mesh.matrixWorld);for(const key of Object.keys(g.attributes))if(key!=='position')g.deleteAttribute(key);g.clearGroups();g=mergeVertices(g,.0001);
  const indices=new Uint32Array(g.index.array),tris=indices.length/3;inputTriangles+=tris;
  const proxy=tris>500?(()=>{g.computeBoundingBox();const size=g.boundingBox.getSize(new THREE.Vector3()),center=g.boundingBox.getCenter(new THREE.Vector3());return new THREE.BoxGeometry(size.x,size.y,size.z).translate(center.x,center.y,center.z);})():g.clone();
  collisionMeshes.push(new THREE.Mesh(proxy,new THREE.MeshBasicMaterial()));
  if(tris>500){const ratio=tris>10000?.025:.2;const [simplified]=MeshoptSimplifier.simplify(indices,g.attributes.position.array,3,Math.max(96,Math.floor(indices.length*ratio/3)*3),.008,['LockBorder']);g.setIndex(new THREE.BufferAttribute(simplified,1));}
  // Compact the used positions so discarded high-poly vertices aren't exported.
  const [remap,count]=MeshoptSimplifier.compactMesh(new Uint32Array(g.index.array));const positions=new Float32Array(count*3),index=new Uint32Array(g.index.count);
  for(let i=0;i<remap.length;i++)if(remap[i]!==0xffffffff)positions.set(g.attributes.position.array.subarray(i*3,i*3+3),remap[i]*3);
  for(let i=0;i<index.length;i++)index[i]=remap[g.index.getX(i)];g.dispose();g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setIndex(new THREE.BufferAttribute(index,1));g.computeVertexNormals();
  let color=/crate|table|house|ladder/i.test(mesh.name)?0xb29a72:/container/i.test(mesh.name)?0x476d79:/renault/i.test(mesh.name)?0xb69d5a:/Cylinder/i.test(mesh.name)?0x8e8964:/Plane$/.test(mesh.name)?0x7d817b:0x9b8b73;
  if(!buckets.has(color))buckets.set(color,[]);buckets.get(color).push(g);outputTriangles+=index.length/3;
});
const root=new THREE.Group();for(const [color,geometries]of buckets){root.add(new THREE.Mesh(mergeGeometries(geometries),new THREE.MeshStandardMaterial({color,roughness:.9,side:THREE.DoubleSide})));geometries.forEach(g=>g.dispose());}
root.rotation.y=Math.PI/2;root.scale.setScalar(.01);root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3());root.position.set(-center.x,-box.min.y,-center.z);root.updateMatrixWorld(true);
// Bake the transforms so both browser and server use exactly the same meter coordinates.
for(const mesh of root.children){mesh.geometry.applyMatrix4(mesh.matrixWorld);mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.scale.setScalar(1);}root.position.set(0,0,0);root.rotation.set(0,0,0);root.scale.setScalar(1);root.updateMatrixWorld(true);
const collisionRoot=new THREE.Group();collisionRoot.add(...collisionMeshes);collisionRoot.rotation.y=Math.PI/2;collisionRoot.scale.setScalar(.01);collisionRoot.position.set(-center.x,-box.min.y,-center.z);collisionRoot.updateMatrixWorld(true);
const triangles=worldTriangles(collisionRoot),index=new TriangleIndex(triangles),bounds=new THREE.Box3().setFromObject(root);const spawns=[];const clearanceMap=new ArenaMap(new THREE.Scene(),{autoLoad:false});clearanceMap.octree=new Octree().fromGraphNode(collisionRoot);
for(const side of [-1,1])for(const x of [-6,-3,0,3,6]){const z=side*15;const origin={x,y:3,z},floor=index.raycast(origin,{x:0,y:-1,z:0},5);if(floor===null)throw Error('Missing spawn floor');const ground=3-floor;const overhead=index.raycast({x,y:ground+.55,z},{x:0,y:1,z:0},1.4);if(ground<.5 && overhead===null && clearanceMap.canStandAt({x,y:ground+1.6,z},ground))spawns.push({x,y:ground+1.6,z});}
const glb=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true});fs.mkdirSync('public/assets/models',{recursive:true});fs.writeFileSync('public/assets/models/Killhouse.glb',Buffer.from(glb));fs.writeFileSync('public/assets/collision/killhouse-import.bin',Buffer.from(triangles.buffer));
fs.writeFileSync('public/assets/models/killhouse-import.json',JSON.stringify({source:'https://www.cgtrader.com/items/3809927',author:'Blenderworks',license:'CGTrader Royalty Free (no AI)',sha256:createHash('sha256').update(bytes).digest('hex'),inputTriangles,outputTriangles,collisionTriangles:triangles.length/9,spawns,bounds:{min:bounds.min,max:bounds.max}},null,2));console.log({inputTriangles,outputTriangles,collisionTriangles:triangles.length/9,glbBytes:glb.byteLength,bounds:bounds.getSize(new THREE.Vector3()).toArray(),spawns});

