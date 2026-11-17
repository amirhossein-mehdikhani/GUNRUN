// Keep physical collision corrections immediate while easing only the rendered eye.
export function compensateView(offset, before, after, maxDistance=3) {
  const dx=before.x-after.x,dy=before.y-after.y,dz=before.z-after.z;
  if(Math.hypot(dx,dy,dz)>maxDistance) {offset.x=offset.y=offset.z=0;return false;}
  offset.x+=dx;offset.y+=dy;offset.z+=dz;return true;
}
export function decayView(offset,delta) {
  const factor=Math.exp(-18*delta);
  for(const axis of ['x','y','z']) offset[axis]=Math.abs(offset[axis])<.0001?0:offset[axis]*factor;
}
export function physicsSteps(delta) {return Math.max(1,Math.ceil(Math.min(delta,.1)/(1/60)));}
