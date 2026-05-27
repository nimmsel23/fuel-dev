/**
 * firestore-sync.mjs — Sync-Bridge für Fuel Centre
 * Synchronisiert lokale JSON-Logs (data/) mit Firebase Firestore.
 */

import admin from "firebase-admin";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DATA_DIR = join(ROOT, "data", "catalogs");
const SA_PATH = join(process.env.HOME, ".config", "fuel-pwa", "service-account.json");

const UID_DEFAULT = "default";

// ── Gemini Logic ──────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY nicht gesetzt");
  
  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });
  
  const data = await response.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  if (text.includes("```")) {
    text = text.split("```")[1];
    if (text.startsWith("json")) text = text.slice(4);
    if (text.includes("```")) text = text.split("```")[0];
  }
  
  try {
    return JSON.parse(text.trim());
  } catch (e) {
    return text.trim();
  }
}

// ── Init Firebase ──────────────────────────────────────────────────────────────

if (!existsSync(SA_PATH)) {
  console.error(`❌ Service Account nicht gefunden unter: ${SA_PATH}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(SA_PATH, "utf8"));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ── Sync Logic ────────────────────────────────────────────────────────────────

async function watchTasks() {
  console.log("👀 Watcher aktiv: Warte auf Knowledge-Tasks in Firestore...");
  
  db.collection("knowledge_tasks")
    .where("status", "==", "pending")
    .onSnapshot(async (snap) => {
      for (const change of snap.docChanges()) {
        if (change.type === "added") {
          const task = change.doc.data();
          const taskId = change.doc.id;
          console.log(`✨ Neuer Task: ${task.type} (${task.id || task.description})`);
          
          try {
            await db.collection("knowledge_tasks").doc(taskId).update({ status: "processing" });
            
            let result = null;
            if (task.type === "enrich_meal") {
              const prompt = `Schätze Makros und Mikronährstoffe für: "${task.description}". Antworte NUR mit JSON: {"kcal": 0, "protein": 0, "carbs": 0, "fat": 0, "micros": {"vitamin_c_mg": 0, ...}}`;
              result = await callGemini(prompt);
            } else if (task.type === "enrich_supplement") {
              const prompt = `Beschreibe die physiologische Wirkung und Dosierung von "${task.id}". Antworte NUR mit JSON: {"mechanism": "", "dosage_info": "", "physiological_impact": ""}`;
              result = await callGemini(prompt);
            }
            
            await db.collection("knowledge_tasks").doc(taskId).update({
              status: "completed",
              result: result,
              completed_at: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`✅ Task abgeschlossen: ${taskId}`);
            
          } catch (err) {
            console.error(`❌ Task Fehler: ${taskId}`, err.message);
            await db.collection("knowledge_tasks").doc(taskId).update({ 
              status: "error", 
              error: err.message 
            });
          }
        }
      }
    }, (err) => {
      console.error("❌ Snapshot Fehler:", err);
    });
}

async function push(uid = UID_DEFAULT) {
  console.log(`🚀 Starte Push für User: ${uid}`);
  
  // 1. Nutrition Logs
  const nutritionDir = join(DATA_DIR, "nutrition");
  if (existsSync(nutritionDir)) {
    const files = readdirSync(nutritionDir).filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.json$/));
    for (const file of files) {
      const date = file.replace(".json", "");
      const localData = JSON.parse(readFileSync(join(nutritionDir, file), "utf8"));
      
      console.log(`  → Nutrition ${date}`);
      await db.collection("nutrition").doc(uid).collection("logs").doc(date).set({
        ...localData,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }

  // 2. Supplement Logs
  const suppLogsDir = join(DATA_DIR, "supplements", "logs");
  if (existsSync(suppLogsDir)) {
    const files = readdirSync(suppLogsDir).filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.json$/));
    for (const file of files) {
      const date = file.replace(".json", "");
      const localData = JSON.parse(readFileSync(join(suppLogsDir, file), "utf8"));
      
      console.log(`  → Supplements ${date}`);
      await db.collection("supplements").doc(uid).collection("logs").doc(date).set({
        ...localData,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }

  // 3. Catalog (Nutrition)
  const nutritionCatalog = join(nutritionDir, "catalog.json");
  if (existsSync(nutritionCatalog)) {
    const data = JSON.parse(readFileSync(nutritionCatalog, "utf8"));
    console.log(`  → Nutrition Catalog`);
    await db.collection("nutrition").doc(uid).collection("meta").doc("catalog").set({
      items: data.items || data,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  console.log("✅ Push abgeschlossen.");
}

async function pushRelax(uid = UID_DEFAULT) {
  const relaxDir = resolve(ROOT, "..", "relax-dev", "data");
  if (!existsSync(relaxDir)) {
    console.log("ℹ️ relax-dev Verzeichnis nicht gefunden, überspringe.");
    return;
  }
  
  console.log(`🚀 Starte Relax-Push für User: ${uid}`);
  
  // 1. Relax Sessions
  const sessionsDir = join(relaxDir, "sessions");
  if (existsSync(sessionsDir)) {
    const files = readdirSync(sessionsDir).filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.json$/));
    for (const file of files) {
      const date = file.replace(".json", "");
      const localData = JSON.parse(readFileSync(join(sessionsDir, file), "utf8"));
      console.log(`  → Relax Session ${date}`);
      await db.collection("relax").doc(uid).collection("sessions").doc(date).set({
        ...localData,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }

  // 2. Relax Journal
  const journalDir = join(relaxDir, "journal");
  if (existsSync(journalDir)) {
    const files = readdirSync(journalDir).filter(f => f.endsWith(".md"));
    for (const file of files) {
      const date = file.replace(".md", "");
      const content = readFileSync(join(journalDir, file), "utf8");
      console.log(`  → Relax Journal ${date}`);
      await db.collection("relax").doc(uid).collection("journal").doc(date).set({
        date,
        content,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }
  
  console.log("✅ Relax-Push abgeschlossen.");
}

async function pull(uid = UID_DEFAULT) {
  console.log(`📥 Starte Pull für User: ${uid}`);

  const nutritionDir = join(DATA_DIR, "nutrition");
  if (!existsSync(nutritionDir)) mkdirSync(nutritionDir, { recursive: true });
  
  const nutSnap = await db.collection("nutrition").doc(uid).collection("logs").get();
  nutSnap.forEach(doc => {
    const data = doc.data();
    delete data.updated_at;
    writeFileSync(join(nutritionDir, `${doc.id}.json`), JSON.stringify(data, null, 2));
    console.log(`  ← Nutrition ${doc.id}`);
  });

  const suppLogsDir = join(DATA_DIR, "supplements", "logs");
  if (!existsSync(suppLogsDir)) mkdirSync(suppLogsDir, { recursive: true });
  
  const suppSnap = await db.collection("supplements").doc(uid).collection("logs").get();
  suppSnap.forEach(doc => {
    const data = doc.data();
    delete data.updated_at;
    writeFileSync(join(suppLogsDir, `${doc.id}.json`), JSON.stringify(data, null, 2));
    console.log(`  ← Supplements ${doc.id}`);
  });

  console.log("✅ Pull abgeschlossen.");
}

// ── CLI Runner ────────────────────────────────────────────────────────────────

const [,, cmd, uidArg] = process.argv;

if (cmd === "push") {
  push(uidArg)
    .then(() => pushRelax(uidArg))
    .then(() => process.exit(0))
    .catch(e => { console.error(e); process.exit(1); });
} else if (cmd === "pull") {
  pull(uidArg).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} else if (cmd === "watch") {
  watchTasks();
} else {
  console.log("Usage: node scripts/firestore-sync.mjs [push|pull|watch] [uid]");
  process.exit(1);
}
