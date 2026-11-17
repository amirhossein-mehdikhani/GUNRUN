// Dispose owned GPU resources once, while retaining cached GLTF geometry/textures.
export function disposeTrees(roots, borrowed = new Set()) {
  const disposed = new Set();
  const dispose = resource => {
    if (!resource || borrowed.has(resource) || disposed.has(resource)) return;
    disposed.add(resource);
    resource.dispose?.();
  };
  for (const root of roots) {
    root.traverse(node => {
      dispose(node.geometry);
      for (const material of node.material ? [].concat(node.material) : []) {
        if (borrowed.has(material)) continue;
        for (const value of Object.values(material)) if (value?.isTexture) dispose(value);
        dispose(material);
      }
      if (node.isLight) node.shadow?.dispose();
      if (node.isSkinnedMesh) dispose(node.skeleton);
    });
    root.removeFromParent();
  }
}

export function sharedModelResources(root) {
  const resources = new Set();
  root.traverse(node => {
    if (node.geometry) resources.add(node.geometry);
    for (const material of node.material ? [].concat(node.material) : []) {
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
    }
  });
  return resources;
}
