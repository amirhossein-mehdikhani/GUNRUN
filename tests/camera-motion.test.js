import test from 'node:test';
import assert from 'node:assert/strict';
import {compensateView,decayView,physicsSteps} from '../public/js/camera-motion.js';
test('small camera corrections preserve the displayed eye and large teleports snap',()=>{
  const before={x:2,y:1.6,z:0},after={x:2,y:1.9,z:0},offset={x:0,y:0,z:0};
  assert.equal(compensateView(offset,before,after),true);assert.equal(after.y+offset.y,before.y);
  decayView(offset,.1);assert.ok(offset.y<0 && offset.y>-.3);
  assert.equal(compensateView(offset,before,{x:20,y:1.6,z:0}),false);assert.deepEqual(offset,{x:0,y:0,z:0});
});
test('camera smoothing converges equally at 30 and 144 FPS and physics steps stay bounded',()=>{
  const a={x:0,y:.5,z:0},b={...a};for(let i=0;i<30;i++)decayView(a,1/30);for(let i=0;i<144;i++)decayView(b,1/144);
  assert.ok(Math.abs(a.y-b.y)<.0001);for(const dt of [1/144,1/30,.1]) assert.ok(dt/physicsSteps(dt)<=1/60+.000001);
});
import {GameApp} from '../public/js/game.js';
import {Vector3,PerspectiveCamera} from 'three';
function physicsActor(floor) {
  const actor=Object.create(GameApp.prototype);
  Object.assign(actor,{controls:{isLocked:true},isAlive:true,playerHeight:1.6,isGrounded:true,isCrouching:false,moveInput:{crouch:false},viewOffset:new Vector3(),cameraCorrections:{steps:0},
    camera:new PerspectiveCamera(),playerVelocity:new Vector3(),_mapSnapDone:true,_moveVector:new Vector3(),_forward:new Vector3(),_right:new Vector3(),_up:new Vector3(0,1,0),_displacement:new Vector3(),
    moveSpeed:8,sprintMultiplier:1.45,gravity:24,jumpForce:9.5,jumpRequestTimer:0,screenShakeTime:0,weapon:{config:{speedMultiplier:1},update(){},currentSlot:1,currentAmmo:30},_lastAmmoKey:'1:30:undefined',socket:{connected:false},
    arenaMap:{isMapReady:true,moveAndCollideHorizontal:p=>p,checkJumpPad:()=>null,getFloorHeight:()=>floor,isOutOfPlayableBounds:()=>false,hasFloorBelow:()=>true,checkCeilingCollision:()=>null}});
  actor.camera.position.set(0,1.6,0);return actor;
}
test('actual stair physics keeps the rendered eye continuous while moving collision body onto step',()=>{
  const a=physicsActor(.3);a.updatePhysics(1/60);
  assert.ok(Math.abs(a.camera.position.y-1.9)<1e-10);assert.ok(Math.abs(a.camera.position.y+a.viewOffset.y-1.6)<1e-10);
  assert.equal(a.cameraCorrections.steps,1);
});
test('ordinary jump momentum is preserved without stair smoothing',()=>{
  const a=physicsActor(0);a.isGrounded=false;a.playerVelocity.y=9.5;a.updatePhysics(1/60);
  assert.ok(a.camera.position.y>1.6);assert.ok(a.playerVelocity.y>0);assert.equal(a.viewOffset.y,0);
});

