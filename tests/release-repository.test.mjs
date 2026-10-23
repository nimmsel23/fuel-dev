import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readVosReleaseInfo } from '../scripts/vos-changelog/vos-release-info.mjs';
const root = mkdtempSync(join(tmpdir(), 'fuel-release-safe-'));
const git = (...args) => execFileSync('git', ['-C', root, ...args], {stdio:'pipe'});
try {
  git('init'); git('config','user.name','Test'); git('config','user.email','test@example.invalid');
  git('commit','--allow-empty','-m','initial'); mkdirSync(join(root, 'src/views'), {recursive:true}); writeFileSync(join(root, 'src/views/Test.jsx'), 'export default null'); git('add','.'); git('commit','-m','test');
  git('remote','add','origin','https://x-access-token:TEST_SECRET@github.com/example/app.git?secret=TEST_SECRET#TEST_SECRET');
  const release=readVosReleaseInfo({root,env:{}});
  assert.equal(release.repository,'https://github.com/example/app');
  assert.ok(!JSON.stringify(release).includes('TEST_SECRET'));
  console.log('Release metadata strips credentials, query and fragment');
} finally { rmSync(root,{recursive:true,force:true}); }
