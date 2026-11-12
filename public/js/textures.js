// textures.js - Procedural Canvas Textures for RUNGUN (Warehouse, Space Station & Desert Outpost)
import * as THREE from 'three';

// ==========================================
// 1. WAREHOUSE TEXTURES
// ==========================================
export function createFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#111622';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = '#1b2336';
  ctx.lineWidth = 4;
  const size = 128;
  for (let x = 0; x <= 512; x += size) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += size) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#222d45';
  for (let x = 0; x < 512; x += size) {
    for (let y = 0; y < 512; y += size) {
      ctx.strokeStyle = '#182031';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 8, y + 8, size - 16, size - 16);

      ctx.beginPath();
      ctx.arc(x + 14, y + 14, 2, 0, Math.PI * 2);
      ctx.arc(x + size - 14, y + 14, 2, 0, Math.PI * 2);
      ctx.arc(x + 14, y + size - 14, 2, 0, Math.PI * 2);
      ctx.arc(x + size - 14, y + size - 14, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  return texture;
}

export function createWallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#181e2b';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = '#0f141f';
  ctx.lineWidth = 8;
  for (let y = 0; y <= 512; y += 128) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  for (let y = 0; y < 512; y += 128) {
    const shift = (y % 256 === 0) ? 0 : 128;
    for (let x = shift; x <= 512; x += 256) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 128);
      ctx.stroke();
    }
  }

  // Hazard warning chevron stripe
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 480, 512, 32);
  ctx.fillStyle = '#07090e';
  for (let x = -32; x < 544; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 512);
    ctx.lineTo(x + 16, 512);
    ctx.lineTo(x + 32, 480);
    ctx.lineTo(x + 16, 480);
    ctx.closePath();
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 2);
  return texture;
}

export function createCrateTexture(theme = 'orange') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  let baseCol = '#a16207';
  let rimCol = '#78350f';
  let accentCol = '#fbbf24';

  if (theme === 'blue') {
    baseCol = '#1e293b';
    rimCol = '#0f172a';
    accentCol = '#38bdf8';
  } else if (theme === 'desert') {
    baseCol = '#b45309';
    rimCol = '#78350f';
    accentCol = '#fde68a';
  } else if (theme === 'scifi') {
    baseCol = '#0f172a';
    rimCol = '#0284c7';
    accentCol = '#00f0ff';
  }

  ctx.fillStyle = baseCol;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = rimCol;
  ctx.lineWidth = 18;
  ctx.strokeRect(0, 0, 256, 256);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(256, 256);
  ctx.moveTo(256, 0);
  ctx.lineTo(0, 256);
  ctx.stroke();

  ctx.fillStyle = rimCol;
  ctx.fillRect(80, 80, 96, 96);

  ctx.strokeStyle = accentCol;
  ctx.lineWidth = 4;
  ctx.strokeRect(84, 84, 88, 88);

  ctx.fillStyle = accentCol;
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('R-GUN', 128, 128);

  return new THREE.CanvasTexture(canvas);
}

// ==========================================
// 2. SPACE STATION TEXTURES
// ==========================================
export function createSpaceStationFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Deep carbon black
  ctx.fillStyle = '#080c14';
  ctx.fillRect(0, 0, 512, 512);

  // Hexagonal or sleek futuristic grid
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  const size = 64;
  for (let x = 0; x <= 512; x += size) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += size) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Glowing cyan circuit traces
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 256);
  ctx.lineTo(192, 256);
  ctx.lineTo(256, 192);
  ctx.lineTo(512, 192);
  ctx.stroke();

  ctx.fillStyle = '#00f0ff';
  ctx.beginPath();
  ctx.arc(192, 256, 4, 0, Math.PI * 2);
  ctx.arc(256, 192, 4, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  return texture;
}

export function createSpaceStationWallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Titanium white/slate composite
  ctx.fillStyle = '#1e2536';
  ctx.fillRect(0, 0, 512, 512);

  // Modular airlock seam lines
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 6;
  ctx.strokeRect(16, 16, 480, 480);
  ctx.strokeRect(32, 32, 448, 224);
  ctx.strokeRect(32, 256, 448, 224);

  // Neon cyan vertical illumination strip
  ctx.fillStyle = '#00f0ff';
  ctx.fillRect(250, 40, 12, 432);

  // Status markings
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('SECTOR-7 LUNAR', 50, 80);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 2);
  return texture;
}

// ==========================================
// 3. DESERT OUTPOST TEXTURES
// ==========================================
export function createDesertFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Warm desert sand base
  ctx.fillStyle = '#bfa170';
  ctx.fillRect(0, 0, 512, 512);

  // Noise grains & sand ripples
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = Math.random() > 0.5 ? '#a88854' : '#d2b988';
    ctx.fillRect(x, y, 2, 2);
  }

  // Cracked flagstone tile seams
  ctx.strokeStyle = '#8d7041';
  ctx.lineWidth = 3;
  const size = 128;
  for (let x = 0; x <= 512; x += size) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += size) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  return texture;
}

export function createDesertWallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Sun-bleached sandstone blocks
  ctx.fillStyle = '#9a7b4f';
  ctx.fillRect(0, 0, 512, 512);

  // Large brick joints
  ctx.strokeStyle = '#6e5430';
  ctx.lineWidth = 6;
  for (let y = 0; y <= 512; y += 96) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  for (let y = 0; y < 512; y += 96) {
    const shift = (y % 192 === 0) ? 0 : 128;
    for (let x = shift; x <= 512; x += 256) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 96);
      ctx.stroke();
    }
  }

  // Desert camouflaged military stenciling
  ctx.fillStyle = 'rgba(74, 55, 30, 0.4)';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('OUTPOST SIERRA', 40, 60);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 2);
  return texture;
}
