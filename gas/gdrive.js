// ================================================================
// GOOGLE DRIVE — Snapshot-Historie für den Micros-Katalog
// ================================================================
// Bei jedem enrichMicros-Lauf wird zusätzlich zum Firestore-Write ein
// zeitgestempeltes JSON nach Drive geschrieben — ergibt eine einfache
// Versions-/Verlaufs-Historie unabhängig von Firestore.

const DRIVE_FOLDER_NAME = 'Fuel Micros Snapshots';

function driveFolder_() {
  const it = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function saveSnapshotToDrive_(items) {
  try {
    const folder = driveFolder_();
    const ts = Utilities.formatDate(new Date(), 'Europe/Vienna', 'yyyy-MM-dd_HHmmss');
    const filename = 'micros_catalog_' + ts + '.json';
    const payload = JSON.stringify({ generated_at: new Date().toISOString(), count: items.length, items: items }, null, 2);
    folder.createFile(filename, payload, MimeType.PLAIN_TEXT);
    Logger.log('Drive-Snapshot gespeichert: ' + filename + ' (' + items.length + ' Einträge)');
  } catch (e) {
    Logger.log('Drive-Snapshot fehlgeschlagen: ' + e);
  }
}

// Liste der letzten N Snapshots (für Frontend-Verlauf)
function listDriveSnapshots_(limit) {
  const folder = driveFolder_();
  const files = folder.getFilesByType(MimeType.PLAIN_TEXT);
  const out = [];
  while (files.hasNext()) {
    const f = files.next();
    out.push({ name: f.getName(), id: f.getId(), created: f.getDateCreated(), size: f.getSize() });
  }
  out.sort((a, b) => b.created - a.created);
  return limit ? out.slice(0, limit) : out;
}

// Manuell ausführbar — Snapshot des aktuellen Firestore-Katalogstands ohne Enrichment-Run
function snapshotCurrentCatalog() {
  const doc = fsGet_('nutrition/public/meta/micros');
  const items = doc ? (fsRead_(doc.fields?.items) || []) : [];
  saveSnapshotToDrive_(items);
}
