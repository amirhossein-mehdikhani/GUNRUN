import { execFileSync } from 'node:child_process';
import { readFileSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const version = /^v(\d+)\.(\d+)\.(\d+)$/;
export function selectReleaseTag(tags, tagsAtCommit, baseVersion) {
  const stable = tags.filter(tag => version.test(tag)).sort((a, b) => {
    const av = a.slice(1).split('.').map(Number);
    const bv = b.slice(1).split('.').map(Number);
    return av[0] - bv[0] || av[1] - bv[1] || av[2] - bv[2];
  });
  const existing = stable.filter(tag => tagsAtCommit.includes(tag)).at(-1);
  if (existing) return existing; // Retrying a commit must not mint another version.
  const base = `v${baseVersion}`;
  if (!version.test(base)) throw new Error('package.json version must be major.minor.patch');
  if (!stable.length) return base;
  const latest = stable.at(-1).slice(1).split('.').map(Number);
  const candidate = base.slice(1).split('.').map(Number);
  if (candidate[0] > latest[0] || (candidate[0] === latest[0] && candidate[1] > latest[1]) ||
    (candidate[0] === latest[0] && candidate[1] === latest[1] && candidate[2] > latest[2])) return base;
  return `v${latest[0]}.${latest[1]}.${latest[2] + 1}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const ref = process.env.GITHUB_REF || '';
  const tag = ref.startsWith('refs/tags/') ? ref.slice(10) : selectReleaseTag(
    git('tag', '--list'), git('tag', '--points-at', process.env.GITHUB_SHA || 'HEAD'),
    JSON.parse(readFileSync('package.json', 'utf8')).version
  );
  if (!version.test(tag)) throw new Error('Release tags must use vMAJOR.MINOR.PATCH');
  if (!process.env.GITHUB_ENV) throw new Error('Run this script in GitHub Actions');
  appendFileSync(process.env.GITHUB_ENV, `RELEASE_TAG=${tag}\n`);
  console.log(`Selected release ${tag}`);
}
