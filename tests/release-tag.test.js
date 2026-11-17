import test from 'node:test';
import assert from 'node:assert/strict';
import { selectReleaseTag } from '../scripts/release-tag.mjs';

test('starts at package version and increments the highest stable patch numerically', () => {
  assert.equal(selectReleaseTag([], [], '1.0.0'), 'v1.0.0');
  assert.equal(selectReleaseTag(['v1.0.9', 'v1.0.10', 'v2.0.0-beta.1', 'other'], [], '1.0.0'), 'v1.0.11');
});
test('retry reuses the same commit tag and explicit version bumps are respected', () => {
  assert.equal(selectReleaseTag(['v1.0.0', 'v1.0.1'], ['v1.0.0'], '1.0.0'), 'v1.0.0');
  assert.equal(selectReleaseTag(['v1.0.1'], [], '1.1.0'), 'v1.1.0');
  assert.throws(() => selectReleaseTag([], [], 'bad'));
});
