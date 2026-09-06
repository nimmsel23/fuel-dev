# RESULTS — fuel-dev

Session-Log mit datierten Ergebnis-Bullets.

## 2026-09-06

- Rezept-Builder aus `FoodView` herausgelöst: Komponente nach
  `src/client/views/RecipeBuilder/RecipeBuilder.jsx` verschoben, neue
  `src/client/views/RecipeBuilderView.jsx`, eigener Tab `recipes` ("Rezepte",
  ChefHat) in `routes.js`.
- Katalog zusätzlich als eigene View + Tab: `src/client/views/CatalogView.jsx`,
  Tab `catalog` ("Katalog", Library) in `routes.js`. `FoodCatalog` bleibt
  weiterhin auch in `FoodView` eingebunden.
- `build:local` + `build:cloud` grün.
- Header-Nav-Pills: wrappen statt scrollen (via Subagent, `main.jsx`).
- Repo-eigene `NEXT.md` / `RESULTS.md` angelegt.
