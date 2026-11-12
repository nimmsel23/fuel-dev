"use strict";

function headerValue(req, name) {
  if (typeof req.get === "function") {
    const viaGetter = req.get(name);
    if (typeof viaGetter === "string" && viaGetter) return viaGetter;
  }
  const headers = req.headers || {};
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(direct)) return direct[0] || "";
  return typeof direct === "string" ? direct : "";
}

function bearerToken(req) {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(headerValue(req, "Authorization"));
  return match ? match[1] : null;
}

function send(res, status, body) {
  res.status(status).send(body);
}

function createSupplementActions({ admin, getLocalDateParts }) {
  async function requireCallerUid(req, res) {
    const token = bearerToken(req);
    if (!token) {
      send(res, 401, { ok: false, error: "unauthenticated", code: "unauthenticated" });
      return null;
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch (error) {
      console.error("ID token verification failed:", error?.code || error?.message || "unknown");
      send(res, 401, { ok: false, error: "unauthenticated", code: "unauthenticated" });
      return null;
    }

    const uid = decoded?.uid;
    if (typeof uid !== "string" || !uid) {
      send(res, 401, { ok: false, error: "unauthenticated", code: "unauthenticated" });
      return null;
    }

    // Body-uid ist nie die Schreib-Identität. Eine abweichende uid ist ein
    // Versuch, ein fremdes Konto zu treffen und wird abgelehnt.
    const bodyUid = req.body?.uid;
    if (typeof bodyUid === "string" && bodyUid && bodyUid !== uid) {
      send(res, 403, { ok: false, error: "uid mismatch", code: "permission-denied" });
      return null;
    }
    return uid;
  }

  async function quickLogSupplement(req, res) {
    if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
    const uid = await requireCallerUid(req, res);
    if (!uid) return;

    const item = req.body?.item;
    const date = req.body?.date;
    if (!item?.id) return send(res, 400, { ok: false, error: "item.id required" });

    const dateStr = typeof date === "string" && date ? date : getLocalDateParts().date;
    const db = admin.firestore();
    const logRef = db.collection("supplements").doc(uid).collection("logs").doc(dateStr);

    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(logRef);
        const data = snap.exists ? snap.data() : { date: dateStr, intakes: [] };
        const intakes = Array.isArray(data.intakes) ? data.intakes : [];
        if (intakes.some((entry) => entry.supplement_id === item.id)) return;
        intakes.push({
          id: `supp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          supplement_id: item.id,
          name: item.name || item.id,
          dose: item.dose ?? null,
          unit: item.unit || "mg",
          time_of_day: item.time_of_day || "any",
          notes: "",
          time: new Date().toISOString(),
        });
        tx.set(logRef, {
          ...data,
          date: dateStr,
          intakes,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      });
      send(res, 200, { ok: true });
    } catch (error) {
      console.error("quickLogSupplement failed:", error);
      send(res, 500, { ok: false, error: error.message });
    }
  }

  async function snoozeSupplement(req, res) {
    if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
    const uid = await requireCallerUid(req, res);
    if (!uid) return;

    const itemIds = req.body?.item_ids;
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return send(res, 400, { ok: false, error: "item_ids required" });
    }

    const until = Date.now() + 30 * 60 * 1000;
    const ref = admin.firestore().collection("users").doc(uid).collection("meta").doc("supplement_snooze");
    try {
      const update = {};
      for (const id of itemIds) update[id] = until;
      await ref.set(update, { merge: true });
      send(res, 200, { ok: true, until });
    } catch (error) {
      console.error("snoozeSupplement failed:", error);
      send(res, 500, { ok: false, error: error.message });
    }
  }

  return { quickLogSupplement, snoozeSupplement };
}

module.exports = { createSupplementActions };
