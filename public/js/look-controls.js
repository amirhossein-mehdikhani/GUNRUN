import {Controls,Euler} from 'three';
// Reject non-finite/isolated warp packets, while keeping normal mouse motion unfiltered.
export class LookInput {
  constructor(){this.reset();this.spikes=0;}
  reset(){this.lastTime=0;this.mean=0;this.first=true;}
  sample(x,y,time,width=1920,height=1080){
    if(!Number.isFinite(x)||!Number.isFinite(y)) {this.spikes++;return null;}
    const magnitude=Math.hypot(x,y), dt=this.lastTime?Math.max(1,time-this.lastTime):16;
    const warp=magnitude>2048 || (this.first && magnitude>120) ||
      (magnitude>Math.max(480,Math.min(width,height)*.6) && magnitude>Math.max(32,this.mean)*16 && dt<40);
    this.lastTime=time;this.first=false;
    if(warp){this.spikes++;return null;}
    this.mean=this.mean*.8+magnitude*.2;return {x,y};
  }
}
export class StablePointerLockControls extends Controls {
  constructor(camera,element){
    super(camera,element);this.isLocked=false;this.pointerSpeed=1;this.lookInput=new LookInput();this.euler=new Euler(0,0,0,'YXZ');
    const doc=element.ownerDocument;
    this.onMove=e=>{
      if(!this.enabled||!this.isLocked)return;
      const input=this.lookInput.sample(e.movementX,e.movementY,e.timeStamp,doc.defaultView?.innerWidth,doc.defaultView?.innerHeight);if(!input)return;
      this.rotate(input.x,input.y,.002*this.pointerSpeed);
    };
    this.onLock=()=>{const locked=doc.pointerLockElement===element;if(locked===this.isLocked)return;this.isLocked=locked;this.lookInput.reset();this.dispatchEvent({type:locked?'lock':'unlock'});};
    doc.addEventListener('mousemove',this.onMove);doc.addEventListener('pointerlockchange',this.onLock);
  }
  rotate(dx, dy, sensitivity) {
    this.euler.setFromQuaternion(this.object.quaternion, 'YXZ');
    this.euler.y -= dx * sensitivity;
    this.euler.x = Math.max(-Math.PI/2+.001, Math.min(Math.PI/2-.001, this.euler.x - dy*sensitivity));
    this.object.quaternion.setFromEuler(this.euler);
    this.dispatchEvent({type:'change'});
  }
  lock(){try{const result=this.domElement.requestPointerLock({unadjustedMovement:true});result?.catch(error=>{if(error.name==='NotSupportedError')this.domElement.requestPointerLock();});}catch(error){if(error.name==='NotSupportedError'||error.name==='TypeError')this.domElement.requestPointerLock();else throw error;}}
  unlock(){this.domElement.ownerDocument.exitPointerLock();}
  dispose(){const doc=this.domElement.ownerDocument;doc.removeEventListener('mousemove',this.onMove);doc.removeEventListener('pointerlockchange',this.onLock);}
}
