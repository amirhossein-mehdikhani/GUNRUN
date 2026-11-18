import test from 'node:test';
import assert from 'node:assert/strict';
import {FramePacer} from '../public/js/frame-pacing.js';

test('steady camera turns render every display refresh at 60, 120, 144 and 165 Hz', () => {
  for (const hz of [60,120,144,165]) {
    const pacer = new FramePacer();
    for(let i=0;i<hz*5;i++) assert.equal(pacer.shouldRender(i*1000/hz,{active:true}),true);
  }
});
test('early frames do not leave a stale deadline and low/background budgets remain bounded', () => {
  for(const [state,budget] of [[{active:true,low:true},60],[{active:false},30],[{hidden:true},5]]) {
    const pacer=new FramePacer(); let count=0;
    for(let i=0;i<1440;i++) if(pacer.shouldRender(i*1000/144,state)) count++;
    assert.ok(Math.abs(count-budget*10)<=1, `${count} frames for ${budget} FPS`);
  }
  const p=new FramePacer();
  assert.equal(p.shouldRender(0,{active:true,low:true}),true);
  assert.equal(p.shouldRender(16.3,{active:true,low:true}),true);
  assert.equal(p.shouldRender(20,{active:true,low:true}),false);
  assert.equal(p.shouldRender(21,{active:true}),true);
});
