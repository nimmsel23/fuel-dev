// ================================================================
// FRONTEND — Simple Web-App zur Ansicht des Micros-Katalogs
// ================================================================
// Wird via Web-App-Deployment (clasp deploy) erreichbar. Jedes Deployment
// erzeugt eine Version im Apps-Script-Projekt → das ist unser Deployment-
// Verlauf (sichtbar im Apps Script Editor unter "Deploy → Manage deployments").

function doGet(e) {
  const doc = fsGet_('nutrition/public/meta/micros');
  const items = doc ? (fsRead_(doc.fields?.items) || []) : [];
  items.sort((a, b) => (a.meal_name || '').localeCompare(b.meal_name || ''));

  const snapshots = listDriveSnapshots_(10);

  const template = HtmlService.createTemplateFromFile('index');
  template.items = items;
  template.snapshots = snapshots;
  template.generatedAt = new Date().toISOString();

  return template.evaluate()
    .setTitle('Fuel Micros Katalog')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
