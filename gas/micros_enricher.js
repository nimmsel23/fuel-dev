// ================================================================
// MICROS ENRICHER — Hauptlogik
// ================================================================

// Entry Point — wird via Time-Trigger täglich aufgerufen
function enrichMicros() {
  const startTime = Date.now();
  const MAX_MS = 5 * 60 * 1000; // 5 min Safety-Margin (GAS limit = 6min)

  Logger.log('=== Fuel Micros Enricher ===');

  const uids = listFuelUids_();
  Logger.log('User: ' + uids.length + ' (' + uids.join(', ') + ')');

  // 1. Bestehenden Micros-Katalog aus Firestore laden (shared/public, nicht pro User)
  const catalogDoc = fsGet_('nutrition/public/meta/micros');
  const existingItems = catalogDoc ? (fsRead_(catalogDoc.fields?.items) || []) : [];
  const existingMap = {};
  for (const item of existingItems) {
    existingMap[item.meal_name.toLowerCase()] = true;
  }
  Logger.log('Bestehende Micros-Einträge: ' + existingItems.length);

  // 2. Mahlzeiten der letzten LOOKBACK_DAYS Tage über ALLE User sammeln
  const mealNameSet = new Set();
  uids.forEach((uid) => collectMealNames_(uid).forEach((n) => mealNameSet.add(n)));
  const mealNames = [...mealNameSet];
  Logger.log('Unique Mahlzeiten in den letzten ' + LOOKBACK_DAYS + ' Tagen (alle User): ' + mealNames.length);

  // 3. Nur neue Mahlzeiten filtern
  const newMeals = mealNames.filter(name => !existingMap[name.toLowerCase()]);
  Logger.log('Neue Mahlzeiten ohne Micros: ' + newMeals.length);

  if (newMeals.length === 0) {
    Logger.log('Nichts zu tun.');
    return;
  }

  // 4. Gemini-Enrichment (max MAX_PER_RUN, time-bounded)
  const toProcess = newMeals.slice(0, MAX_PER_RUN);
  const newItems = [...existingItems];
  let processed = 0;
  let errors = 0;

  for (const mealName of toProcess) {
    if (Date.now() - startTime > MAX_MS) {
      Logger.log('Zeit-Limit erreicht, stoppe nach ' + processed + ' Mahlzeiten.');
      break;
    }

    const micros = callGemini_(mealName);
    if (!micros) {
      errors++;
      continue;
    }

    newItems.push({ meal_name: mealName, source: 'gemini-gas', ...micros });
    processed++;
    Logger.log('[' + processed + '] ' + mealName + ' → OK');
  }

  Logger.log('Verarbeitet: ' + processed + ', Fehler: ' + errors);

  // 5. Zurück nach Firestore schreiben
  if (processed > 0) {
    const fields = {
      items: fsVal_(newItems),
      updated_at: { timestampValue: new Date().toISOString() },
      _enriched_count: fsVal_(newItems.length),
    };
    fsPatch_('nutrition/public/meta/micros', fields);
    Logger.log('Firestore aktualisiert: ' + newItems.length + ' Einträge total.');

    saveSnapshotToDrive_(newItems);
  }
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

// Alle User-UIDs mit Fuel-Nutrition-Daten. Fallback auf FUEL_UID Script Property
// falls die Collection-Auflistung nichts findet (z.B. Security Rules blocken List).
function listFuelUids_() {
  const ids = fsListIds_('nutrition');
  if (ids.length > 0) return ids;
  const fallback = getProp_(PROP.FUEL_UID);
  return fallback ? [fallback] : [];
}

function collectMealNames_(uid) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // 1. Katalog laden für ID -> Name Mapping
  const catalogDoc = fsGet_('nutrition/' + uid + '/meta/catalog');
  const catalogItems = catalogDoc ? (fsRead_(catalogDoc.fields?.items) || []) : [];
  const catalogMap = {};
  catalogItems.forEach(i => { if (i.id && i.name) catalogMap[i.id] = i.name; });

  // 2. Logs abrufen
  const logDocs = fsList_('nutrition/' + uid + '/logs');
  const names = new Set();

  for (const doc of logDocs) {
    const docId = doc.name.split('/').pop();
    if (docId < cutoffStr) continue;

    const data = fsReadDoc_(doc);
    for (const meal of (data?.meals || [])) {
      // PWA Logic: catalogEntry.name || meal.description
      const name = (meal.catalog_id ? catalogMap[meal.catalog_id] : null) || (meal.description || '').trim();
      if (name && name.length > 2) names.add(name);
    }
  }

  return [...names];
}

// ── Manuell ausführbar ─────────────────────────────────────────────────────────

function testEnrichOne() {
  const name = '6 Freiland-Eier Eierspeise mit Salz, Pfeffer und Olivenöl';
  Logger.log('Test Gemini für: ' + name);
  const micros = callGemini_(name);
  Logger.log(JSON.stringify(micros, null, 2));
}

function showCatalogStats() {
  const doc = fsGet_('nutrition/public/meta/micros');
  if (!doc) { Logger.log('Kein Micros-Katalog in Firestore.'); return; }
  const items = fsRead_(doc.fields?.items) || [];
  Logger.log('Micros-Katalog: ' + items.length + ' Einträge');
  items.forEach(i => Logger.log('  • ' + i.meal_name));
}

function showNewMeals() {
  const uids = listFuelUids_();
  const nameSet = new Set();
  uids.forEach((uid) => collectMealNames_(uid).forEach((n) => nameSet.add(n)));
  const doc = fsGet_('nutrition/public/meta/micros');
  const existing = doc ? (fsRead_(doc.fields?.items) || []) : [];
  const existingMap = {};
  existing.forEach(i => { existingMap[i.meal_name.toLowerCase()] = true; });
  const missing = [...nameSet].filter(n => !existingMap[n.toLowerCase()]);
  Logger.log('Mahlzeiten ohne Micros (' + missing.length + ', ' + uids.length + ' User):');
  missing.forEach(n => Logger.log('  • ' + n));
}
