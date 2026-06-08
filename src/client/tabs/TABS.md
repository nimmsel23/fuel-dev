# Tab-System

Jeder Tab ist ein eigenständiges Modul unter `src/client/tabs/`.

## Struktur

```
tabs/
├── index.jsx        Sammelt alle Tabs als geordnetes Array → TAB_CONFIG
├── dashboard.jsx
├── food.jsx
├── calendar.jsx
├── journal.jsx
├── supplements.jsx
├── micros.jsx
└── settings.jsx
```

## Tab-Modul Interface

Jede Tab-Datei exportiert ein Default-Objekt:

```js
export default {
  key: "food",               // eindeutiger String-Key, URL-freundlich
  label: "Food",             // Anzeige-Label in der Navigation
  Icon: UtensilsCrossed,     // Lucide-Icon-Komponente
  View: lazy(() => import("../views/FoodView.jsx")),  // lazy-geladene View
  getProps: (ctx) => ({      // Props-Mapping aus App-Kontext
    activeDate: ctx.activeDate,
    setActiveDate: ctx.setActiveDate,
    nutrition: ctx.nutrition,
  }),
};
```

### Verfügbare `ctx`-Felder

| Feld | Typ | Quelle |
|------|-----|--------|
| `activeDate` | `string` (ISO) | Zustand (store) |
| `setActiveDate` | `fn` | Zustand (store) |
| `nutrition` | `object` | `useNutritionData(activeDate)` |
| `sup` | `object` | `useSuppStats(activeDate)` |
| `suppCatalog` | `array` | `useSuppCatalog()` |
| `suppLog` | `object` | `useSuppLog(activeDate)` |
| `journal` | `string` | `useJournal(activeDate)` |
| `macroTrend` | `array` | `useMacroTrend(activeDate)` |

## Neuen Tab hinzufügen

1. Datei anlegen: `src/client/tabs/mein-tab.jsx`
2. Default-Export mit `key`, `label`, `Icon`, `View`, `getProps`
3. In `index.jsx` importieren und ins Array eintragen

```js
// index.jsx
import meinTab from "./mein-tab.jsx";
export const TAB_CONFIG = [..., meinTab];
```

Sonst nichts. `TabContent.jsx` und `main.jsx` bleiben unberührt.

## Wie es zusammenspielt

```
main.jsx
  └─ TAB_CONFIG  (Nav-Rendering: key, label, Icon)
  └─ TabContent
       └─ tab.View        (lazy-geladen via Suspense)
       └─ tab.getProps(ctx)  (Props-Mapping, lebt im Tab-Modul selbst)
```

`TabContent.jsx` hat kein Tab-Wissen — es ruft nur `tab.getProps(ctx)` auf und rendert `<View {...props} />`.
