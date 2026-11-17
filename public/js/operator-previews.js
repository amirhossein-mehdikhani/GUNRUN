import * as THREE from 'three';
import { RemotePlayer } from './character.js';
import { OPERATORS } from './operators.js';

export async function renderOperatorPreviews(onPreview) {
  // One temporary context for the entire gallery, created only when it is opened.
  const renderer = new THREE.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true });
  renderer.setSize(480,400); renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b1421);
  scene.add(new THREE.HemisphereLight(0xc7e7ff,0x4a3650,2.4));
  const key=new THREE.DirectionalLight(0xffffff,3.5);key.position.set(3,5,4);scene.add(key);
  const rim=new THREE.DirectionalLight(0x29e8d4,2);rim.position.set(-3,2,-3);scene.add(rim);
  const camera=new THREE.PerspectiveCamera(35,480/400,.01,100);
  try {
    for (const id of Object.keys(OPERATORS)) {
      const actor=new RemotePlayer(scene,{id:'preview',name:'',characterType:id,color:'#3b82f6',position:{x:0,y:1.6,z:0}});
      try {
        await actor.ready;
        actor.overheadSprite.visible=false;
        if (['robot','cyborg'].includes(id)) actor.group.rotation.y=Math.PI;
        if (actor.mixer) actor.mixer.update(.01);
        actor.group.updateMatrixWorld(true);
        const bounds=new THREE.Box3();
        actor.group.traverse(mesh=>{
          if (!mesh.isMesh || mesh.material?.visible===false) return;
          if (mesh.isSkinnedMesh) mesh.computeBoundingBox();
          else mesh.geometry.computeBoundingBox();
          bounds.union((mesh.isSkinnedMesh ? mesh.boundingBox : mesh.geometry.boundingBox).clone().applyMatrix4(mesh.matrixWorld));
        });
        const center=bounds.getCenter(new THREE.Vector3()), size=bounds.getSize(new THREE.Vector3());
        const distance=Math.max(size.y,size.x/camera.aspect)*.5/Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*1.3;
        camera.position.copy(center).add(new THREE.Vector3(0,0,1).multiplyScalar(distance));
        camera.lookAt(center);renderer.render(scene,camera);
        onPreview(id,renderer.domElement.toDataURL('image/png'));
      } finally { actor.destroy(); }
      await new Promise(resolve=>requestAnimationFrame(resolve));
    }
  } finally { renderer.dispose();renderer.forceContextLoss(); }
}

