export const GRAPHICS_PRESETS = {
  low: { pixelRatio: 0.75, maxPixels: 960 * 540, shadows: false, particles: 0.25 },
  balanced: { pixelRatio: 1, maxPixels: 1600 * 900, shadows: false, particles: 0.5 },
  high: { pixelRatio: 1.5, maxPixels: 2560 * 1440, shadows: true, particles: 1 }
};

export function resolveGraphics(mode, hardware = {}) {
  if (GRAPHICS_PRESETS[mode]) return GRAPHICS_PRESETS[mode];
  const weak = (hardware.hardwareConcurrency > 0 && hardware.hardwareConcurrency <= 4) ||
    (hardware.deviceMemory > 0 && hardware.deviceMemory <= 4);
  return GRAPHICS_PRESETS[weak ? 'low' : 'balanced'];
}

export function renderPixelRatio(preset, width, height, deviceRatio = 1, scale = 1) {
  return Math.min(deviceRatio, preset.pixelRatio,
    Math.sqrt(preset.maxPixels / Math.max(1, width * height))) * scale;
}
