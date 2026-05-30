import admin from "firebase-admin";
import Database from "better-sqlite3";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
/**
 * firestore-sync.mjs — Sync-Bridge für Fuel Centre
 * Synchronisiert lokale JSON-Logs (data/) mit Firebase Firestore.
 */


const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Unify with src/config/paths.mjs logic
const DATA_DIR = process.env.AOS_FUEL_DATA_DIR
  ? resolve(process.env.AOS_FUEL_DATA_DIR)
  : join(process.env.HOME || "", ".aos", "fuel");

const SA_PATH = join(process.env.HOME, ".config", "fuel-pwa", "service-account.json");

const UID_DEFAULT = process.env.FUEL_CLOUD_UID || "default";

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
  console.log(`🏰 Temple Fuel: starting push for user "${uid}"`);
  
  // 1. Nutrition Logs
  const nutritionDir = join(DATA_DIR, "nutrition");
  if (existsSync(nutritionDir)) {
    const files = readdirSync(nutritionDir).filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.json$/));
    for (const file of files) {
      const date = file.replace(".json", "");
      const localData = JSON.parse(readFileSync(join(nutritionDir, file), "utf8"));
      
      await db.collection("nutrition").doc(uid).collection("logs").doc(date).set({
        ...localData,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log(`  ✅ fuel.nutrition.log[${date}] (${localData.meals?.length || 0} meals) -> firebase ok`);
    }
  }

  // 2. Supplement Logs
  const suppLogsDir = join(DATA_DIR, "supplements", "logs");
  if (existsSync(suppLogsDir)) {
    const files = readdirSync(suppLogsDir).filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.json$/));
    for (const file of files) {
      const date = file.replace(".json", "");
      const localData = JSON.parse(readFileSync(join(suppLogsDir, file), "utf8"));
      
      await db.collection("supplements").doc(uid).collection("logs").doc(date).set({
        ...localData,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log(`  ✅ fuel.supplements.log[${date}] (${localData.intakes?.length || 0} intakes) -> firebase ok`);
    }
  }

  // 3. Catalog (Nutrition)
  let nutritionItems = [];
  const mealsDir = join(ROOT, "catalogs", "nutrition", "meals");
  if (existsSync(mealsDir)) {
    const mealFiles = readdirSync(mealsDir).filter(f => f.endsWith(".json"));
    for (const file of mealFiles) {
      try {
        const item = JSON.parse(readFileSync(join(mealsDir, file), "utf8"));
        nutritionItems.push(item);
      } catch (e) {
        console.error(`    ❌ fuel.meal.item[${file}] parse error:`, e.message);
      }
    }
  }

  const legacyCatalog = join(nutritionDir, "catalog.json");
  if (existsSync(legacyCatalog)) {
    try {
      const data = JSON.parse(readFileSync(legacyCatalog, "utf8"));
      const items = data.items || data;
      if (Array.isArray(items)) nutritionItems = [...nutritionItems, ...items];
    } catch (e) {
      console.error(`    ❌ fuel.meal.legacy_catalog parse error:`, e.message);
    }
  }

  if (nutritionItems.length > 0) {
    await db.collection("nutrition").doc(uid).collection("meta").doc("catalog").set({
      items: nutritionItems,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`  ✅ fuel.meal.catalog[${nutritionItems.length} items] -> firebase ok`);
  }

...
  if (suppData) {
    await db.collection("supplements").doc(uid).collection("meta").doc("catalog").set({
      items: suppData.items || suppData,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`  ✅ fuel.supplement.catalog -> firebase ok`);
  }

  // 4. Catalog (Supplements)
  const supplementsCatalog = join(ROOT, "catalogs", "supplements", "catalog.json");
  const legacySuppCatalog = join(DATA_DIR, "supplements", "catalog.json");
  
  let suppData = null;
  if (existsSync(supplementsCatalog)) {
    suppData = JSON.parse(readFileSync(supplementsCatalog, "utf8"));
  } else if (existsSync(legacySuppCatalog)) {
    suppData = JSON.parse(readFileSync(legacySuppCatalog, "utf8"));
  }

  if (suppData) {
    await db.collection("supplements").doc(uid).collection("meta").doc("catalog").set({
      items: suppData.items || suppData,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`  ✅ fuel.supplement.catalog -> firebase ok`);
  }

  // 5. Micros Catalog (from SQLite)
  const dbPath = join(DATA_DIR, "nutrition", "nutrition.db");
  if (existsSync(dbPath)) {
      const dbSqlite = new Database(dbPath);
      const micros = dbSqlite.prepare("SELECT * FROM meal_micros").all();
      if (micros.length > 0) {
        await db.collection("nutrition").doc(uid).collection("meta").doc("micros").set({
            items: micros,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`  ✅ fuel.micros.catalog[${micros.length} items] -> firebase ok`);
      }
      dbSqlite.close();
  }
}

async function pushRelax(uid = UID_DEFAULT) {
  const relaxDir = resolve(ROOT, "..", "relax-dev", "data");
  if (!existsSync(relaxDir)) return;
  
  console.log(`🏰 Temple Relax: starting push for user "${uid}"`);
  
  // 1. Relax Sessions
  const sessionsDir = join(relaxDir, "sessions");
  if (existsSync(sessionsDir)) {
    const files = readdirSync(sessionsDir).filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.json$/));
    for (const file of files) {
      const date = file.replace(".json", "");
      const localData = JSON.parse(readFileSync(join(sessionsDir, file), "utf8"));
      await db.collection("relax").doc(uid).collection("sessions").doc(date).set({
        ...localData,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log(`  ✅ relax.sessions.log[${date}] -> firebase ok`);
    }
  }

  // 2. Relax Journal
  const journalDir = join(relaxDir, "journal");
  if (existsSync(journalDir)) {
    const files = readdirSync(journalDir).filter(f => f.endsWith(".md"));
    for (const file of files) {
      const date = file.replace(".md", "");
      const content = readFileSync(join(journalDir, file), "utf8");
      await db.collection("relax").doc(uid).collection("journal").doc(date).set({
        date,
        content,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`  ✅ relax.journal.log[${date}] -> firebase ok`);
    }
  }
}

async function pushFitness(uid = UID_DEFAULT) {
  const fitnessDir = resolve(ROOT, "..", "fitness-dev", "data");
  if (!existsSync(fitnessDir)) return;
  
  console.log(`🏰 Temple Fitness: starting push for user "${uid}"`);
  
  // 1. Fitness Sessions
  const sessionsDir = join(fitnessDir, "sessions");
  if (existsSync(sessionsDir)) {
    const files = readdirSync(sessionsDir).filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.json$/));
    for (const file of files) {
      const date = file.replace(".json", "");
      const localData = JSON.parse(readFileSync(join(sessionsDir, file), "utf8"));
      await db.collection("fitness").doc(uid).collection("sessions").doc(date).set({
        ...localData,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log(`  ✅ fitness.sessions.log[${date}] -> firebase ok`);
    }
  }

  // 2. Exercises / Catalog
  const catalogFile = join(fitnessDir, "catalog", "exercises.json");
  if (existsSync(catalogFile)) {
    const data = JSON.parse(readFileSync(catalogFile, "utf8"));
    await db.collection("fitness").doc(uid).collection("meta").doc("catalog").set({
      items: data.items || data,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`  ✅ fitness.exercise.catalog -> firebase ok`);
  }
}

async function pull(uid = UID_DEFAULT) {
  console.log(`📥 Temple Fuel: starting pull for user "${uid}"`);

  const nutritionDir = join(DATA_DIR, "nutrition");
  if (!existsSync(nutritionDir)) mkdirSync(nutritionDir, { recursive: true });
  
  const nutSnap = await db.collection("nutrition").doc(uid).collection("logs").get();
  nutSnap.forEach(doc => {
    const data = doc.data();
    delete data.updated_at;
    writeFileSync(join(nutritionDir, `${doc.id}.json`), JSON.stringify(data, null, 2));
    console.log(`  ← fuel.nutrition.log[${doc.id}] fetched`);
  });

  const suppLogsDir = join(DATA_DIR, "supplements", "logs");
  if (!existsSync(suppLogsDir)) mkdirSync(suppLogsDir, { recursive: true });
  
  const suppSnap = await db.collection("supplements").doc(uid).collection("logs").get();
  suppSnap.forEach(doc => {
    const data = doc.data();
    delete data.updated_at;
    writeFileSync(join(suppLogsDir, `${doc.id}.json`), JSON.stringify(data, null, 2));
    console.log(`  ← fuel.supplements.log[${doc.id}] fetched`);
  });

  console.log("✅ fuel.pull finished");
}

// ── CLI Runner ────────────────────────────────────────────────────────────────

const [,, cmd, uidArg] = process.argv;

if (cmd === "push") {
  push(uidArg)
    .then(() => pushRelax(uidArg))
    .then(() => pushFitness(uidArg))
    .then(() => {
      console.log("\n✨ All temples synchronized to Firebase.");
      process.exit(0);
    })
    .catch(e => { console.error(e); process.exit(1); });
} else if (cmd === "pull") {
  pull(uidArg).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} else if (cmd === "watch") {
  watchTasks();
} else {
  console.log("Usage: node scripts/firestore-sync.mjs [push|pull|watch] [uid]");
  process.exit(1);
}
