import Fastify from "fastify";
import cors from "@fastify/cors";
import { PORT, HOST } from "./config/constants.mjs";
import { initializePaths } from "./config/paths.mjs";
import { normalizeRoutedPath } from "./lib/validation.mjs";

// Routes
import healthRoute from "./routes/health.mjs";
import nutritionRoute from "./routes/nutrition.mjs";
import staticRoute from "./routes/static.mjs";

export function createApp() {
  // Initialize data directories
  initializePaths();

  const app = Fastify({ logger: true });

  // CORS
  app.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
  });

  // Path normalization hook (handles /c/<clientId>/ prefixes)
  app.addHook("preHandler", (req, _reply, done) => {
    req.routedPath = normalizeRoutedPath(req.url.split("?")[0], req);
    done();
  });

  // Register routes (specific first, catch-all last)
  app.register(healthRoute);
  app.register(nutritionRoute);
  app.register(staticRoute); // Catch-all

  // Error handler
  app.setErrorHandler((error, _request, reply) => {
    console.error(error);
    reply.status(500).send({ ok: false, error: "Internal server error" });
  });

  return app;
}

export async function startServer() {
  const app = createApp();
  await app.listen({ port: PORT, host: HOST });
  console.log(`🍽️  Fuel Centre running on http://${HOST}:${PORT}`);
}
