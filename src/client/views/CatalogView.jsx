import FoodCatalog from "./Food/FoodCatalog.jsx";

// Eigener Tab (2026-09-06): Katalog ist zusätzlich zur Einbindung in FoodView
// als eigenständige View erreichbar.
export default function CatalogView({ activeDate }) {
  return (
    <div className="space-y-8">
      <FoodCatalog activeDate={activeDate} />
    </div>
  );
}
