import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {EXTRA_ARENAS} from './arena-catalog.js';

function surfaceTexture(type) {
  const size = 512;
  const data = new Uint8Array(size * size * 4);
  let seed = 41;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const grain = (seed >>> 24) / 255;
      const weather = Math.sin(x * .049 + y * .024) * Math.sin(y * .037);
      let shade = 215 + grain * 29 + weather * 12;
      if (type === 'steel') {
        shade += Math.cos(x * Math.PI / 16) * 19;
        if (y % 128 < 3) shade -= 30;
      } else if (type === 'stone') {
        const seam = y % 64 < 3 || (x + (Math.floor(y / 64) % 2) * 64) % 128 < 3;
        if (seam) shade -= 49;
        shade += Math.sin(x*.13) * 4;
      } else if (type === 'deck') {
        if (x % 128 < 3 || y % 128 < 3) shade -= 32;
        if (grain < .025) shade -= 37;
      }
      const i = (y * size + x) * 4;
      data[i] = data[i+1] = data[i+2] = Math.max(0, Math.min(255, shade));
      data[i+3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function createExtraArena(id, textured = true) {
  const {width, depth, ground, wall, cover} = EXTRA_ARENAS[id];
  const root = new THREE.Group();
  const buckets = new Map();
  const box = (x,y,z,w,h,d,color,type='deck') => {
    const geometry = new THREE.BoxGeometry(w,h,d).translate(x,y,z);
    const {position,normal,uv} = geometry.attributes;
    for (let i=0;i<position.count;i++) {
      const top = Math.abs(normal.getY(i)) > .5;
      const side = Math.abs(normal.getX(i)) > .5;
      uv.setXY(i, (side ? position.getZ(i) : position.getX(i))/3,
        (top ? position.getZ(i) : position.getY(i))/3);
    }
    const key = type + ':' + color;
    if (!buckets.has(key)) buckets.set(key, {color,type,geometries:[]});
    buckets.get(key).geometries.push(geometry);
  };

  box(0,-.25,0,width,.5,depth,ground);
  for (const sign of [-1,1]) {
    box(sign*(width/2-.25),3.5,0,.5,7,depth,wall,'stone');
    box(0,3.5,sign*(depth/2-.25),width,7,.5,wall,'stone');
  }
  if (id === 'switchyard') {
    for (const x of [-16,0,16]) {
      for (const offset of [-.8,.8]) box(x+offset,.025,0,.09,.05,depth-2,0x3d464d,'steel');
      for (const z of [-28,-11,11,28]) {
        const shift = (z > 0 ? 1 : -1) * (x === 0 ? -4 : 3);
        box(x+shift,1.45,z,3.4,2.9,9,cover,'steel');
        box(x+shift+2.7,.65,z+3.5,1.5,1.3,1.5,0x496f76,'steel');
      }
    }
  } else {
    box(0,.6,0,13,1.2,14,wall,'stone');
    for (const sign of [-1,1]) {
      for (let i=0;i<4;i++) {
        const height = (i+1)*.3;
        box(0,height/2,sign*(9.8-i*.8),5,height,.8,wall,'stone');
      }
      for (const x of [-22,22]) {
        box(x,1.35,sign*13,8,2.7,3.4,cover,'steel');
        box(x*.65,1,sign*4,2.5,2,5,wall,'stone');
      }
      box(sign*4,2.25,0,1.8,2.1,4,cover,'steel');
    }
  }

  const textures = new Map();
  for (const {color,type,geometries} of buckets.values()) {
    if (textured && !textures.has(type)) textures.set(type,surfaceTexture(type));
    const material = new THREE.MeshStandardMaterial({
      color, map: textures.get(type) || null, roughness: type === 'steel' ? .72 : .94
    });
    const mesh = new THREE.Mesh(mergeGeometries(geometries),material);
    mesh.receiveShadow = true;
    root.add(mesh);
    geometries.forEach(geometry=>geometry.dispose());
  }
  return root;
}
