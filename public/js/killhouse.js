import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
// Original lightweight recreation of the compact warehouse training-course layout.
import {KILLHOUSE_SPAWNS} from './killhouse-spawns.js';
export {KILLHOUSE_SPAWNS};
export function createKillhouse(includeRoof=true) {
  const root=new THREE.Group(), buckets=new Map();
  const box=(x,y,z,w,h,d,color)=>{
    const geo=new THREE.BoxGeometry(w,h,d);geo.translate(x,y,z);
    if(!buckets.has(color)) buckets.set(color,[]);buckets.get(color).push(geo);
  };
  const concrete=0x777c77, brick=0x9a765c, wood=0xb49a6b, steel=0x46555c, blue=0x456c7b;
  box(0,-.2,0,36,.4,52,concrete);
  box(-18,4,0,.4,8,52,brick);box(18,4,0,.4,8,52,brick);
  box(0,4,-26,36,8,.4,brick);box(0,4,26,36,8,.4,brick);
  // Warehouse columns and roof trusses, with open skylight gaps.
  for(const z of [-24,-12,0,12,24]) {
    for(const x of [-17.5,17.5]) box(x,4,z,.5,8,.5,steel);
    box(0,7.8,z,36,.35,.35,steel);
  }
  if(includeRoof) for(const x of [-12,0,12]) box(x,8.1,0,7,.15,52,steel);
  // Raised spawn platforms and walkable steps at both ends.
  for(const sign of [-1,1]) {
    box(0,.3,sign*23,14,.6,5,wood);
    for(let i=0;i<3;i++) box(0,(i+1)*.1,sign*(19.5+i*.45),5,(i+1)*.2,.45,wood);
    // Cover protects initial spawn without closing the long side lanes.
    box(-9,1,sign*18,5,2,.35,wood);box(9,1,sign*18,5,2,.35,wood);
  }
  // Central observation tower and stairs. Open rail sections preserve sight lines.
  box(0,2.85,0,4,.3,4,wood);
  for(const x of [-1.7,1.7]) for(const z of [-1.7,1.7]) box(x,1.4,z,.25,2.8,.25,steel);
  for(let i=0;i<10;i++) box(-6.75+i*.5,(i+1)*.15,0,.5,(i+1)*.3,1.5,wood);
  for(const z of [-1.9,1.9]) {box(0,3.55,z,4,.15,.15,wood);for(const x of [-1.9,1.9]) box(x,3.3,z,.15,.8,.15,wood);}
  box(1.9,3.55,0,.15,.15,4,wood);
  // Staggered plywood rooms and brick obstacles make three intersecting lanes.
  for(const sign of [-1,1]) {
    box(sign*5,1.15,sign*8,6,2.3,.2,wood);
    box(sign*8,1.15,sign*5,.2,2.3,6,wood);
    box(-sign*5,.65,sign*12,4,1.3,.4,brick);
    box(sign*12,1.2,sign*10,3,2.4,6,blue);
    // Container ribs add depth without texture downloads.
    for(let i=0;i<9;i++) box(sign*13.52,1.2,sign*10-2.6+i*.65,.05,2.2,.08,steel);
    // Sandbag lines and a stripped practice vehicle.
    for(let i=0;i<4;i++) for(let row=0;row<2;row++) box(-sign*11+(i%2)*.12,.22+row*.38,sign*6+i*.65,1.1,.38,.7,0x96916b);
    box(-sign*11,.55,sign*14,2,1.1,4,steel);box(-sign*11,1.25,sign*14,1.7,.6,2,concrete);
    for(const x of [-.9,.9]) for(const z of [-1.3,1.3]) box(-sign*11+x,.35,sign*14+z,.3,.7,.7,0x282e31);
  }
  // Painted lanes and warning stripes (geometry, no image dependencies).
  for(const x of [-15,15]) box(x,.012,0,.08,.018,46,0xe3c45d);
  for(const [color,geometries] of buckets) {
    const merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
    const mesh=new THREE.Mesh(merged,new THREE.MeshStandardMaterial({color,roughness:.9}));
    mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  }
  root.updateMatrixWorld(true);return root;
}
export function worldTriangles(root) {
  root.updateMatrixWorld(true);const values=[],point=new THREE.Vector3();
  root.traverse(mesh=>{if(!mesh.isMesh)return;const attr=mesh.geometry.attributes.position,index=mesh.geometry.index;
    for(let i=0;i<(index?.count??attr.count);i++) {point.fromBufferAttribute(attr,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);values.push(point.x,point.y,point.z);}
  });return new Float32Array(values);
}
