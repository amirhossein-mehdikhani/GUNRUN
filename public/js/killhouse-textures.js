import * as THREE from 'three';
// Small deterministic textures, shared per material batch and freed with the map.
export function textureKillhouse(root) {
  root.traverse(mesh=>{
    if(!mesh.isMesh || !mesh.material?.color)return;
    const hex=mesh.material.color.getHex();
    const wood=hex===0xb29a72, metal=hex===0x476d79 || hex===0xb69d5a;
    const size=256,data=new Uint8Array(size*size*4);
    let seed=37;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      let v=218+(seed%27);
      v-=14*(1+Math.sin(x*.049)*Math.cos(y*.025)); // broad weathering patches
      v-=10*Math.pow(Math.sin(y*.0123),2);
      if(wood){v-=Math.sin(x*.7+Math.sin(y*.07)*2)*12;if(x%32<2)v-=65;}
      else if(metal){if(x%32<3)v-=48;if((x%32===6 || x%32===26)&&y%32===6)v-=85;}
      else {v-=seed%19;if(y%32<2 || (x+(Math.floor(y/32)%2)*32)%64<2)v-=38; if((x*17+y*31)%197<3)v-=28;}
      const i=(y*size+x)*4;data[i]=Math.max(0,Math.min(255,v+(wood?9:3)));data[i+1]=Math.max(0,Math.min(255,v));data[i+2]=Math.max(0,Math.min(255,v-(wood?12:5)));data[i+3]=255;
    }
    const texture=new THREE.DataTexture(data,size,size);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
    // Box-project each triangle independently to prevent UV stretching at corners.
    const old=mesh.geometry,g=old.toNonIndexed(),pos=g.attributes.position,uv=new Float32Array(pos.count*2);
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3();
    for(let i=0;i<pos.count;i+=3){a.fromBufferAttribute(pos,i);b.fromBufferAttribute(pos,i+1);c.fromBufferAttribute(pos,i+2);normal.subVectors(b,a).cross(c.sub(a));const nx=Math.abs(normal.x),ny=Math.abs(normal.y),nz=Math.abs(normal.z);
      for(let j=i;j<i+3;j++){const x=pos.getX(j),y=pos.getY(j),z=pos.getZ(j);uv[j*2]=(ny>nx&&ny>nz?x:nx>nz?z:x)/2;uv[j*2+1]=(ny>nx&&ny>nz?z:y)/2;}}
    // Vertex color gradients add depth without extra textures, lights or draw calls.
    g.computeBoundingBox();const min=g.boundingBox.min.y,height=Math.max(1,g.boundingBox.max.y-min),colors=new Float32Array(pos.count*3);
    for(let i=0;i<pos.count;i++){const elevation=(pos.getY(i)-min)/height;const shade=.68+.32*Math.min(1,elevation*3);colors[i*3]=shade;colors[i*3+1]=shade*(.96+.04*elevation);colors[i*3+2]=shade*(.9+.1*elevation);}
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));mesh.material.vertexColors=true;
    g.setAttribute('uv',new THREE.BufferAttribute(uv,2));mesh.geometry=g;old.dispose();mesh.material.map=texture;mesh.material.roughness=metal?.72:.95;mesh.material.needsUpdate=true;
  });
}
