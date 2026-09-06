import FoodCatalog from "./Food/FoodCatalog.jsx";

// Eigener Tab (2026-09-06): Katalog ist zusätzlich zur Einbindung in FoodView
// als eigenständige View erreichbar. Der Food-Verlauf (unkuratierte Inbox)
// bleibt bewusst nur im Food-Tab — hier nur der reine Gerichte-Katalog.
export default function CatalogView({ activeDate }) {
  return (
    <div className="space-y-8">
      <FoodCatalog activeDate={activeDate} showHistory={false} />
    </div>
  );
}
