// download-assets.js
// Downloads permissive free GLTF/GLB models for RUNGUN from Three.js official examples
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = path.join(__dirname, 'public', 'assets', 'models');

const modelsToDownload = [

  {
    name: 'arena.glb',
    url: 'https://raw.githubusercontent.com/Ar9av/human-fight-rl/main/assets/arena.glb'
  },
  {
    name: 'Soldier.glb',
    url: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Soldier.glb'
  },
  {
    name: 'RobotExpressive.glb',
    url: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/RobotExpressive/RobotExpressive.glb'
  },
  {
    name: 'Xbot.glb',
    url: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Xbot.glb'
  }
];

const additions = JSON.parse(fs.readFileSync(path.join(targetDir, "new-assets.json"), "utf8"));
modelsToDownload.push(...additions.map(asset=>({name:asset.file,url:asset.source,sha256:asset.sha256})));

async function downloadFile(url, destPath, expectedHash) {
  console.log(`[Asset Downloader] Downloading: ${url}`);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60 sec timeout
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error('Response is not a GLB model');
    if (expectedHash && createHash('sha256').update(buffer).digest('hex') !== expectedHash) throw new Error('Asset checksum mismatch');
    fs.writeFileSync(destPath, buffer);
    console.log(`[Asset Downloader] Successfully saved ${path.basename(destPath)} (${(buffer.length / 1024).toFixed(1)} KB)`);
    return true;
  } catch (err) {
    console.warn(`[Asset Downloader] Notice: Could not download ${path.basename(destPath)}: ${err.message}`);
    console.warn(`[Asset Downloader] RUNGUN includes high-detail procedural 3D character & weapon fallbacks, so gameplay is 100% playable even offline!`);
    return false;
  }
}

async function main() {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log('[Asset Downloader] Checking & downloading 3D assets...');
  let successCount = 0;
  for (const model of modelsToDownload) {
    const dest = path.join(targetDir, model.name);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000 && (!model.sha256 || createHash('sha256').update(fs.readFileSync(dest)).digest('hex') === model.sha256)) {
      console.log(`[Asset Downloader] ${model.name} already exists. Skipping.`);
      successCount++;
    } else {
      const ok = await downloadFile(model.url, dest, model.sha256);
      if (ok) successCount++;
    }
  }

  console.log(`[Asset Downloader] Done. ${successCount}/${modelsToDownload.length} models ready in public/assets/models/`);
}

main();
