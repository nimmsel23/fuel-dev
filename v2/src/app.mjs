import Fastify from "fastify";
import cors from "@fastify/cors";
import { PORT, HOST } from "./config/constants.mjs";
import { initializePaths } from "./config/paths.mjs";
import { normalizeRoutedPath } from "./lib/validation.mjs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PYTHON_FIRESTORE_HANDLER = join(ROOT, "fuel-firestore.py");

// Routes
import healthRoute from "./routes/health.mjs";
import nutritionRoute from "./routes/nutrition/index.mjs";
import supplementsRoute from "./routes/supplements.mjs";
import supplementEstimateRoute from "./routes/supplement-estimate.mjs";
import fuelRoute from "./routes/fuel.mjs";
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

  // Spawn Python firestore handler as a child process
  const firestoreProcess = spawn("python3", [PYTHON_FIRESTORE_HANDLER, "--port", "9011"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  firestoreProcess.stdout.on("data", (data) => process.stdout.write(`[fuel-firestore-py] ${data}`));
  firestoreProcess.stderr.on("data", (data) => process.stderr.write(`[fuel-firestore-py] ${data}`));
  firestoreProcess.on("error", (err) => console.error(`[fuel-firestore-py] Error: ${err.message}`));
  firestoreProcess.on("close", (code) => console.log(`[fuel-firestore-py] exited with code ${code}`));

  // Proxy requests to the Python firestore handler
  app.all("/api/fuel-firestore/*", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      let uid = "default"; // Fallback UID
      if (authHeader && authHeader.startsWith("Bearer ")) {
        // Hier müsste die UID aus dem JWT extrahiert werden
        // Für den Moment nehmen wir einen Platzhalter
        uid = "authenticated-user"; 
        // Realistisch müsste hier eine JWT-Validierung stattfinden
        // und die UID aus dem Token gelesen werden.
      }
      
      const response = await fetch(`http://127.0.0.1:9011${request.url}`, {
        method: request.method,
        headers: { 
          ...request.headers,
          "X-Fuel-UID": uid // UID an Python Handler weitergeben
        },
        body: request.body,
      });
      reply.status(response.status).send(await response.json());
    } catch (error) {
      console.error("[fuel-firestore-proxy] Error:", error);
      reply.status(500).send({ ok: false, error: "Firestore proxy error" });
    }
  });

  // Register routes (specific first, catch-all last)
  app.register(healthRoute);
  app.register(nutritionRoute);
  app.register(supplementsRoute);
  app.register(supplementEstimateRoute);
  app.register(fuelRoute);
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
  
  // One-time sync on startup
  const uid = process.env.MY_FIREBASE_UID;
  if (uid && uid !== "YOUR_FIREBASE_UID_HERE") {
    console.log(`[initial-sync] Starte Sync für UID: ${uid}...`);
    try {
      await fetch(`http://127.0.0.1:9011/api/fuel-firestore/ping`, {
        method: "POST",
        headers: { "X-Fuel-UID": uid },
      });
    } catch (e) {
      console.error(`[initial-sync] Fehler:`, e.message);
    }
  } else {
    console.warn("[initial-sync] MY_FIREBASE_UID nicht in .env gesetzt. Überspringe initialen Sync.");
  }
}