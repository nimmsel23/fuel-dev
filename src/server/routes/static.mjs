import path from "path";
import fastifyStatic from "@fastify/static";
import { PUBLIC_DIR, VITE_BUILD_DIR } from "../config/paths.mjs";
import { VITE_ORIGIN } from "../../shared/config/constants.mjs";

export default async function staticRoute(app) {
  // 1. Dev Mode: Proxy to Vite
  if (VITE_ORIGIN) {
    app.log.info(`[static] Dev mode active, proxying frontend to ${VITE_ORIGIN}`);
    
    // Redirect root
    app.get("/", async (_, reply) => {
      return reply.redirect(`${VITE_ORIGIN}/`);
    });

    // Proxy everything else that isn't handled by other routes
    app.get("/*", async (req, reply) => {
      const pathname = req.url.split("?")[0];
      // Only proxy if it looks like a frontend request (assets, or not an API call)
      // This is a safety net; better to just let it fall through if possible.
      return reply.redirect(`${VITE_ORIGIN}${req.url}`);
    });
    return;
  }

  // 2. Production Mode: Serve dist/
  app.log.info(`[static] Production mode, serving from ${VITE_BUILD_DIR}`);

  // Register dist/ for V2 Assets
  app.register(fastifyStatic, {
    root: VITE_BUILD_DIR,
    prefix: "/",
    wildcard: true,
    index: "index.html",
  });

  // Legacy V1 (if specifically requested)
  app.get("/legacy", async (_, reply) => {
    return reply.sendFile("index.html", PUBLIC_DIR);
  });

  app.register(fastifyStatic, {
    root: PUBLIC_DIR,
    prefix: "/legacy/",
    decorateReply: false, // only one static plugin can decorate reply
  });

  // SPA Fallback: Serve index.html for all non-file requests
  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith("/api") || req.url.startsWith("/nutrition") || req.url.startsWith("/supplements")) {
      return reply.status(404).send({ ok: false, error: "API route not found" });
    }
    return reply.sendFile("index.html", VITE_BUILD_DIR);
  });
}
