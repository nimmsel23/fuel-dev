Für deinen Fall ist das **Best-Case-Design nicht „Micros beim Öffnen des Tabs neu berechnen“**, sondern:

**Meal/Food-Log = Source of Truth → daraus einmal Micros berechnen → Ergebnis materialisieren → Tages-/Wochenwerte inkrementell fortschreiben.**

Firestore selbst eignet sich gut für so ein hierarchisches Modell aus kleinen Dokumenten und Subcollections; Firebase empfiehlt bei wachsenden Datensätzen eher Subcollections statt immer größere verschachtelte Dokumente. Für Aggregationen ist Write-Time-Materialisierung ausdrücklich ein sinnvoller Ansatz, wenn Ergebnisse schnell abrufbar sein sollen. ([Firebase][1])

## Mein bevorzugtes Modell

Ich würde vier Ebenen unterscheiden:

```text
FOOD CATALOG
    ↓
MEAL DEFINITION
    ↓
FOOD LOG / CONSUMPTION EVENT
    ↓
MATERIALIZED NUTRIENT TOTALS
```

Nicht alles vermischen.

### 1. Ingredient/Food Catalog

Das ist dein fachlicher Ursprung:

```text
fuel/catalog/foods/{foodId}
```

Beispiel:

```js
{
  name: "Käsleberkäsesemmel",
  source: "manual",
  nutrientsPer100g: {
    kcal: 310,
    protein_g: 13,
    fat_g: 22,
    carbs_g: 20,

    calcium_mg: 120,
    iron_mg: 1.5,
    magnesium_mg: 18,

    omega3_g: 0.08,
    omega6_g: 1.4,

    boron_mg: null
  },

  nutrientDataVersion: 3,
  updatedAt: ...
}
```

Wichtig dabei: **`null` ist etwas anderes als `0`.**

Wenn du bei Bor keine Daten hast:

```js
boron_mg: null
```

nicht:

```js
boron_mg: 0
```

Sonst behauptet dein System fachlich: „Dieses Lebensmittel enthält garantiert kein Bor“, obwohl die Wahrheit nur lautet: „kein Wert vorhanden“.

Das ist wahrscheinlich eine der Ursachen, die du bei solchen absurden Omega-3-Ergebnissen suchen solltest: Source-Werte, Fallbacks, Einheiten oder Food-Mappings.

---

# 2. Meal als wiederverwendbare Definition

Ein Meal sollte nicht jedes Mal nur ein Name sein.

Beispiel:

```text
fuel/{uid}/meals/{mealId}
```

```js
{
  name: "5 Eier + Reis + Gemüse",

  ingredients: [
    {
      foodId: "egg_free_range",
      amount_g: 300
    },
    {
      foodId: "rice_parboiled",
      amount_g: 200
    },
    {
      foodId: "mixed_vegetables",
      amount_g: 250
    }
  ]
}
```

Und jetzt kommt der wichtige Teil:

```js
{
  cachedNutrition: {
    macros: {...},
    micros: {...}
  },

  calculation: {
    version: 4,
    calculatedAt: ...,
    foodDataVersions: {
      egg_free_range: 7,
      rice_parboiled: 2,
      mixed_vegetables: 4
    }
  }
}
```

Das bedeutet:

> Ein Meal wird einmal aus seinen Ingredients berechnet und speichert danach sein Nutrition Snapshot.

Wenn du dieses Meal morgen wieder isst, brauchst du nicht wieder durch 40–80 Nutrient-Felder × alle Ingredients zu rechnen.

---

# 3. Food Log speichert einen Snapshot

Das ist meiner Meinung nach für deinen Tracker besonders wichtig.

Wenn du heute um 16:00 ein Meal loggst:

```text
fuel/{uid}/logs/2026-07-29_1600_xyz
```

sollte das Dokument nicht nur enthalten:

```js
{
  mealId: "meal123",
  amount: 1
}
```

sondern idealerweise:

```js
{
  date: "2026-07-29",
  mealId: "meal123",
  mealName: "5 Eier + Reis + Gemüse",

  quantity: 1,

  nutrition: {
    macros: {
      kcal: 1240,
      protein_g: 63,
      carbs_g: 150,
      fat_g: 42
    },

    micros: {
      calcium_mg: 640,
      magnesium_mg: 310,
      iron_mg: 9.2,
      zinc_mg: 8.3,
      omega3_g: 1.1,
      boron_mg: 0.9
    }
  },

  nutritionVersion: 4,
  loggedAt: ...
}
```

Das ist ein **historischer Nutrition Snapshot**.

Warum ich das besser finde als später immer Meal → Ingredients → Catalog neu aufzulösen:

Wenn du in zwei Monaten den Nährwert von:

```text
egg_free_range
```

korrigierst, soll dein Essen vom 29. Juli nicht plötzlich rückwirkend andere Werte haben — zumindest nicht ohne bewusste Recalculation.

Du bekommst damit echte Datenhistorie.

---

# 4. Tagesaggregation

Beim Loggen eines Foods/Meals aktualisierst du zusätzlich:

```text
fuel/{uid}/dailyNutrition/2026-07-29
```

Beispiel:

```js
{
  macros: {
    kcal: 2450,
    protein_g: 142,
    carbs_g: 271,
    fat_g: 91
  },

  micros: {
    calcium_mg: 930,
    magnesium_mg: 412,
    iron_mg: 14.2,
    zinc_mg: 13.1,

    omega3_g: 1.35,
    omega6_g: 11.7,

    boron_mg: 1.8
  },

  logCount: 7,

  calculatedAt: ...,
  calculationVersion: 4
}
```

Dann macht dein Micros Tab für „Heute“ nur:

```text
1 Firestore document read
```

statt:

```text
alle Logs
→ alle Meals
→ alle Ingredients
→ alle Food Catalog entries
→ alle Nutrients
→ berechnen
→ aufsummieren
```

Das ist der eigentliche Gewinn.

Firestore beschreibt genau diesen Trade-off bei Write-Time-Aggregationen: etwas mehr Arbeit beim Schreiben, dafür stehen aggregierte Ergebnisse unmittelbar zum Lesen bereit. ([Firebase][2])

---

# 5. Wochenwerte würde ich NICHT zwingend dauerhaft speichern

Hier wird es interessant.

Du hast bereits:

```text
dailyNutrition/
├── 2026-07-27
├── 2026-07-28
├── 2026-07-29
...
```

Für deine Wochenansicht musst du dann nur sieben kleine Dokumente laden:

```text
7 days × ~all micronutrients
```

und lokal summieren.

Das ist völlig trivial.

Ich würde deshalb **zunächst keine zweite `weeklyNutrition` Source of Truth einführen**.

Also:

```text
logs
 ↓
dailyNutrition     ← materialisiert
 ↓
weekly UI          ← summiert 7 daily docs
```

Das vermeidet:

```text
Logs stimmen
Daily stimmt
Weekly stimmt nicht
```

Noch eine zusätzliche Synchronisationsebene wäre unnötig.

---

# Der Sweet Spot für dich

Ich würde also genau **zwei Aggregationsstufen** haben:

```text
Meal
  ↓ calculate once
cached meal nutrition

Logged Meal
  ↓ snapshot
log.nutrition

Daily
  ↓ incremental aggregate
dailyNutrition

Weekly
  ↓ cheap read-time sum of 7 docs
Frontend
```

Das ist für eine einzelne PWA/User-Datenmenge extrem komfortabel.

---

# LocalStorage würde ich nur als Cache verwenden

Ich würde **nicht** sagen:

> LocalStorage ist die primäre Micros-Datenbank.

Sondern:

```text
Firestore = persisted truth
Local cache = acceleration/offline UX
```

Zum Beispiel:

```js
localStorage["fuel:dailyNutrition:2026-07-29"]
```

kann das Daily-Dokument spiegeln.

Aber Firestore sollte entscheiden, welches Aggregat aktuell ist.

Noch besser, falls du ohnehin den normalen Firestore Web SDK verwendest: Firestore selbst unterstützt Client-/Offline-Caching, sodass du nicht zwingend eine zweite handgebaute LocalStorage-Datenhaltung brauchst. Die Datenmodellierung sollte davon unabhängig bleiben. ([Firebase][1])

---

# Sehr wichtig: Versioniere die Berechnung

Bei dir würde ich unbedingt sowas einführen:

```js
calculationVersion: 4
nutrientDatabaseVersion: 12
```

Denn deine Nutrition Engine wird sich definitiv noch ändern.

Heute findest du vielleicht heraus:

> „Omega-3 bei Käsleberkäse war falsch.“

Morgen:

> „Mikrogramm wurden als Milligramm behandelt.“

Übermorgen:

> „Ein Ingredient-Mapping zeigte auf den falschen Food Catalog Record.“

Dann kannst du erkennen:

```text
dailyNutrition calculationVersion 2
```

ist veraltet und muss recalculated werden.

Ohne Versionierung weißt du später nicht mehr, welche Werte mit welcher Engine entstanden sind.

---

# Noch besser: Provenance pro Nutrient

Gerade weil du **Bor und andere eher schlecht dokumentierte Mikronährstoffe** berechnest, würde ich deine Datenqualität sichtbar machen.

Zum Beispiel pro Catalog Food:

```js
nutrients: {
  omega3_g: {
    value: 0.08,
    source: "USDA",
    confidence: "high"
  },

  boron_mg: {
    value: 0.21,
    source: "estimated",
    confidence: "low"
  }
}
```

Oder kompakter:

```js
nutrients: {...}

nutrientMeta: {
  omega3_g: {
    source: "USDA",
    confidence: "high"
  },
  boron_mg: {
    source: "estimate",
    confidence: "low"
  }
}
```

Denn eine Zahl wie:

```text
Bor: 2.7 mg
```

sieht im Micros-Tab sonst genauso vertrauenswürdig aus wie:

```text
Calcium: 934 mg
```

obwohl die Datenqualität komplett unterschiedlich sein kann.

Das halte ich für deinen Tracker sogar für wichtiger als irgendeine Firebase-Optimierung.

---

# Und unbedingt Einheiten kanonisieren

Das wäre einer meiner ersten Scout-Aufträge für dein Omega-3-Problem.

Intern beispielsweise immer:

```text
Energy      kcal
Protein     g
Fat         g
Carbs       g

Omega-3     mg
Omega-6     mg

Calcium     mg
Magnesium   mg
Iron        mg
Zinc        mg

Vitamin D   µg
Vitamin B12 µg

Boron       mg
```

Oder alles intern sogar auf:

```text
grams / milligrams / micrograms
```

mit fixer Definition pro Nutrient-ID.

Nicht irgendwo:

```text
omega3 = 1.3
```

ohne zu wissen:

```text
1.3 g?
1.3 mg?
1.3 %?
1.3 per serving?
1.3 per 100 g?
```

Das ist der klassische Ursprung völlig falscher Nutrition-Ausgaben.

---

# Updates werden interessant

Angenommen:

```text
Meal A = Reis + Huhn
```

wird geloggt.

Daily enthält:

```text
protein = 80
iron = 6
...
```

Dann änderst du Meal A später.

Das darf **den alten Log nicht verändern**.

Deshalb:

```text
Meal Definition
≠
Logged Meal Snapshot
```

Ganz wichtig.

Wenn du dagegen einen **bestehenden heutigen Log editierst**, beispielsweise:

```text
200g Reis → 300g Reis
```

dann:

```text
old nutrition snapshot
       ↓ subtract from daily
calculate new snapshot
       ↓ add to daily
save log
```

Also Delta-Update:

```text
dailyNew = dailyOld - oldLogNutrition + newLogNutrition
```

Dadurch musst du nicht den ganzen Tag neu berechnen.

---

# Delete genauso

Food Log löschen:

```text
dailyNutrition -= deletedLog.nutrition
```

Meal hinzufügen:

```text
dailyNutrition += newLog.nutrition
```

Meal ändern:

```text
dailyNutrition += new - old
```

Das ist der sauberste inkrementelle Ansatz.

Diese Write-Time-Aggregationen sollten idempotent bzw. robust gegen Retries gebaut werden; Firebase empfiehlt für eventgetriebene Functions ausdrücklich idempotente Implementierungen. ([Firebase][3])

---

# Client oder Backend berechnen?

Für dein konkretes Projekt sehe ich drei Szenarien.

| Variante | Berechnung                          | Einschätzung                             |
| -------- | ----------------------------------- | ---------------------------------------- |
| A        | komplett Client                     | gut für aktuellen Single-User-/PWA-Stand |
| B        | Client + Firestore Aggregates       | **mein Favorit jetzt**                   |
| C        | Cloud Function als Nutrition Engine | später interessant                       |

### B würde ich jetzt nehmen.

Der Flow:

```text
User logs meal
      ↓
Fuel domain service
      ↓
calculateMealNutrition()
      ↓
Firestore transaction / batch
      ├── log snapshot
      └── dailyNutrition delta
```

Standalone Local Mode:

```text
same calculateMealNutrition()
      ↓
local DB / runtime
```

VitalOS/Firebase:

```text
same domain calculation
      ↓
Firestore
```

Damit hast du wieder genau dein gewünschtes Architekturprinzip:

> **eine Nutrition Engine, mehrere Runtime-Adapter.**

Nicht:

```text
MicrosTab berechnet Micros
MealEditor berechnet Micros anders
Local API berechnet Micros nochmal
VitalOS berechnet sie nochmal
```

---

# Idealstruktur in Firestore

Ich würde ungefähr das hier anstreben:

```text
fuel/{uid}

├── settings/
│   └── nutrition
│
├── meals/
│   └── {mealId}
│       ├── ingredients
│       ├── cachedMacros
│       ├── cachedMicros
│       └── calculationVersion
│
├── logs/
│   └── {logId}
│       ├── date
│       ├── mealId
│       ├── quantity
│       ├── nutrition.macros
│       ├── nutrition.micros
│       └── calculationVersion
│
└── dailyNutrition/
    ├── 2026-07-28
    └── 2026-07-29
```

Food Catalog separat, wenn global/shared:

```text
nutritionCatalog/
└── foods/
    └── {foodId}
```

oder in deiner bestehenden Catalog-Struktur.

Für wachsende Listen wie Logs sind Subcollections genau das typische Firestore-Modell; große immer weiter wachsende Arrays in einem einzigen User-Dokument würde ich vermeiden. ([Firebase][4])

---

## Was der Micros Tab danach macht

Er wird fast schon langweilig — und das ist gut:

```text
MicrosTab
   ↓
query dailyNutrition last 7 days
   ↓
7 documents
   ↓
sum each nutrient
   ↓
compare against weekly targets
   ↓
table
```

Keine Ingredient-Auflösung.

Keine Meal-Auflösung.

Keine Nutrient-Datenbank.

Keine komplizierte Berechnung beim Rendern.

**Die View rendert nur Daten.**

---

## Und die Käsleberkäsesemmel?

Die würde ich als separaten Datenqualitäts-Bug behandeln.

Wenn sie plötzlich auffällige Mengen Omega-3 liefert, muss dein Scout den Weg rückwärts verfolgen:

```text
Micros table
→ dailyNutrition
→ logged nutrition snapshot
→ meal calculation
→ ingredient(s)
→ food catalog value
→ source / unit
```

Und gerade deshalb ist das materialisierte Modell sogar besser: Du kannst dann exakt feststellen **welcher Schritt den falschen Wert produziert hat**, statt bei jedem Öffnen des Tabs einen frisch berechneten, flüchtigen Wert zu sehen.

Mein Best-Case für Fuel wäre daher:

```text
Catalog = nutritional facts
Meal = reusable recipe + cached calculation
Log = immutable-ish consumption snapshot
DailyNutrition = materialized aggregate
Week = sum of seven days
MicrosTab = dumb presentation layer
```

Das ist für deine PWA simpel genug, aber schon sauber genug, dass du später Makros, sämtliche Micros, Supplements und sogar Datenqualitäts-/Source-Angaben darauf aufbauen kannst. ([Firebase][1])

[1]: https://firebase.google.com/docs/firestore/data-model?utm_source=chatgpt.com "Cloud Firestore Data model  |  Firebase"
[2]: https://firebase.google.com/docs/firestore/solutions/aggregation?hl=en&utm_source=chatgpt.com "Write-time aggregations  |  Firestore  |  Firebase"
[3]: https://firebase.google.com/docs/functions/tips?utm_source=chatgpt.com "Tips & tricks  |  Cloud Functions for Firebase"
[4]: https://firebase.google.com/docs/firestore/manage-data/structure-data?utm_source=chatgpt.com "Choose a data structure  |  Firestore  |  Firebase"
