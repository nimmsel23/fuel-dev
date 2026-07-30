# `.agent/architecture/FUEL_SCOUT.md`

## Rolle

Diese Datei ergänzt die allgemeine `SCOUT.md` um Fuel-spezifische Regeln.

Der Scout untersucht die Fuel-App **read-only**.

Er soll vor Änderungen verstehen:

* welche Datenquellen Fuel verwendet,
* welche Domain-Logik bereits existiert,
* wie Local Mode und Firestore Mode zusammenhängen,
* wo Berechnungen stattfinden,
* welche Daten persistiert und welche nur zur Laufzeit erzeugt werden,
* welche Teile Standalone-Fuel gehören,
* welche Teile VitalOS nur konsumieren oder anders darstellen soll.

Keinen Code ändern.

---

# 1. Fuel Domain

Fuel umfasst insbesondere:

```text
Food / Ingredients
Meals / Recipes
Food Logging
Macros
Micronutrients
Supplements
Nutrition Targets
Profile-derived calculations
Nutrition History
Reminders
```

Fuel besitzt diese Domain.

VitalOS darf Fuel-Daten und Fuel-Komponenten konsumieren, soll aber keine parallele Nutrition-Engine aufbauen.

Grundregel:

```text
Fuel owns nutrition logic.
VitalOS owns composition.
```

---

# 2. Runtime-Modell

Fuel kann grundsätzlich in mehreren Modi laufen:

```text
Standalone + Local
Standalone + Firestore
VitalOS + Firestore
```

Der Scout soll bei relevanten Tasks feststellen, welche Pfade tatsächlich existieren.

Nicht automatisch davon ausgehen, dass Local und Cloud dieselbe Implementierung verwenden.

---

# 3. Datenquellen zuerst bestimmen

Vor jeder Fuel-Aufgabe prüfen:

```text
Woher kommen die Daten?
```

Mögliche Quellen:

* Firestore
* lokale API
* lokale SQLite/MariaDB/andere DB
* JSON/YAML Catalog
* LocalStorage
* IndexedDB
* externe Nutrition API
* AI-generierte Daten
* statische Defaults

Der Scout soll den echten Datenfluss rekonstruieren.

---

# 4. Source-of-Truth-Prinzip

Für jedes untersuchte Konzept feststellen, was aktuell die Source of Truth ist.

Beispiele:

```text
Ingredient nutrition
→ Catalog?

Logged meal
→ Firestore log?

Macros
→ calculated live or persisted?

Micros
→ catalog-derived or AI-derived?

Supplements
→ shared catalog or per-user entry?
```

Wenn mehrere Quellen dieselbe Information besitzen:

```text
WARN: possible divergence
```

---

# 5. Food / Ingredient Catalog

Bei Food-bezogenen Tasks prüfen:

* ID-System
* Name / aliases
* serving size
* per-100g Werte
* Makros
* Micros
* Units
* Sources
* Versionierung
* manuelle vs. importierte Daten

Besonders auf doppelte oder widersprüchliche Food-Einträge achten.

---

# 6. Units

Nutrition-Bugs sind häufig Unit-Bugs.

Der Scout soll prüfen, ob Nutrients zentral definierte Einheiten besitzen.

Typische Einheiten:

```text
kcal
g
mg
µg
ml
IU
```

Besonders kritisch:

```text
Omega-3
Omega-6
Vitamin D
Vitamin B12
Folate
Selenium
Iodine
Boron
```

Suchen nach:

```text
value * 1000
value / 1000
per100g
serving
portion
amount
quantity
grams
```

---

# 7. Unknown vs Zero

Prüfen, ob fehlende Nährstoffdaten fälschlich als `0` behandelt werden.

Unterscheiden:

```text
0
= confirmed none / negligible

null / undefined
= unknown / unavailable
```

Problematische Patterns markieren:

```js
nutrient || 0
```

wenn dadurch Datenqualität verloren geht.

---

# 8. Meal-Modell

Bei Meal-Aufgaben untersuchen:

```text
Meal
├── ingredients
├── quantities
├── macros?
├── micros?
├── cachedNutrition?
└── version?
```

Feststellen:

* Ist ein Meal nur eine Recipe Definition?
* Speichert es berechnete Nutrition?
* Wird Nutrition jedes Mal neu berechnet?
* Können Mengen skaliert werden?
* Werden Änderungen historisch berücksichtigt?

---

# 9. Logged Meal ≠ Meal Definition

Der Scout soll explizit prüfen, ob Fuel zwischen:

```text
Meal Definition
```

und:

```text
Consumed / Logged Meal
```

unterscheidet.

Ein historischer Log sollte nicht unbeabsichtigt seine Nutrition ändern, nur weil später das zugrunde liegende Meal oder Catalog-Food geändert wurde.

Wenn Logs aktuelle Meal-Daten live auflösen:

```text
WARN: historical nutrition may mutate
```

---

# 10. Nutrition Calculation

Finde die zentrale Berechnungslogik.

Gesucht werden Funktionen wie:

```text
calculateNutrition
calculateMacros
calculateMicros
aggregateNutrients
sumNutrition
scaleNutrition
mealNutrition
dailyTotals
weeklyTotals
```

Prüfen:

* gibt es eine zentrale Engine?
* existieren mehrere Implementierungen?
* berechnet die UI selbst?
* rechnet Local anders als Firestore?
* rechnet VitalOS nochmals separat?

---

# 11. Bevorzugtes Domain-Modell

Bei Architektur-Tasks gegen dieses Zielbild vergleichen:

```text
Ingredient Catalog
      ↓
Nutrition Engine
      ↓
Meal cached nutrition
      ↓
Logged nutrition snapshot
      ↓
Daily aggregate
      ↓
Weekly / Monthly presentation
```

Der Scout soll nicht automatisch verlangen, dass dieses Modell implementiert wird.

Er soll nur dokumentieren, wo die aktuelle Architektur davon abweicht.

---

# 12. Macros

Bei Macro-Aufgaben prüfen:

* kcal
* protein
* carbs
* fats
* optional fiber / sugar etc.

Zusätzlich prüfen:

```text
Sind Targets manuell?
oder
werden sie aus Profilwerten berechnet?
```

Bei Auto-Macro-Berechnung relevante Inputs suchen:

```text
body weight
height
age
sex
activity
goal
training load
```

Keine neuen Gesundheitsformeln erfinden.

Nur bestehende Implementation dokumentieren.

---

# 13. User Profile

Fuel-spezifische Profileinstellungen nicht unnötig duplizieren.

Der Scout soll prüfen, ob Informationen bereits global vorhanden sind.

Beispiele:

```text
height
weight
age
goal
```

Wenn Fuel dieselben Werte nochmals separat speichert:

```text
WARN: duplicated user profile state
```

---

# 14. Micronutrients

Bei Micros untersuchen:

* welche Nutrients unterstützt werden,
* wie Werte gespeichert werden,
* wie Werte aggregiert werden,
* welche Reference Targets verwendet werden,
* welche Nutrients unvollständige Daten besitzen,
* ob Wochenwerte live oder materialisiert entstehen.

Die detaillierte Micros-Prüfung kann zusätzlich `FUEL_MICROS_SCOUT.md` verwenden.

---

# 15. Supplements

Bei Supplement-Aufgaben untersuchen:

```text
Supplement Catalog
→ Product
→ Serving
→ Nutrient composition
→ User usage/logging
```

Unterscheiden:

```text
Supplement definition
```

von:

```text
Supplement intake/log
```

Prüfen, ob Supplement-Nutrients in dieselbe Nutrition Engine einfließen wie Food-Nutrients.

---

# 16. Supplements + Micros

Besonders prüfen:

```text
Food nutrients
+
Supplement nutrients
=
Daily nutrient total?
```

Falls Supplements separat ausgewertet werden, dokumentieren.

Eine doppelte Berechnung vermeiden:

```text
Micros Tab adds supplements
+
daily aggregate already contains supplements
```

---

# 17. AI / Gemini Integration

Bei AI-generierten Nutrition-/Supplementdaten besonders kritisch sein.

AI-Ausgabe ist keine vertrauenswürdige Nutrition Source of Truth ohne Validierung.

Prüfen:

```text
Prompt
→ response
→ parser
→ validation
→ normalization
→ persisted catalog entry
```

Besonders auf Folgendes achten:

* Markdown statt JSON
* leere Antworten
* falsche Units
* fehlende Nutrients
* erfundene Werte
* unterschiedliche Feldnamen
* unvalidiertes Persistieren

---

# 18. Push / Reminder Settings

Fuel-spezifische Reminder sollen semantisch in den passenden Bereich gehören.

Beispiele:

```text
Micros reminder
→ Micros

Supplement reminder
→ Supplements

Meal logging reminder
→ Logging / Fuel
```

Der Scout soll prüfen, ob Reminder-Settings aktuell im Setup oder an einer fachlich falschen Stelle liegen.

Push-Infrastruktur selbst gehört zur gemeinsamen Firebase/VitalOS-Infrastruktur und soll nicht für Fuel neu erfunden werden.

---

# 19. Firestore

Bei Firestore-Aufgaben dokumentieren:

```text
collection path
document id
readers
writers
relevant fields
```

Keine Pfade erfinden.

Besonders prüfen:

* Meals
* Logs
* Supplements
* Settings
* Aggregates
* Catalog references

---

# 20. Firestore Aggregate Strategy

Wenn Views viele Daten neu berechnen, prüfen, ob bereits Aggregates existieren.

Beispiele:

```text
dailyNutrition
dailyMacros
dailyMicros
weeklySummary
```

Wenn keine existieren:

nur dokumentieren.

Nicht automatisch neue Collections anlegen.

---

# 21. Local Mode

Fuel Standalone kann lokale Datenstrukturen besitzen.

Der Scout soll vergleichen:

```text
Local adapter
vs.
Firestore adapter
```

Ideal:

```text
same domain objects
same calculation engine
different persistence adapter
```

Problematisch:

```text
Local calculates nutrition one way
Firestore calculates it another way
```

---

# 22. VitalOS Integration

Fuel darf innerhalb VitalOS anders aussehen als Standalone.

Das ist beabsichtigt.

Beispiel:

```text
Standalone Fuel
= mobile portal with multiple dedicated tabs

VitalOS Fuel
= compact rich workspace
```

Aber:

```text
same Meal
same Micros
same Macro total
same Supplement data
```

müssen fachlich dieselben Ergebnisse liefern.

---

# 23. Standalone UI vs Shell UI

Legitime Divergenz:

```text
Standalone:
compact mobile meal logger

VitalOS:
larger dashboard / inspector
```

Verdächtige Divergenz:

```text
Standalone:
2300 kcal

VitalOS:
2670 kcal
```

bei denselben zugrunde liegenden Logs.

---

# 24. Performance

Bei langsamen Fuel-Views prüfen:

* Anzahl Firestore Reads
* wiederholte Catalog-Lookups
* wiederholte Nutrition-Berechnungen
* Berechnung bei jedem Render
* N+1 Queries
* unnötige API Calls
* fehlende Caches
* große Dokumente

Nicht nur UI-Performance untersuchen.

---

# 25. Historical Integrity

Bei Änderungen an Nutrition-Daten prüfen:

```text
Ändert sich dadurch rückwirkend die Vergangenheit?
```

Beispiel:

Catalog Omega-3 Wert wird korrigiert.

Frage:

```text
Soll ein Meal von vor 3 Monaten automatisch neu berechnet werden?
```

Wenn aktuelle Architektur dies unbeabsichtigt tut:

dokumentieren.

---

# 26. Calculation Versioning

Prüfen, ob berechnete Daten erkennen lassen:

```text
welche Engine-Version
welcher Catalog-Stand
welcher Zeitpunkt
```

Mögliche Felder:

```text
calculationVersion
nutritionVersion
catalogVersion
calculatedAt
sourceVersion
```

Nur bestehende Felder dokumentieren.

---

# 27. Data Provenance

Bei kritischen Nutrient-Werten nach Möglichkeit herausfinden:

```text
Woher stammt dieser Wert?
```

Mögliche Quellen:

```text
manual
manufacturer
USDA
external API
AI estimate
derived
fallback
```

Wenn Provenance verloren geht, als Datenqualitätsproblem markieren.

---

# 28. Typische Fuel Anti-Patterns

Markieren, wenn gefunden:

## UI-owned calculation

```text
MicrosTab calculates complete nutrition during render
```

## Duplicate engines

```text
Macros and Micros use unrelated scaling logic
```

## Catalog mutation affecting history

```text
old logs resolve live catalog values
```

## Unknown becomes zero

```text
boron ?? 0
```

## Unit ambiguity

```text
omega3: 1.4
```

ohne definierte Einheit.

## Local / Firestore divergence

gleicher Meal-Log liefert unterschiedliche Nutrition.

## Shell duplication

VitalOS berechnet Fuel-Domain nochmals selbst.

## AI as silent truth

AI-generierte Nutrient-Werte werden ohne Validierung gespeichert.

---

# 29. Scout Output

Für eine Fuel-Task soll `context.md` mindestens enthalten:

````md
# <TASK-ID>

## Domain

Fuel area:
Owner repo:

## Runtime

- Standalone + Local:
- Standalone + Firestore:
- VitalOS + Firestore:

## Current Flow

```text
source
→ repository
→ domain
→ calculation
→ UI
````

## Relevant Files

* `path` — reason

## Relevant Symbols

* `symbol()`

## Persistence

Firestore/local structures involved.

## Calculation

Wo und wann wird gerechnet?

## Source of Truth

Welche Daten gelten aktuell als kanonisch?

## Divergences

Local / Firestore / VitalOS / duplicated calculations.

## Data Quality Risks

Units, missing data, AI values, mapping etc.

## Facts

* ...

## Hypotheses

* ...
* Confidence: low / medium / high

## Best Next Inspection

1.
2.
3.

````

---

# 30. Scout-Regel

Bei Fuel gilt besonders:

```text
Do not fix the number first.
Find where the number came from.
````

Bei einem falschen Wert immer rückwärts verfolgen:

```text
UI
→ aggregate
→ log
→ meal
→ ingredient
→ catalog
→ source
```

Erst danach kann entschieden werden, ob der Fehler:

```text
data
mapping
unit
calculation
aggregation
cache
presentation
```

betrifft.

---

# 31. Ziel

Der Scout soll aus:

```text
"Die Micros sehen falsch aus."
```

etwas machen wie:

```text
MicrosTab calls aggregateWeeklyMicros() on mount.

aggregateWeeklyMicros()
loads all meal logs for seven days.

Each log resolves its meal definition live.

Each meal resolves current ingredient catalog values.

Omega-3 is normalized in normalizeNutrients().

Käsleberkäsesemmel resolves to catalog item X.

Catalog item X contains omega3 = Y with unit Z.

No persisted daily aggregate exists.

Local and Firestore use different catalog adapters.

Highest-value inspection:
normalizeNutrients(), meal resolution and catalog item X.
```

Dann hat der Fuel Scout seine Aufgabe erfüllt.
