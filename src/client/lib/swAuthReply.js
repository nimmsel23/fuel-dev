// Antwort auf FUEL_AUTH_TOKEN_REQUEST. Solange Firebase die Session noch
// wiederherstellt, darf kein null raus: der Service Worker würde das als
// Logout lesen und ein noch gültiges Token löschen.
export function decideAuthTokenReply({ restored, signedIn, token }) {
  if (!restored) return { kind: "wait" };
  if (!signedIn) return { kind: "logout" };
  if (!token) return { kind: "keep" };
  return { kind: "token", token };
}
