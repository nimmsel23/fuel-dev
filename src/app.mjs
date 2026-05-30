import Fastify from "fastify";
import cors from "@fastify/cors";
import { PORT, HOST } from "./config/constants.mjs";
import { initializePaths } from "./config/paths.mjs";
import { normalizeRoutedPath } from "./lib/validation.mjs";
import { readFileSync } from "fs";
import yaml from "js-yaml";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Import all route handlers
import healthRoute from "./routes/health.mjs";
import nutritionRoute from "./routes/nutrition/index.mjs";
import supplementsRoute from "./routes/supplements.mjs";
import supplementEstimateRoute from "./routes/supplement-estimate.mjs";
import fuelRoute from "./routes/fuel.mjs";
import staticRoute from "./routes/static.mjs";

// Mapping of handler names to imported modules
const HANDLER_MAP = {
  healthRoute,
  nutritionRoute, // Assumes nutritionRoute is an object like { getLog, addLog }
  supplementsRoute, // Assumes supplementsRoute is an object like { getCatalog, addLog }
  supplementEstimateRoute, // Assumes supplementEstimateRoute is an object like { estimate, saveToCatalog }
  fuelRoute,
  staticRoute,
};


export function createApp() {
  // Initialize data directories
  initializePaths();

  const app = Fastify({ logger: true });

  // CORS
  app.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], // Erweitere um alle Methoden, die evtl. von der Bridge kommen
    credentials: false,
  });

  // Path normalization hook (handles /c/<clientId>/ prefixes)
  app.addHook("preHandler", (req, _reply, done) => {
    req.routedPath = normalizeRoutedPath(req.url.split("?")[0], req);
    done();
  });

  // Dynamisches Laden der Routen aus fuel_routes.yaml
  try {
    const routesYamlPath = join(__dirname, "..", "fuel_routes.yaml");
    const routesConfig = yaml.load(readFileSync(routesYamlPath, "utf8"));

    for (const route of routesConfig.routes) {
      const handlerPath = route.handler.split(".");
      let handler = HANDLER_MAP[handlerPath[0]];

      if (!handler) {
        throw new Error(`Route handler module not found: ${handlerPath[0]}`);
      }

      if (handlerPath.length > 1) {
        handler = handler[handlerPath[1]];
        if (!handler) {
          throw new Error(`Route handler function not found: ${route.handler}`);
        }
      }

      // Fastify route registration
      if (route.method === "*") {
        app.all(route.path, handler);
      } else {
        app[route.method.toLowerCase()](route.path, handler);
      }
      app.log.info(`Registered route: ${route.method} ${route.path} -> ${route.handler}`);
    }
  } catch (error) {
    app.log.error("Fehler beim Laden der Routen aus fuel_routes.yaml:", error);
    process.exit(1);
  }

  // Error handler
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    reply.status(500).send({ ok: false, error: "Internal server error" });
  });

  return app;
}

const SYNC_PULL_URL = process.env.FUEL_FIRESTORE_PING_URL || "http://127.0.0.1:9080/api/fuel-firestore/ping";

async function pullFromFirestoreOnStart() {
  try {
    const r = await fetch(SYNC_PULL_URL, { method: "POST", signal: AbortSignal.timeout(5000) });
    const body = await r.json();
    if (body.ok) {
      console.log("[fuel-firestore] startup pull ok:", JSON.stringify(body));
    } else {
      console.warn("[fuel-firestore] startup pull warn:", body.error);
    }
  } catch (e) {
    console.warn("[fuel-firestore] startup pull unreachable:", e.message);
  }
}


export async function startServer() {
  const app = createApp();
  await app.listen({ port: PORT, host: HOST });
  console.log(`🍽️  Fuel Centre running on http://${HOST}:${PORT}`);
  pullFromFirestoreOnStart();
}