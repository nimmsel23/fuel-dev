// Fuel-spezifischer SW-Teil (Push, Supplement-Quick-Actions, eigener notificationclick) — wird vom Template
// (@vos/mini-app-shell, mini-app.json → apps.fuel.sw.extraFile) an den generierten SW angehängt.
// BASE kommt aus dem Template (Scope-Pfad der Registrierung); notificationClick ist dort abgeschaltet.
const withBase = (path) => `${BASE}${path}`

self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    let data
    try {
      data = event.data.json()
    } catch (e) {
      data = { body: event.data.text() }
    }

    // FCM HTTP v1 payload check
    if (data && data.notification) {
      data.title = data.notification.title
      data.body = data.notification.body
      data.icon = data.notification.icon || '/favicon-192x192.png'
      data.url = data.fcm_options?.link || '/supplements'
    }

    if (typeof data.actions === 'string') {
      try {
        data.actions = JSON.parse(data.actions)
      } catch (_error) {
        data.actions = []
      }
    }
    if (typeof data.meta === 'string') {
      try {
        data.meta = JSON.parse(data.meta)
      } catch (_error) {
        data.meta = {}
      }
    }

    const options = {
      body: data.body || 'Du hast noch offene Supplements für heute.',
      icon: data.icon || '/favicon-192x192.png',
      badge: '/favicon-192x192.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'fuel-reminder',
      renotify: Boolean(data.renotify),
      requireInteraction: Boolean(data.requireInteraction),
      actions: Array.isArray(data.actions)
        ? data.actions.slice(0, 3).map((action) => ({
            action: action.action,
            title: action.title,
          }))
        : [],
      data: {
        url: data.url || '/supplements',
        actions: Array.isArray(data.actions) ? data.actions : [],
        meta: data.meta || {},
      },
    }

    event.waitUntil(self.registration.showNotification(data.title || 'Fuel Reminder', options))
  } catch (err) {
    console.error('Push event payload not JSON', err)
  }
})

// Supplement-Quick-Actions: laufen komplett im SW, ohne ein Client-Window zu
// fokussieren. "quick-yes" loggt alle due_items direkt, "snooze" haelt sie
// 30min zurueck. Zwei Backends je Origin:
// - local (Fastify, /opt/fuel): /supplements/log + /push/snooze
// - cloud (*.web.app): quickLogSupplement/snoozeSupplement. Die uid bestimmt
//   nur das verifizierte Firebase-ID-Token. Die App schiebt es per
//   FUEL_AUTH_TOKEN hierher (src/client/lib/swAuthBridge.js). Ohne Token oder
//   bei 401 öffnet der SW die App auf #supplements/{datum}/{aktion}/{ids}.
const IS_CLOUD = self.location.hostname.includes('web.app') || self.location.hostname.includes('firebaseapp.com')
const CLOUD_FN_BASE = 'https://europe-west1-fitness-aos.cloudfunctions.net'
const AUTH_DB = 'fuel-sw-auth'
const AUTH_KEY = 'idToken'
let memoryIdToken = null

function openAuthDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AUTH_DB, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function idbPut(key, value) {
  return openAuthDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite')
        tx.objectStore('kv').put(value, key)
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => {
          db.close()
          reject(tx.error)
        }
      }),
  )
}

function idbGet(key) {
  return openAuthDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readonly')
        const req = tx.objectStore('kv').get(key)
        req.onsuccess = () => resolve(req.result ?? null)
        req.onerror = () => {
          db.close()
          reject(req.error)
        }
        tx.oncomplete = () => db.close()
      }),
  )
}

async function persistIdToken(token) {
  memoryIdToken = token || null
  try {
    await idbPut(AUTH_KEY, memoryIdToken)
  } catch (error) {
    console.error('[SW] auth token persist failed', error)
  }
}

async function loadIdToken() {
  if (memoryIdToken) return memoryIdToken
  try {
    memoryIdToken = (await idbGet(AUTH_KEY)) || null
  } catch (error) {
    console.error('[SW] auth token read failed', error)
  }
  return memoryIdToken
}

self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'FUEL_AUTH_TOKEN' || data.requestId) return
  event.waitUntil(persistIdToken(data.token))
})

function requestTokenFromClients() {
  return new Promise((resolve) => {
    const requestId = `auth_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    let pending = 0
    let token = null
    let settled = false
    const finish = (state) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      self.removeEventListener('message', onMessage)
      resolve({ state, token })
    }
    const timer = setTimeout(() => finish(token ? 'token' : 'timeout'), 1200)
    function onMessage(event) {
      const data = event.data || {}
      if (data.type !== 'FUEL_AUTH_TOKEN' || data.requestId !== requestId) return
      pending -= 1
      if (data.token) token = data.token
      if (pending <= 0) finish(token ? 'token' : 'logged-out')
    }
    self.addEventListener('message', onMessage)
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        if (!windowClients.length) {
          finish('none')
          return
        }
        pending = windowClients.length
        for (const client of windowClients) client.postMessage({ type: 'FUEL_AUTH_TOKEN_REQUEST', requestId })
      })
      .catch(() => finish('timeout'))
  })
}

async function resolveCloudAuthToken() {
  const result = await requestTokenFromClients()
  if (result.state === 'token') {
    await persistIdToken(result.token)
    return result.token
  }
  if (result.state === 'logged-out') {
    await persistIdToken(null)
    return null
  }
  return loadIdToken()
}

function cloudHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

function supplementActionUrl(action, items, dateStr) {
  const ids = items
    .map((item) => item && item.id)
    .filter(Boolean)
    .map((id) => encodeURIComponent(id))
    .join(',')
  const url = new URL(self.registration.scope)
  url.hash = `supplements/${dateStr}/${action}/${ids}`
  return url.href
}

async function openSupplementAction(action, items, dateStr) {
  const url = supplementActionUrl(action, items, dateStr)
  const supplementIds = items.map((item) => item && item.id).filter(Boolean)
  const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of windowClients) {
    if (!('focus' in client)) continue
    await client.focus()
    if ('navigate' in client) {
      try {
        await client.navigate(url)
        return url
      } catch (error) {
        console.error('[SW] navigate to supplement action failed', error)
      }
    }
    client.postMessage({ type: 'FUEL_SUPPLEMENT_ACTION', action, date: dateStr, supplementIds })
    return url
  }
  if (clients.openWindow) await clients.openWindow(url)
  return url
}

function showAuthHandoff(action, url) {
  const snooze = action === 'snooze'
  return self.registration.showNotification(snooze ? 'Später nach Anmeldung' : 'Einnahme nach Anmeldung', {
    body: snooze
      ? 'Die App ist offen. Nach dem Login wird die Erinnerung verschoben.'
      : 'Die App ist offen. Nach dem Login wird die Einnahme eingetragen.',
    icon: '/favicon-192x192.png',
    badge: '/favicon-192x192.png',
    tag: 'fuel-supplements-auth',
    data: { url },
  })
}

async function logSupplementIntake(item, dateStr, uid, authToken) {
  if (IS_CLOUD) {
    if (!authToken) return 401
    const response = await fetch(`${CLOUD_FN_BASE}/quickLogSupplement`, {
      method: 'POST',
      headers: cloudHeaders(authToken),
      body: JSON.stringify({ uid, date: dateStr, item }),
    })
    if (response.status === 401) return 401
    if (!response.ok) throw new Error(`cloud log failed: ${response.status}`)
    return 200
  }
  const response = await fetch(withBase('/supplements/log'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: dateStr,
      intake: {
        supplement_id: item.id,
        name: item.name,
        dose: item.dose,
        unit: item.unit,
        time_of_day: item.time_of_day,
      },
    }),
  })
  if (!response.ok) throw new Error(`log failed: ${response.status}`)
  return 200
}

async function handleQuickYes(data) {
  const items = Array.isArray(data.due_items) ? data.due_items : []
  const dateStr = data.date || new Date().toISOString().slice(0, 10)
  const authToken = IS_CLOUD ? await resolveCloudAuthToken() : null
  if (IS_CLOUD && !authToken) {
    const url = await openSupplementAction('quick-yes', items, dateStr)
    return showAuthHandoff('quick-yes', url)
  }
  const results = await Promise.allSettled(items.map((item) => logSupplementIntake(item, dateStr, data.uid, authToken)))
  const needsLogin = items.filter(
    (_item, index) => results[index].status === 'fulfilled' && results[index].value === 401,
  )
  if (needsLogin.length) {
    const url = await openSupplementAction('quick-yes', needsLogin, dateStr)
    return showAuthHandoff('quick-yes', url)
  }
  const failed = results.filter((result) => result.status === 'rejected').length
  const names = items.map((item) => item.name).join(', ') || 'Supplements'
  return self.registration.showNotification(failed > 0 ? 'Teilweise nicht geloggt' : 'Erledigt ✓', {
    body: failed > 0 ? `${names} — ${failed} fehlgeschlagen, bitte App öffnen.` : `${names} eingetragen.`,
    icon: '/favicon-192x192.png',
    badge: '/favicon-192x192.png',
    tag: 'fuel-supplements-ack',
  })
}

async function handleSnooze(data) {
  const items = Array.isArray(data.due_items) ? data.due_items : []
  const dateStr = data.date || new Date().toISOString().slice(0, 10)
  const itemIds = items.map((i) => i.id)
  try {
    if (IS_CLOUD) {
      const authToken = await resolveCloudAuthToken()
      if (!authToken) {
        const url = await openSupplementAction('snooze', items, dateStr)
        await showAuthHandoff('snooze', url)
        return
      }
      const response = await fetch(`${CLOUD_FN_BASE}/snoozeSupplement`, {
        method: 'POST',
        headers: cloudHeaders(authToken),
        body: JSON.stringify({ uid: data.uid, item_ids: itemIds, date: dateStr }),
      })
      if (response.status === 401) {
        const url = await openSupplementAction('snooze', items, dateStr)
        await showAuthHandoff('snooze', url)
      }
      return
    }
    await fetch(withBase('/push/snooze'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_ids: itemIds, date: dateStr }),
    })
  } catch (err) {
    // Lokaler Server offline oder Cloud-Function nicht erreichbar — bewusst
    // stumm, der Nutzer bekommt den naechsten regulaeren Reminder ohnehin.
    console.error('[SW] Snooze request failed', err)
  }
}

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {}
  const meta = data.meta || {}

  if (event.action === 'quick-yes' && Array.isArray(meta.due_items) && meta.due_items.length > 0) {
    event.notification.close()
    event.waitUntil(handleQuickYes(meta))
    return
  }
  if (event.action === 'snooze' && Array.isArray(meta.due_items) && meta.due_items.length > 0) {
    event.notification.close()
    event.waitUntil(handleSnooze(meta))
    return
  }

  event.notification.close()
  const actionMatch = Array.isArray(data.actions) ? data.actions.find((entry) => entry.action === event.action) : null
  const urlToOpen = actionMatch?.url || data.url || (event.notification.tag === 'fuel-supplements-auth' ? '' : '/')
  if (!urlToOpen) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        const client = windowClients.find((entry) => 'focus' in entry)
        if (client) return client.focus()
        if (clients.openWindow) return clients.openWindow(self.registration.scope)
      }),
    )
    return
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i]
        if ('focus' in client) {
          return client.focus().then(() => {
            if ('navigate' in client && urlToOpen) return client.navigate(urlToOpen)
            return client
          })
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    }),
  )
})
