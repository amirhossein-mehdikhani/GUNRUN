import { readFile } from 'node:fs/promises';
import { TriangleIndex } from '../public/js/spatial-index.js';

for (const name of ['dust2','stalkyard','turbine','frenzy','italy']) {
  const bytes=await readFile(`public/assets/collision/${name}.bin`);
  const data=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const accelerated=new TriangleIndex(data);
  const brute=Object.assign(Object.create(TriangleIndex.prototype),{data,root:{...accelerated.root,ids:Array.from({length:data.length/9},(_,i)=>i)}});
  let seed=42;
  const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  const {min,max}=accelerated.root;
  const rays=Array.from({length:300},()=>({origin:{x:min[0]+random()*(max[0]-min[0]),y:max[1]+1,z:min[2]+random()*(max[2]-min[2])},direction:{x:0,y:-1,z:0}}));
  const run=index=>{
    const start=performance.now();
    const hits=rays.map(ray=>index.raycast(ray.origin,ray.direction));
    return {ms:performance.now()-start,hits};
  };
  run(accelerated);run(brute);
  const fast=run(accelerated),slow=run(brute);
  for(let i=0;i<rays.length;i++) if((fast.hits[i] === null) !== (slow.hits[i] === null) || (fast.hits[i] !== null && slow.hits[i] !== null && Math.abs(fast.hits[i]-slow.hits[i])>1e-6)) throw new Error(`Hit mismatch in ${name}`);
  console.log(`${name}: BVH ${fast.ms.toFixed(2)}ms, brute force ${slow.ms.toFixed(2)}ms, ${(slow.ms/fast.ms).toFixed(1)}x faster (${rays.length} rays, equal hit distances)`);
}
