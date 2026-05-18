import catalogRoute from "./catalog.mjs";
import logRoute from "./log.mjs";
import journalRoute from "./journal.mjs";
import composeRoute from "./compose.mjs";
import dailyRoute from "./daily.mjs";

export default async function nutritionRoute(app) {
  app.register(catalogRoute);
  app.register(logRoute);
  app.register(journalRoute);
  app.register(composeRoute);
  app.register(dailyRoute);
}
