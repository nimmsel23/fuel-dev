/**
 * firestore-sync.mjs — Sync-Bridge für Fuel Centre
 * Synchronisiert lokale JSON-Logs (data/) mit Firebase Firestore.
 */

import admin from "firebase-admin";
import Database from "better-sqlite3";
import YAML from "yaml";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DATA_DIR = join(ROOT, "data", "catalogs");
const SA_PATH = join(process.env.HOME, ".env", "firebase-fitness.json");

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
  console.log(`  → Processing Nutrition Catalog...`);
  let nutritionItems = [];
  
  // A) Check individual meal files in catalogs/ (support .yaml, .yml, .json)
  const mealsDir = join(ROOT, "catalogs", "nutrition", "meals");
  if (existsSync(mealsDir)) {
    const mealFiles = readdirSync(mealsDir).filter(f => 
      f.endsWith(".json") || f.endsWith(".yaml") || f.endsWith(".yml")
    );
    
    const seenIds = new Set();
    for (const file of mealFiles) {
      const ext = basename(file).split('.').pop();
      const id = basename(file, `.${ext}`);
      
      // Prefer YAML if both exist
      if (seenIds.has(id) && ext === "json") continue;
      
      try {
        const raw = readFileSync(join(mealsDir, file), "utf8");
        const item = (ext === "json") ? JSON.parse(raw) : YAML.parse(raw);
        nutritionItems.push(item);
        seenIds.add(id);
      } catch (e) {
        console.error(`    ❌ Fehler in Meal-File ${file}:`, e.message);
      }
    }
    console.log(`    Found ${nutritionItems.length} individual meals in catalogs/`);
  }

  // B) Fallback/Legacy: central catalog.json OR catalog.yaml
  const legacyCatalogJson = join(nutritionDir, "catalog.json");
  const legacyCatalogYaml = join(nutritionDir, "catalog.yaml");
  
  for (const legacyPath of [legacyCatalogYaml, legacyCatalogJson]) {
    if (existsSync(legacyPath)) {
      try {
        const raw = readFileSync(legacyPath, "utf8");
        const data = (legacyPath.endsWith(".json")) ? JSON.parse(raw) : YAML.parse(raw);
        const items = data.items || data;
        if (Array.isArray(items)) {
          nutritionItems = [...nutritionItems, ...items];
          console.log(`    Added items from legacy ${basename(legacyPath)}`);
          break; // Stop if we found one
        }
      } catch (e) {
        console.error(`    ❌ Fehler in legacy catalog:`, e.message);
      }
    }
  }

  if (nutritionItems.length > 0) {
    console.log(`    Pushing ${nutritionItems.length} nutrition items to Firestore`);
    await db.collection("nutrition").doc(uid).collection("meta").doc("catalog").set({
      items: nutritionItems,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // 4. Catalog (Supplements)
  const supplementsCatalogDir = join(DATA_DIR, "supplements");
  const supplementsCatalogYaml = join(supplementsCatalogDir, "catalog.yaml");
  const supplementsCatalogJson = join(supplementsCatalogDir, "catalog.json");
  
  let suppData = null;
  if (existsSync(supplementsCatalogYaml)) {
    suppData = YAML.parse(readFileSync(supplementsCatalogYaml, "utf8"));
    console.log(`  → Supplements Catalog (YAML)`);
  } else if (existsSync(supplementsCatalogJson)) {
    suppData = JSON.parse(readFileSync(supplementsCatalogJson, "utf8"));
    console.log(`  → Supplements Catalog (JSON)`);
  }

  if (suppData) {
    await db.collection("supplements").doc(uid).collection("meta").doc("catalog").set({
      items: suppData.items || suppData,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // 5. Micros Catalog (Global Shared from SQLite)
  const dbPath = join(DATA_DIR, "nutrition", "nutrition.db");
  if (existsSync(dbPath)) {
      const dbSqlite = new Database(dbPath);
      const micros = dbSqlite.prepare("SELECT * FROM meal_micros").all();
      if (micros.length > 0) {
        // Push to shared public path
        await db.collection("nutrition").doc("public").collection("meta").doc("micros").set({
            items: micros,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`  ✅ fuel.micros.catalog[${micros.length} items] -> firebase shared`);
      dbSqlite.close();
  }
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
