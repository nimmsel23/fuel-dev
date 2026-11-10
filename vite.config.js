import { vosChangelog } from './scripts/vos-changelog/vos-changelog-vite.mjs'
import { noDynamicChunks } from './scripts/vite-no-dynamic-chunks.mjs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const requireFromHere = createRequire(import.meta.url)

function resolvePackageEntry(specifier) {
  return requireFromHere.resolve(specifier)
}

// Vite 8 / Rolldown appends a content-hash to the `__VITE_PRELOAD__` marker
// (`__VITE_PRELOAD__50b3…`). Vite's import-analysis then replaces only the
// 16-char marker, leaving `[]50b3…` — invalid JS (black screen, same as vos-6pack).
// Preventive: Capacitor deps are present and will land lazy `import('./web')`.
function fixRolldownPreloadMarker() {
  return {
    name: 'fix-rolldown-preload-marker',
    renderChunk(code) {
      if (!code.includes('__VITE_PRELOAD__')) return null
      const next = code.replace(/__VITE_PRELOAD__[a-f\d]{8,}/g, '__VITE_PRELOAD__')
      return next === code ? null : { code: next, map: null }
    },
  }
}

// Local channel (build:local → /opt/fuel via deploy.sh). Fuel ist eigenständig:
// keine Imports aus Nachbar-Repos (fitness/journal/habits/relax), der Build läuft
// aus einem nackten Checkout. deploy.sh baut vor dem rsync nach /opt/fuel.
export default defineConfig(async () => {
  const appMode = 'coach'
  const outDir = './dist'

  console.log(`🚀 Building for local channel (APP_MODE: ${appMode}) -> outDir: ${outDir}`)

  return {
    base: './',
    define: {
      'import.meta.env.VITE_APP_MODE': JSON.stringify(appMode),
    },
    resolve: {
      alias: {
        '@api': resolve(__dirname, 'src/client/lib/api.local.js'),
        '@firebase-config': resolve(__dirname, 'src/client/lib/firebase.config.vitalos.js'),
        '@fuel': resolve(__dirname, 'src/client'),
        'firebase/app': resolvePackageEntry('firebase/app'),
        'firebase/app-check': resolvePackageEntry('firebase/app-check'),
        'firebase/messaging': resolvePackageEntry('firebase/messaging'),
        'firebase/auth': resolvePackageEntry('firebase/auth'),
        'firebase/firestore': resolvePackageEntry('firebase/firestore'),
        'firebase/functions': resolvePackageEntry('firebase/functions'),
        'firebase/storage': resolvePackageEntry('firebase/storage'),
        'firebase/ai': resolvePackageEntry('firebase/ai'),
      },
      dedupe: [
        'react',
        'react-dom',
        '@tanstack/react-query',
        'firebase',
        'firebase/app',
        'firebase/app-check',
        'firebase/messaging',
        'firebase/auth',
        'firebase/firestore',
        'firebase/functions',
        'firebase/storage',
        'firebase/ai',
      ],
    },
    plugins: [
      vosChangelog({ appId: 'fuel', appName: 'Fuel', accent: '#fb923c' }),
      react(),
      fixRolldownPreloadMarker(),
      noDynamicChunks(),
    ],
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        output: {
          // Vite 8/Rolldown: manualChunks must be a function (object form throws).
          manualChunks(id) {
            const m = id.match(/[\\/]node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?((?:@[^\\/]+[\\/])?[^\\/]+)/)
            if (!m) return undefined
            const pkg = m[1].split('\\').join('/')
            if (pkg === 'react' || pkg === 'react-dom' || pkg === 'scheduler') return 'vendor-react'
            if (pkg === '@tanstack/react-query') return 'vendor-query'
            if (pkg === 'firebase' || pkg.startsWith('@firebase/')) return 'vendor-firebase'
            if (pkg === 'recharts' || pkg.startsWith('d3-') || pkg === 'victory-vendor' || pkg === 'internmap'
              || pkg === 'decimal.js-light' || pkg === 'es-toolkit') return 'vendor-charts'
            return undefined
          },
        },
      },
    },
    server: {
      host: '127.0.0.1',
      port: 9001,
      strictPort: true,
      hmr: {
        host: '127.0.0.1',
        port: 9001,
        clientPort: 9001,
        protocol: 'ws',
      },
      proxy: {
        '/nutrition': 'http://127.0.0.1:9000',
        '/supplements': 'http://127.0.0.1:9000',
        '/fuel': 'http://127.0.0.1:9000',
        '/health': 'http://127.0.0.1:9000',
        '/api': 'http://127.0.0.1:9080',
      },
    },
  }
})
