# Omega-3: Schwerpunkt der Mikro-Erkennung

Omega-3 wird als eigenes Fettsäureprofil behandelt. Gute Erkennung heißt: Quelle,
Bezugsmenge und Datenlücken nachvollziehen können. Hohe Summen allein reichen nicht.

## Datenvertrag

Alle Mengen sind mg für die tatsächlich erfasste Portion:

| Feld | Bedeutung |
| --- | --- |
| `omega3_mg` | Omega-3 gesamt; bestehende Werte bleiben erhalten |
| `omega3_ala_mg` | ALA |
| `omega3_epa_mg` | EPA |
| `omega3_dha_mg` | DHA |
| `omega3_dpa_mg` | DPA |
| `omega3_epa_dha_mg` | EPA + DHA, ohne ALA/DPA |

Gesamtsumme und Untergruppen werden getrennt ausgewertet, niemals miteinander
addiert. EPA+DHA wird aus beiden Einzelwerten abgeleitet, wenn beide vorliegen.
Ein Gesamtwert erlaubt keine Aufteilung. Unbekannte Einzelwerte bleiben fehlend;
explizit gemessene/deklarierte Nullwerte bleiben Null.

Die bisherige pauschale 250-mg-Bewertung der Gesamtsumme entfällt. 250 mg/Tag ist
der EFSA-Referenzwert für EPA+DHA bei Erwachsenen, kein Gesamt-Omega-3-Ziel.
Für ALA wird hier kein fixes mg-Ziel erfunden (EFSA verwendet Energieprozent).

## Erkennungsregeln

- Etikett/Hersteller und passende Referenzdaten vor generischer KI-Schätzung.
- Fischöl-/Algenölgewicht, Omega-3 gesamt und EPA/DHA-Anteile unterscheiden.
- Kapselzahl, deklarierte Tagesportion und tatsächlich konsumierte Dosis beachten.
- Pflanzliches ALA nicht in EPA/DHA umrechnen; Algenöl nicht automatisch EPA zuweisen.
- Gramm in Milligramm umrechnen; USDA-Werte ausschließlich mit bekannter Einheit übernehmen.
- Unspezifisches 18:3 und Gesamt-PUFA nicht als gesichertes ALA interpretieren.
- Der USDA-Import erfasst jetzt auch EPA. Die Summe bekannter Spezies kann bei
  lückenhaften Quelldaten nur eine Teilsumme sein.

Die Regeln werden in Text-/Fotoanalyse, Mikro-Nachschätzung und der Recherche
von Zutaten/Supplementen verwendet. Python-Regeln liegen in
`fuel/constants/omega3-rules.txt`; die Browser-Fassung in
`src/shared/config/omega3.mjs` wird durch einen Paritätstest abgesichert.

## Auswertung und Grenzen

Die Wochenansicht zeigt bekannte Mengen und die Zahl der Einträge mit passenden
Detaildaten. Bei fehlenden EPA/DHA-Daten gibt es keine scheinbar vollständige
Prozentbewertung. „Vollständig“ bedeutet Daten für erfasste Einträge, nicht eine
vollständig erfasste Ernährung oder eine Laboranalyse.

Historische Gesamtwerte bleiben Gesamtwerte. Neue SQLite-Detailspalten starten
als unbekannt; alte Tages-/Wochencaches werden für das neue Schema neu berechnet.
Es findet kein KI-Backfill historischer Profile statt. Die bereits gespeicherten
alten Gesamtwerte können weiterhin unzuverlässige Schätzungen enthalten.

Die automatische Erkennung bleibt eine Schätzung. Diese Änderung wurde mit
synthetischen Profilen und gemockten USDA-Antworten geprüft, ohne echte
KI-/OCR-Aufrufe oder Schreibzugriffe auf persönliche Ernährungsdaten.

Weiterer Schwerpunkt: Etikett-/Herstellerbelege pro Fettsäure, Prüfung gegen
Gesamtfett und Omega-3-Gesamtsumme, gezielte Korrektur belegter Fehlprofile.
Kein aus der Nahrungsaufnahme berechneter „Omega-3-Index“ (Blutmesswert).

## Fachliche Quellen

- [NIH ODS: Omega-3 Fatty Acids](https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/)
- [EFSA: Referenzwerte für Fettsäuren](https://doi.org/10.2903/j.efsa.2010.1461)
- [USDA: Foundation Foods Documentation](https://fdc.nal.usda.gov/Foundation_Foods_Documentation/)
