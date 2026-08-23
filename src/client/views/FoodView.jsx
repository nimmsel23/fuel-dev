import RecipeBuilder from "./Food/RecipeBuilder.jsx";
import FoodCatalog from "./Food/FoodCatalog.jsx";

export default function FoodView({ activeDate }) {
  return (
    <div className="space-y-8">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
        <RecipeBuilder />
        <FoodCatalog activeDate={activeDate} />
      </div>
    </div>
  );
}
