import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAPHICS_PRESETS, resolveGraphics, renderPixelRatio } from '../public/js/graphics.js';

test('auto uses low on constrained hardware and balanced when capability is unknown', () => {
  assert.equal(resolveGraphics('auto', { hardwareConcurrency: 4 }), GRAPHICS_PRESETS.low);
  assert.equal(resolveGraphics('auto', { deviceMemory: 2, hardwareConcurrency: 16 }), GRAPHICS_PRESETS.low);
  assert.equal(resolveGraphics('auto'), GRAPHICS_PRESETS.balanced);
  assert.equal(resolveGraphics('high', { deviceMemory: 2 }), GRAPHICS_PRESETS.high);
});

test('resolution stays within pixel budget across desktop and high density displays', () => {
  for (const preset of Object.values(GRAPHICS_PRESETS)) {
    for (const [w, h, dpr] of [[3840, 2160, 2], [1920, 1080, 1], [800, 600, 1], [1280, 720, 1.25]]) {
      const ratio = renderPixelRatio(preset, w, h, dpr);
      assert.ok(w * h * ratio * ratio <= preset.maxPixels + 1e-6);
      assert.ok(ratio <= dpr && ratio <= preset.pixelRatio);
      assert.equal(renderPixelRatio(preset, w, h, dpr, 0.6), ratio * 0.6);
    }
  }
});
