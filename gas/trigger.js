// ================================================================
// TRIGGER SETUP
// ================================================================

function createDailyTrigger() {
  // Bestehende Trigger löschen
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'enrichMicros')
    .forEach(t => ScriptApp.deleteTrigger(t));

  // Täglich um 03:00 Uhr Wien-Zeit
  ScriptApp.newTrigger('enrichMicros')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();

  Logger.log('Daily trigger für enrichMicros gesetzt (03:00 täglich).');
}

function deleteTriggers() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'enrichMicros')
    .forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('Trigger gelöscht.');
}

function listTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  Logger.log('Aktive Trigger: ' + triggers.length);
  triggers.forEach(t => Logger.log('  • ' + t.getHandlerFunction() + ' [' + t.getTriggerSource() + ']'));
}
