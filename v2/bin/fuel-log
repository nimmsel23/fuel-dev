#!/usr/bin/env zsh
# fuel-log.zsh — Ernährungs-Log CLI
# Same backend as PWA: POST http://localhost:9000/fuel/log

API="http://localhost:9000"
DEVCTL="${0:A:h}/fuel-devctl"

CY=$'\e[36m'; GR=$'\e[32m'; YE=$'\e[33m'; RE=$'\e[31m'; NO=$'\e[0m'

echo ""
echo "${CY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NO}"
echo "${CY}  Ernährungs-Log${NO}"
echo "${CY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NO}"

# Server check via fuel-devctl
if ! "$DEVCTL" status >/dev/null 2>&1; then
  echo "${RE}Server nicht erreichbar (Port 9000)${NO}"
  echo "${CY}Starten: fuel-devctl start${NO}"
  exit 1
fi

# Einträge heute
current=$(http --print b GET "$API/fuel/progress" 2>/dev/null | jq -r '.logs | length // 0')
echo ""
echo "${YE}Einträge heute: $current${NO}"
echo ""

# Datum
datum=$(date +%Y-%m-%d)
print -n "${CY}Datum [$datum]: ${NO}"
read input_datum
[[ -n "$input_datum" ]] && datum="$input_datum"

# Mahlzeit
echo ""
echo "${CY}Mahlzeit:${NO}"
echo "  1) Frühstück  2) Mittagessen  3) Abendessen  4) Snack"
print -n "Auswahl [1]: "
read mz_nr
case "$mz_nr" in
  2) mahlzeit="mittagessen" ;;
  3) mahlzeit="abendessen"  ;;
  4) mahlzeit="snack"       ;;
  *) mahlzeit="frühstück"   ;;
esac

# Speise
echo ""
print -n "${CY}Speise: ${NO}"
read speise
[[ -z "$speise" ]] && speise="Allgemein"

# Makros (optional)
echo ""
echo "${CY}Makros (optional, Enter = überspringen):${NO}"
print -n "  Kalorien [0]: "
read kalorien
[[ -z "$kalorien" ]] && kalorien=0

print -n "  Protein g [0]: "
read protein
[[ -z "$protein" ]] && protein=0

print -n "  Kohlenhydrate g [0]: "
read kohlenhydrate
[[ -z "$kohlenhydrate" ]] && kohlenhydrate=0

print -n "  Fett g [0]: "
read fett
[[ -z "$fett" ]] && fett=0

# Notizen
echo ""
print -n "${CY}Notizen (optional): ${NO}"
read notizen

# JSON sicher via jq bauen (kein String-Escaping-Problem)
payload=$(jq -cn \
  --arg     datum          "$datum" \
  --arg     mahlzeit       "$mahlzeit" \
  --arg     speise         "$speise" \
  --argjson kalorien       "$kalorien" \
  --argjson protein        "$protein" \
  --argjson kohlenhydrate  "$kohlenhydrate" \
  --argjson fett           "$fett" \
  --arg     notizen        "$notizen" \
  '{datum:$datum,mahlzeit:$mahlzeit,speise:$speise,
    kalorien:$kalorien,protein:$protein,
    kohlenhydrate:$kohlenhydrate,fett:$fett,
    notizen:$notizen}')

if ! echo "$payload" | http --check-status --print b POST "$API/fuel/log" Content-Type:application/json >/dev/null 2>&1; then
  echo "${RE}Fehler beim Speichern${NO}"
  exit 1
fi

echo ""
echo "${GR}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NO}"
echo "${GR}Eintrag gespeichert!${NO}"
echo "${GR}$speise — $mahlzeit${NO}"
[[ "$kalorien" != "0" ]] && echo "${GR}${kalorien} kcal | P:${protein}g K:${kohlenhydrate}g F:${fett}g${NO}"
[[ -n "$notizen" ]] && echo "${YE}$notizen${NO}"
echo "${GR}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NO}"
echo "${CY}http://localhost:9000${NO}"
echo ""
