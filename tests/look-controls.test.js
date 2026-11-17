import test from 'node:test';import assert from 'node:assert/strict';import {LookInput,StablePointerLockControls} from '../public/js/look-controls.js';import {PerspectiveCamera,Quaternion} from 'three';
test('mouse warp packets are rejected on capture and during ordinary look motion',()=>{
 const input=new LookInput();assert.equal(input.sample(1200,-600,0),null);assert.deepEqual(input.sample(6,-4,10),{x:6,y:-4});assert.equal(input.sample(1700,0,12),null);assert.equal(input.sample(NaN,0,20),null);assert.equal(input.spikes,3);
});
test('normal fast flicks remain responsive and looking through the yaw seam never flips the camera',()=>{
 const input=new LookInput();input.sample(1,0,0);assert.deepEqual(input.sample(240,100,15),{x:240,y:100});
 const doc={addEventListener(){},removeEventListener(){},defaultView:{innerWidth:1920,innerHeight:1080}},element={ownerDocument:doc};const camera=new PerspectiveCamera(),controls=new StablePointerLockControls(camera,element);doc.pointerLockElement=element;controls.onLock();
 let previous=new Quaternion().copy(camera.quaternion);for(let i=0;i<200;i++){controls.onMove({movementX:10,movementY:0,timeStamp:i*8});assert.ok(previous.angleTo(camera.quaternion)<.021);previous.copy(camera.quaternion);}
 const before=camera.quaternion.clone();controls.onMove({movementX:3000,movementY:1000,timeStamp:1601});assert.ok(before.equals(camera.quaternion));controls.dispose();
});
