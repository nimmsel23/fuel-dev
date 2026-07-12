import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sw = resolve(root, 'public/sw.js');
const manifest = resolve(root, 'public/manifest.json');

const content = readFileSync(sw, 'utf8');
const match = content.match(/([a-zA-Z0-9_-]+-v)(\d+)/);
if (!match) { console.log('⚠️  CACHE pattern not found in sw.js'); process.exit(0); }
const next = parseInt(match[2]) + 1;
writeFileSync(sw, content.replace(`${match[1]}${match[2]}`, `${match[1]}${next}`));
console.log(`🔢 sw.js: ${match[1]}${match[2]} → ${match[1]}${next}`);

if (existsSync(manifest)) {
  const data = JSON.parse(readFileSync(manifest, 'utf8'));
  const prevVersion = data.version || '0';
  data.version = String(next);
  writeFileSync(manifest, JSON.stringify(data, null, 2) + '\n');
  console.log(`🔢 manifest.json: version ${prevVersion} → ${next}`);
} else {
  console.log('⚠️  manifest.json not found — skip version bump');
}
