import RecipeBuilder from "./Food/RecipeBuilder.jsx";
import FoodCatalog from "./Food/FoodCatalog.jsx";

export default function FoodView({ activeDate }) {
  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <RecipeBuilder />
        <FoodCatalog activeDate={activeDate} />
      </div>
    </div>
  );
}

