// An offline outbox can be projected without a cached base, but cannot prove
// that the day contains no other entries already stored in the cloud.
export function requireCompleteLog(log) {
  if (log?.local_base_unavailable) {
    throw new Error('Der gespeicherte Tagesstand ist offline nicht verfügbar. Bitte verbinden und erneut laden.');
  }
  return log;
}
