import RecipeBuilder from "./RecipeBuilder/RecipeBuilder.jsx";

// Eigener Tab (2026-09-06): Rezept-Builder war vorher in FoodView neben dem
// Katalog eingebettet. Jetzt eigenständige View mit lesbarer Breite.
export default function RecipeBuilderView() {
  return (
    <div className="mx-auto max-w-3xl">
      <RecipeBuilder />
    </div>
  );
}
