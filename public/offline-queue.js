"use strict";

// fitness-dev Offline-Queue
//
// Drop-in fetch-Wrapper für die fitness-dev App.
// Registriert sich als window.aosOfflineQueue.
//
// Verhalten:
//   GET  → Netz OK: pass-through + JSON in IDB cachen
//          Netz fail: IDB-Cache zurückgeben (stale) oder leeren Stub
//   POST → Netz OK: pass-through + Opportunistic Queue-Flush
//          Netz fail: in IDB einreihen + Background-Sync registrieren
//          Gibt synthetische 202 zurück (ok: true, queued: true, offline: true)
//
// Public API (window.aosOfflineQueue):
//   .fetch(url, init)  — drop-in fetch
//   .flush()           — jetzt alle queued POSTs senden
//   .size()            — Promise<number> queue-Länge
//   .isOnline()        — letzter bekannter Netzwerkstatus
//
// IndexedDB: aos-offline-fuel
//   store "queue":  { id (auto), method, url, body, headers, ts }
//   store "cache":  { url (key), data, ts }

(() => {
  const DB_NAME = 'aos-offline-fuel'
  const SYNC_TAG = 'fuel-flush-queue'
  let dbPromise = null
  let online = navigator.onLine ?? true

  // ── IDB ──────────────────────────────────────────────────────────────────

  function openDB() {
    if (dbPromise) return dbPromise
    dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, 1)
      r.onupgradeneeded = e => {
        const db = e.target.result
        if (!db.objectStoreNames.contains('queue'))
          db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
        if (!db.objectStoreNames.contains('cache'))
          db.createObjectStore('cache', { keyPath: 'url' })
      }
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
    return dbPromise
  }

  function store(name, mode) {
    return openDB().then(db => db.transaction(name, mode).objectStore(name))
  }

  function req(r) {
    return new Promise((resolve, reject) => {
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
  }

  // ── Queue ─────────────────────────────────────────────────────────────────

  async function enqueue(entry) {
    return req((await store('queue', 'readwrite')).add({ ...entry, ts: Date.now() }))
  }

  async function queueAll() {
    return req((await store('queue', 'readonly')).getAll())
  }

  async function queueDelete(id) {
    return req((await store('queue', 'readwrite')).delete(id))
  }

  async function size() {
    return req((await store('queue', 'readonly')).count())
  }

  // ── Cache (GET reads) ─────────────────────────────────────────────────────

  async function cacheGet(url) {
    const row = await req((await store('cache', 'readonly')).get(url)).catch(() => null)
    return row?.data ?? null
  }

  async function cachePut(url, data) {
    return req((await store('cache', 'readwrite')).put({ url, data, ts: Date.now() })).catch(() => {})
  }

  // ── Flush ─────────────────────────────────────────────────────────────────

  async function flush() {
    const items = await queueAll().catch(() => [])
    if (!items.length) return { ok: true, flushed: 0, failed: 0 }
    let flushed = 0, failed = 0
    for (const item of items) {
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: item.headers || { 'Content-Type': 'application/json' },
          body: item.body,
        })
        if (!res.ok && res.status >= 500) throw new Error(`http_${res.status}`)
        await queueDelete(item.id)
        flushed++
      } catch {
        failed++
        break
      }
    }
    if (flushed > 0) {
      window.dispatchEvent(new CustomEvent('fitness:queue-flushed', { detail: { flushed, failed } }))
    }
    return { ok: failed === 0, flushed, failed }
  }

  async function tryRegisterSync() {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return
    try {
      const reg = await navigator.serviceWorker.ready
      await reg.sync.register(SYNC_TAG)
    } catch { /* Background Sync nicht verfügbar */ }
  }

  // ── fetch-Wrapper ─────────────────────────────────────────────────────────

  function bodyToString(body) {
    if (body == null) return ''
    if (typeof body === 'string') return body
    try { return JSON.stringify(body) } catch { return String(body) }
  }

  function headersToObject(h) {
    if (!h) return { 'Content-Type': 'application/json' }
    if (h instanceof Headers) {
      const o = {}; h.forEach((v, k) => { o[k] = v }); return o
    }
    return { ...h }
  }

  async function apiFetch(input, init = {}) {
    const url = typeof input === 'string' ? input : (input?.url || '')
    const method = String(
      init?.method || (typeof input === 'object' ? input?.method : null) || 'GET'
    ).toUpperCase()

    try {
      const res = await fetch(input, init)
      online = true

      // GET: JSON in IDB cachen
      if (res.ok && method === 'GET') {
        const ct = res.headers.get('content-type') || ''
        if (ct.includes('application/json')) {
          res.clone().json().then(data => cachePut(url, data)).catch(() => {})
        }
      }

      // POST: Opportunistic flush falls noch was in der Queue ist
      if (method === 'POST') {
        size().then(n => { if (n > 0) flush().catch(() => {}) }).catch(() => {})
      }

      return res
    } catch {
      online = false

      if (method === 'GET') {
        const cached = await cacheGet(url).catch(() => null)
        if (cached != null) {
          return new Response(JSON.stringify(cached), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'X-Source': 'offline-cache' },
          })
        }
        return new Response(JSON.stringify({ ok: false, offline: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'X-Source': 'offline-stub' },
        })
      }

      // POST → einreihen
      await enqueue({
        method,
        url,
        body: bodyToString(init.body),
        headers: headersToObject(init.headers),
      })
      tryRegisterSync().catch(() => {})

      return new Response(
        JSON.stringify({ ok: true, queued: true, offline: true }),
        { status: 202, headers: { 'Content-Type': 'application/json', 'X-Source': 'offline-queue' } }
      )
    }
  }

  // ── Auto-flush on reconnect ───────────────────────────────────────────────

  window.addEventListener('online', () => {
    online = true
    flush().catch(() => {})
  })
  window.addEventListener('offline', () => { online = false })

  // DB vorab öffnen
  openDB().catch(() => {})

  // ── Public API ────────────────────────────────────────────────────────────

  window.aosOfflineQueue = {
    fetch: apiFetch,
    flush,
    size,
    isOnline: () => online,
  }
})()
