import FoodCatalog from "./Food/FoodCatalog.jsx";

// Rezept-Builder ist seit 2026-09-06 ein eigener Tab (RecipeBuilderView.jsx).
export default function FoodView({ activeDate }) {
  return (
    <div className="space-y-8">
      <FoodCatalog activeDate={activeDate} />
    </div>
  );
}
