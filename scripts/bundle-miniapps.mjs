// Baut alle Mini-Apps (scripts/miniapps.json) und legt sie unter dist-firebase/<id>/ ab.
// Ergebnis: vos-fuel.web.app/<id>/ — eigene Manifest/Icons/SW pro App (Home-Bildschirm-Icon),
// gleiche Domain wie die Haupt-App → ein Login für alle.
// Aufruf nach build:cloud (dist-firebase/ muss existieren).
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { apps } = JSON.parse(readFileSync(resolve(root, 'scripts/miniapps.json'), 'utf8'))
const dist = resolve(root, 'dist-firebase')
if (!existsSync(resolve(dist, 'index.html'))) {
  console.error('❌ dist-firebase/index.html fehlt — erst build:cloud')
  process.exit(1)
}
for (const { id } of apps) {
  const r = spawnSync('node', ['scripts/build-miniapp.mjs', id], { cwd: root, stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status || 1)
  const target = resolve(dist, id)
  rmSync(target, { recursive: true, force: true })
  cpSync(resolve(root, `dist-solo-${id}`), target, { recursive: true })
  console.log(`📦 ${id} -> dist-firebase/${id}/`)
}
