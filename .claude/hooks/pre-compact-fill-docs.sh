#!/usr/bin/env bash
# PreCompact hook — fuel-dev, repo-lokal. Befuellt vor jeder Context-
# Kompaktierung automatisch TODO.md (Makro-Backlog), RESULTS.md
# (Session-Log, was wurde gemacht) und NEXT.md (was blieb offen), damit
# eine andere/spaetere Claude-Session sauber weiterarbeiten kann.
#
# Portiert 1:1 aus fitness-dev (.claude/hooks/pre-compact-fill-docs.sh,
# 2026-08-31) auf fuel-dev. Autorisierung: User hat diesen Hook 2026-09-01
# explizit bestaetigt (AskUserQuestion "Ja, genauso bauen"), nachdem der
# Auto-Mode-Classifier den ersten Versuch als nicht hinreichend
# autorisierte claude -p --dangerously-skip-permissions-Nutzung geblockt
# hatte (gleiches Muster wie zuvor in fitness-dev).
set -euo pipefail

REPO="/home/alpha/fuel-dev"
LOCK="$REPO/.claude/hooks/.fill-docs.lock"

command -v claude >/dev/null 2>&1 || exit 0

input="$(cat)"
transcript_path="$(printf '%s' "$input" | jq -r '.transcript_path // empty' 2>/dev/null || true)"
[ -n "$transcript_path" ] && [ -f "$transcript_path" ] || exit 0

cd "$REPO"

# Nur laufen wenn tatsaechlich etwas passiert ist seit dem letzten Commit —
# vermeidet leere/erfundene Eintraege bei reinen Diskussions-Sessions.
dirty=0
git status --porcelain 2>/dev/null | grep -q . && dirty=1
recent_commit=0
git log -1 --since="2 hours ago" >/dev/null 2>&1 && [ -n "$(git log -1 --since="2 hours ago" --format=%H 2>/dev/null)" ] && recent_commit=1
[ "$dirty" -eq 1 ] || [ "$recent_commit" -eq 1 ] || exit 0

# Parallele Sessions sind in diesem Repo der Normalfall — non-blocking Lock.
exec 9>"$LOCK"
flock -n 9 || exit 0

PROMPT=$(cat <<'EOF'
Du arbeitest im Repo /home/alpha/fuel-dev. Eine Claude-Code-Session naehert
sich gerade einer Context-Kompaktierung. Lies den bisherigen Gespraechs-
verlauf (falls verfuegbar) und aktualisiere GENAU drei Dateien im Repo-
Root, in dieser Reihenfolge:

1. RESULTS.md — Session-Log mit datierten Ergebnis-Bullets. Pruefe zuerst,
   ob fuer heutiges Datum + Thema bereits ein Eintrag existiert (keine
   Duplikate). Falls in dieser Session etwas Substanzielles fertiggestellt
   wurde, das noch nicht dokumentiert ist: neuen Abschnitt am ANFANG der
   Datei (nach der Titelzeile) einfuegen, im bestehenden Format (Prosa-
   Absatz + `**File**`-Bullets fuer konkrete Aenderungen), mit heutigem
   Datum im Format YYYY-MM-DD.

2. TODO.md — NUR anfassen, wenn ein echtes NEUES Makro-Level-Item
   aufgetaucht ist (nicht: was in dieser Session schon erledigt wurde,
   das gehoert nach RESULTS.md). Falls ja: kurzer Absatz anhaengen. Falls
   nein: Datei nicht anfassen.

3. NEXT.md — ERST NACHDEM RESULTS.md aktualisiert ist: notiere was aus
   dieser Session offen geblieben ist (unfertige Teilaufgaben, bekannte
   Baustellen, naechste konkrete Schritte). Bestehende Punkte, die noch
   gueltig sind, nicht loeschen — nur ergaenzen/aktualisieren. Zweck:
   ein anderer Agent soll direkt weiterarbeiten koennen.

Wichtig:
- Nur diese drei Dateien im Repo /home/alpha/fuel-dev anfassen. Keine
  anderen Dateien, kein globales ~/TODO.md o.ae.
- Kein git commit/push — das macht ein separater Hook.
- Wenn nichts Substanzielles passiert ist, veraendere gar nichts.
- Antworte am Ende NUR mit dem Wort: done
EOF
)

claude -p "$PROMPT" --allowedTools "Read,Edit" --dangerously-skip-permissions >/dev/null 2>&1 || true

exit 0
