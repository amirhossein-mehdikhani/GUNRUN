import fs from 'node:fs/promises';
import path from 'node:path';
const pendingReads = new Map();

export function safeAssetPath(root, url) {
  let decoded;
  try { decoded = decodeURIComponent(url); } catch { return null; }
  if (decoded.includes('\0') || decoded.includes('\\') || decoded.split('/').includes('..')) return null;
  const file = path.resolve(root, '.' + (decoded.startsWith('/') ? decoded : '/' + decoded));
  const relative = path.relative(root, file);
  return relative.startsWith('..') || path.isAbsolute(relative) ? null : file;
}

export function assetHandler(root, mimeTypes, rewrite = value => value) {
  return async (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) return next();
    const file = safeAssetPath(root, rewrite(req.path === '/' ? '/index.html' : req.path));
    if (!file) return res.sendStatus(400);
    try {
      const stat = await fs.stat(file);
      if (!stat.isFile()) return next();
      const real = await fs.realpath(file);
      const realRoot = await fs.realpath(root);
      const relative = path.relative(realRoot, real);
      if (relative.startsWith('..') || path.isAbsolute(relative)) return res.sendStatus(403);
      const etag = `W/"${stat.size}-${Math.trunc(stat.mtimeMs)}"`;
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      res.setHeader('Content-Type', mimeTypes[path.extname(file)] || 'application/octet-stream');
      if (req.headers['if-none-match'] === etag) return res.status(304).end();
      if (req.method === 'HEAD') { res.setHeader('Content-Length', stat.size); return res.end(); }
      // Async buffered reads preserve pkg snapshot compatibility without blocking the event loop.
      if (!pendingReads.has(file)) {
        const pending = fs.readFile(file).finally(() => pendingReads.delete(file));
        pendingReads.set(file, pending);
      }
      const content = await pendingReads.get(file);
      res.setHeader('Content-Length', content.length);
      res.end(content);
    } catch (error) {
      if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) return next();
      next(error);
    }
  };
}
