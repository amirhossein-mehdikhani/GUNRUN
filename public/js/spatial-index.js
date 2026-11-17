// Static triangle BVH, shared by server line-of-sight and browser shooting queries.
export class TriangleIndex {
  constructor(triangles) {
    this.data = triangles;
    const build = ids => {
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (const id of ids) for (let v = 0; v < 3; v++) for (let axis = 0; axis < 3; axis++) {
        const value = triangles[id * 9 + v * 3 + axis];
        min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
      }
      if (ids.length <= 16) return { min, max, ids };
      const extent = max.map((n, i) => n - min[i]);
      const axis = extent.indexOf(Math.max(...extent));
      const center = id => triangles[id * 9 + axis] + triangles[id * 9 + 3 + axis] + triangles[id * 9 + 6 + axis];
      ids.sort((a, b) => center(a) - center(b));
      const half = ids.length >> 1;
      return { min, max, left: build(ids.slice(0, half)), right: build(ids.slice(half)) };
    };
    this.root = triangles.length ? build(Array.from({ length: triangles.length / 9 }, (_, i) => i)) : null;
  }
  raycast(origin, direction, maxDistance = Infinity) {
    let closest = maxDistance, found = false;
    const o = [origin.x, origin.y, origin.z], d = [direction.x, direction.y, direction.z];
    const visit = node => {
      let near = 0, far = closest;
      for (let axis = 0; axis < 3; axis++) {
        if (Math.abs(d[axis]) < 1e-12) {
          if (o[axis] < node.min[axis] || o[axis] > node.max[axis]) return;
        } else {
          let a = (node.min[axis] - o[axis]) / d[axis], b = (node.max[axis] - o[axis]) / d[axis];
          if (a > b) [a, b] = [b, a];
          near = Math.max(near, a); far = Math.min(far, b);
          if (near > far) return;
        }
      }
      if (!node.ids) { visit(node.left); visit(node.right); return; }
      const t = this.data;
      for (const id of node.ids) {
        const i = id * 9;
        const e1x=t[i+3]-t[i], e1y=t[i+4]-t[i+1], e1z=t[i+5]-t[i+2];
        const e2x=t[i+6]-t[i], e2y=t[i+7]-t[i+1], e2z=t[i+8]-t[i+2];
        const px=d[1]*e2z-d[2]*e2y, py=d[2]*e2x-d[0]*e2z, pz=d[0]*e2y-d[1]*e2x;
        const determinant=e1x*px+e1y*py+e1z*pz;
        if (Math.abs(determinant)<1e-10) continue;
        const inv=1/determinant, tx=o[0]-t[i], ty=o[1]-t[i+1], tz=o[2]-t[i+2];
        const u=(tx*px+ty*py+tz*pz)*inv;
        if (u<0 || u>1) continue;
        const qx=ty*e1z-tz*e1y, qy=tz*e1x-tx*e1z, qz=tx*e1y-ty*e1x;
        const v=(d[0]*qx+d[1]*qy+d[2]*qz)*inv;
        if(v<0 || u+v>1) continue;
        const distance=(e2x*qx+e2y*qy+e2z*qz)*inv;
        if(distance>=0 && distance<=closest) { closest=distance; found=true; }
      }
    };
    if (this.root) visit(this.root);
    return found ? closest : null;
  }
}

export function collectTriangles(tree, intersectsBox, output, seen) {
  seen.clear();
  const visit = node => {
    if (node.box && !intersectsBox(node.box)) return;
    for (const triangle of node.triangles) if (!seen.has(triangle)) { seen.add(triangle); output.push(triangle); }
    for (const child of node.subTrees) visit(child);
  };
  visit(tree);
}
