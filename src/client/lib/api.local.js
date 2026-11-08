// Local channel — API writes go to Fastify. A signed-in Firebase user sends
// its verified ID token so the backend can select that user's ~/.aos runtime.
import { auth } from "./firebase.js";

async function headers(extra = {}) {
  await auth.authStateReady();
  const authorization = auth.currentUser
    ? { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` }
    : {};
  return { ...extra, ...authorization };
}

export async function fetchJson(path) {
  const res = await fetch(path, { headers: await headers() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function postJson(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: await headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch { /* keep fallback */ }
    throw new Error(message);
  }
  return res.json();
}

export async function patchJson(path, body) {
  const res = await fetch(path, {
    method: "PATCH",
    headers: await headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function deleteJson(path) {
  const res = await fetch(path, { method: "DELETE", headers: await headers() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
