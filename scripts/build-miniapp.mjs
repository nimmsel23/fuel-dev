// Baut (und deployt optional) eine Fuel-Mini-App.
//   node scripts/build-miniapp.mjs <id> [--deploy]      <id> = Eintrag in scripts/miniapps.json
// Ablauf wie build:solo:<id>: vite build (VITE_SOLO=<id>) -> stamp-solo (SW, Manifest, Icons, Splash).
// --deploy: firebase deploy --only hosting:<target>.
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { apps } = JSON.parse(readFileSync(resolve(root, 'scripts/miniapps.json'), 'utf8'))
const id = process.argv[2]
const deploy = process.argv.includes('--deploy')
const app = apps.find((a) => a.id === id)
if (!app) {
  console.error(`build-miniapp: unbekannte App "${id}". Gültig: ${apps.map((a) => a.id).join(', ')}`)
  process.exit(1)
}

const steps = ['vite build --config vite.config.cjs', `node scripts/stamp-solo.mjs ${id}`]
if (deploy) steps.push(`firebase deploy --only hosting:${app.target} --project fitness-aos`)

for (const cmd of steps) {
  console.log(`\n▶ [${id}] ${cmd}`)
  const r = spawnSync(cmd, {
    cwd: root,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, VITE_APP_MODE: 'client', VITE_SOLO: id },
  })
  if (r.status !== 0) {
    console.error(`❌ build-miniapp ${id}: Schritt fehlgeschlagen: ${cmd}`)
    process.exit(r.status || 1)
  }
}
console.log(`\n✅ ${id} -> dist-solo-${id}${deploy ? ` deployt (${app.site}.web.app)` : ''}`)
