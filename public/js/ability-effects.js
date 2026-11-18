import * as THREE from 'three';
export class AbilityEffects {
  constructor(scene,overlay=null){this.scene=scene;this.overlay=overlay;this.effects=[];this.ring=new THREE.RingGeometry(.94,1,40);this.sphere=new THREE.SphereGeometry(.7,16,10);}
  play(type,position,{local=false,duration=0,follow=null}={}){
    const shield=type==='sentinel'||type==='heavy',heal=type==='ranger';const color=heal?0x4dff9b:shield?0x53cfff:0x65ffc5;
    const life=shield?duration:heal?1.4:1.1,group=new THREE.Group();group.position.copy(position);group.position.y-=1.55;
    const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:shield?.15:.7,depthWrite:false,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(shield?this.sphere:this.ring,mat);
    if(shield){mesh.position.y=.9;mesh.scale.y=1.6;}else{mesh.rotation.x=-Math.PI/2;mesh.position.y=.06;}group.add(mesh);
    let points=null;
    if(heal){const count=Math.max(6,Math.ceil(20*(this.effectScale??1))),positions=new Float32Array(count*3);for(let i=0;i<count;i++){positions[i*3]=Math.cos(i*2.4)*.5;positions[i*3+1]=(i/count)*1.5;positions[i*3+2]=Math.sin(i*2.4)*.5;}
      points=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(positions,3)),new THREE.PointsMaterial({color,size:.12,transparent:true,depthWrite:false}));group.add(points);
    }
    this.scene.add(group);this.effects.push({group,mesh,mat,points,time:0,life,shield,heal,follow});
    if(local&&this.overlay){this.overlay.className='ability-screen-fx '+(shield?'ability-shield':heal?'ability-heal':'ability-recon');this.overlay.dataset.label=shield?'ARMOR ACTIVE':heal?'+ FIELD DRESSING':'RECON PULSE';this.overlayUntil=performance.now()+life*1000;}
    if(this.effects.length>32)this.remove(0);
  }
  remove(i){const e=this.effects.splice(i,1)[0];this.scene.remove(e.group);e.mat.dispose();if(e.points){e.points.geometry.dispose();e.points.material.dispose();}}
  update(delta){for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.time+=delta;const p=e.time/e.life;
    if(e.follow){e.group.position.copy(e.follow());e.group.position.y-=1.55;}
    if(e.shield){e.mat.opacity=(.12+.04*Math.sin(e.time*8))*Math.min(1,(e.life-e.time)*3);e.mesh.rotation.y+=delta*.7;}
    else{e.mesh.scale.setScalar(e.heal?1+p:1+p*99);e.mat.opacity=(1-p)*.7;}
    if(e.points){e.points.position.y=e.time*.7;e.points.rotation.y=e.time;e.points.material.opacity=1-p;}
    if(p>=1)this.remove(i);
  }if(this.overlay&&performance.now()>this.overlayUntil){this.overlay.className='ability-screen-fx';this.overlay.dataset.label='';}}
  clear(){while(this.effects.length)this.remove(0);if(this.overlay){this.overlay.className='ability-screen-fx';this.overlay.dataset.label='';}}
}
