import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, Vector3 } from 'three';

const maps = {
  dust2: ['de_dust2_-_cs_map.glb', 2], stalkyard: ['stalkyard_-_half-life_multiplayer_map_-_3d.glb', 1.8],
  turbine: ['dm-turbine_-_ut_multiplayer_map.glb', 1.5], frenzy: ['half-life_-_frenzy_-_multiplayer_map.glb', 1.8],
  italy: ['counter-strike_italy_-_classic_cs_map_in_3d.glb', 0.026]
};
await mkdir('public/assets/collision', { recursive: true });
for (const [id, [file, scale]] of Object.entries(maps)) {
  const original = await readFile(`public/assets/models/${file}`);
  const jsonLength = original.readUInt32LE(12);
  const json = JSON.parse(original.subarray(20, 20 + jsonLength).toString());
  // Server collision needs geometry only, so don't decode image textures in Node.
  delete json.images; delete json.textures; delete json.materials;
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  const jsonBytes = Buffer.from(JSON.stringify(json));
  const padded = Buffer.alloc(Math.ceil(jsonBytes.length / 4) * 4, 32); jsonBytes.copy(padded);
  const binaryChunk = original.subarray(20 + jsonLength);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + padded.length + binaryChunk.length, 8);
  header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const glb = Buffer.concat([header, padded, binaryChunk]);
  const { scene } = await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
  scene.scale.setScalar(scale); scene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(scene), center = box.getCenter(new Vector3());
  const offset = new Vector3(-center.x, -box.min.y, -center.z);
  const values = [], v = new Vector3();
  scene.traverse(node => {
    if (!node.isMesh) return;
    const positions = node.geometry.attributes.position, indices = node.geometry.index;
    for (let i = 0; i < (indices?.count ?? positions.count); i++) {
      v.fromBufferAttribute(positions, indices ? indices.getX(i) : i).applyMatrix4(node.matrixWorld).add(offset);
      values.push(v.x, v.y, v.z);
    }
  });
  const data = new Float32Array(values);
  await writeFile(`public/assets/collision/${id}.bin`, Buffer.from(data.buffer));
  console.log(`${id}: ${data.length / 9} triangles`);
}
