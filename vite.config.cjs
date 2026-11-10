const { defineConfig, loadEnv } = require('vite')
const react = require('@vitejs/plugin-react')
const { resolve } = require('path')

function resolvePackageEntry(specifier) {
  return require.resolve(specifier, { paths: [__dirname] })
}

module.exports = defineConfig(async ({ mode }) => {
  const { vosChangelog } = await import('./scripts/vos-changelog/vos-changelog-vite.mjs')
  const { noDynamicChunks } = await import('./scripts/vite-no-dynamic-chunks.mjs')
  const env = loadEnv(mode, process.cwd(), '')
  const appMode = process.env.VITE_APP_MODE || env.VITE_APP_MODE || 'coach'

  // Mini-App-Build (VITE_SOLO=log|supplements|micros|report): ein Tab, eigener Output dist-solo-<tab>
  const solo = process.env.VITE_SOLO || env.VITE_SOLO || ''

  // coach builds to dist/ (local server), client builds to dist-firebase/ (for firebase deploy)
  // Optional: VITE_SOLO_FRONTDOOR=shutter|tapboard|tagesfaden — die Mini-App startet im Schnelleinstieg (eingebettet in 6Pack)
  const soloFrontdoor = solo ? process.env.VITE_SOLO_FRONTDOOR || env.VITE_SOLO_FRONTDOOR || '' : ''
  const outDir = soloFrontdoor
    ? `./dist-solo-${solo}-${soloFrontdoor}`
    : solo
      ? `./dist-solo-${solo}`
      : appMode === 'client'
        ? './dist-firebase'
        : './dist'

  console.log(`🚀 Building for mode: ${mode}, APP_MODE: ${appMode} -> outDir: ${outDir}`)

  return {
    base: './',
    define: {
      'import.meta.env.VITE_APP_MODE': JSON.stringify(appMode),
      'import.meta.env.VITE_SOLO': JSON.stringify(solo),
      'import.meta.env.VITE_SOLO_FRONTDOOR': JSON.stringify(soloFrontdoor),
    },
    resolve: {
      alias: {
        '@api': resolve(
          __dirname,
          appMode === 'client' ? 'src/client/lib/api.cloud.js' : 'src/client/lib/api.local.js',
        ),
        '@fuel': resolve(__dirname, 'src/client'),
        // Eine gemeinsame Instanz der Pakete (Rollup/Dedupe).
        'react/jsx-runtime': resolvePackageEntry('react/jsx-runtime'),
        'react/jsx-dev-runtime': resolvePackageEntry('react/jsx-dev-runtime'),
        'react-dom/client': resolvePackageEntry('react-dom/client'),
        'react-dom': resolvePackageEntry('react-dom'),
        react: resolvePackageEntry('react'),
        'firebase/app': resolvePackageEntry('firebase/app'),
        'firebase/app-check': resolvePackageEntry('firebase/app-check'),
        'firebase/messaging': resolvePackageEntry('firebase/messaging'),
        'firebase/auth': resolvePackageEntry('firebase/auth'),
        'firebase/firestore': resolvePackageEntry('firebase/firestore'),
        'firebase/functions': resolvePackageEntry('firebase/functions'),
        'firebase/storage': resolvePackageEntry('firebase/storage'),
        'firebase/ai': resolvePackageEntry('firebase/ai'),
        'lucide-react': resolvePackageEntry('lucide-react'),
        '@tanstack/react-query': resolvePackageEntry('@tanstack/react-query'),
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
      vosChangelog({
        appId: solo ? `fuel-${solo}` : 'fuel',
        appName: solo
          ? { log: 'Fuel Log', supplements: 'Supplements', micros: 'Mikros', report: 'Ernährungsprotokoll' }[solo]
          : 'Fuel',
        accent: '#fb923c',
      }),
      ...(solo === 'supplements'
        ? [
            {
              name: 'supplements-entry',
              transformIndexHtml: {
                order: 'pre',
                handler: (html) => html.replace('/src/client/main.jsx', '/src/client/solo-main.jsx'),
              },
            },
          ]
        : []),
      react(),
      noDynamicChunks(),
    ],
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        output: {
                    manualChunks(id) {
            const m = id.match(/[\\/]node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?((?:@[^\\/]+[\\/])?[^\\/]+)/)
            if (!m) return undefined
            const pkg = m[1].replace(/\\/g, '/')
            if (pkg === 'react' || pkg === 'react-dom' || pkg === 'scheduler') return 'react'
            if (pkg === 'lucide-react') return 'icons'
            if (pkg === 'react-body-highlighter') return 'bodymap'
            if (pkg === 'firebase' || pkg.startsWith('@firebase/')) return 'firebase'
            if (pkg === 'recharts' || pkg.startsWith('d3-') || pkg === 'victory-vendor' || pkg === 'internmap'
              || pkg === 'decimal.js-light' || pkg === 'es-toolkit') return 'charts'
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
      },
      proxy: {
        '/nutrition': 'http://127.00.1:9000',
        '/supplements': 'http://127.0.0.1:9000',
        '/fuel': 'http://127.0.0.1:9000',
        '/health': 'http://127.0.0.1:9000',
        '/api': 'http://127.0.0.1:9080',
      },
    },
  }
})
