import test from 'node:test';import assert from 'node:assert/strict';import {Scene,Vector3} from 'three';import {AbilityEffects} from '../public/js/ability-effects.js';
test('ability effects use bounded scene geometry and release transient resources on expiry',()=>{
  const scene=new Scene(),overlay={className:'',dataset:{}},fx=new AbilityEffects(scene,overlay);fx.effectScale=.25;
  for(const type of ['scout','ranger','sentinel','heavy'])fx.play(type,new Vector3(0,1.6,0),{local:true,duration:3});
  assert.equal(fx.effects.length,4);assert.ok(overlay.className.includes('shield'));assert.ok(fx.effects.find(e=>e.heal).points.geometry.attributes.position.count<=6);
  fx.update(4);assert.equal(fx.effects.length,0);assert.equal(scene.children.length,0);fx.clear();assert.equal(overlay.className,'ability-screen-fx');
});
