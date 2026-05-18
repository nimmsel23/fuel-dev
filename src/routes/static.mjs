import path from "path";
import fs from "fs";
import { PUBLIC_DIR, VITE_BUILD_DIR } from "../config/paths.mjs";
import { serveFile, isPathInStatic } from "../lib/file-io.mjs";
import { VITE_ORIGIN } from "../config/constants.mjs";

export default async function staticRoute(app) {
  // Root — serve V2 React (new default) or proxy to Vite dev
  app.get("/", async (_, reply) => {
    if (VITE_ORIGIN) {
      // Dev mode: proxy to Vite
      return reply.redirect(`${VITE_ORIGIN}/`);
    }
    // Prod mode: serve V2 from dist/
    const v2IndexPath = path.join(VITE_BUILD_DIR, "index.html");
    await serveFile(v2IndexPath, reply);
  });

  // V2 legacy redirect (backward compat)
  app.get("/v2", async (req, reply) => {
    reply.redirect("/");
  });

  app.get("/v2/*", async (request, reply) => {
    // Redirect /v2/* to /* (e.g. /v2/assets/foo.js → /assets/foo.js)
    const pathname = request.url.slice(3); // Remove /v2 prefix
    reply.redirect(pathname);
  });

  // Legacy V1 — vanilla HTML access
  app.get("/legacy", async (_, reply) => {
    const v1IndexPath = path.join(PUBLIC_DIR, "index.html");
    await serveFile(v1IndexPath, reply);
  });

  // Legacy V1 assets
  app.get("/legacy/*", async (request, reply) => {
    let pathname = request.url.slice(7); // Remove /legacy prefix
    let filePath = path.join(PUBLIC_DIR, pathname);

    if (!isPathInStatic(filePath)) {
      return reply.status(403).send("Forbidden");
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      await serveFile(filePath, reply);
    } else {
      reply.status(404).send("Not found");
    }
  });

  // V2 assets (from dist/)
  app.get("/assets/*", async (req, reply) => {
    let pathname = req.url.split("?")[0];
    let filePath = path.join(VITE_BUILD_DIR, pathname);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      await serveFile(filePath, reply);
    } else {
      reply.status(404).send("Not found");
    }
  });

  // V2 manifest & SW
  app.get("/manifest.webmanifest", async (_, reply) => {
    const filePath = path.join(VITE_BUILD_DIR, "manifest.webmanifest");
    if (fs.existsSync(filePath)) {
      await serveFile(filePath, reply);
    } else {
      reply.status(404).send("Not found");
    }
  });

  app.get("/registerSW.js", async (_, reply) => {
    const filePath = path.join(VITE_BUILD_DIR, "registerSW.js");
    if (fs.existsSync(filePath)) {
      await serveFile(filePath, reply);
    } else {
      reply.status(404).send("Not found");
    }
  });

  // Catch-all: serve other static assets from public/ (fonts, etc)
  app.get("/*", async (req, reply) => {
    let pathname = req.url.split("?")[0];

    // In dev mode (VITE_ORIGIN set): proxy everything else to Vite
    if (VITE_ORIGIN && !pathname.startsWith("/api/") && !pathname.startsWith("/health")) {
      return reply.redirect(`${VITE_ORIGIN}${pathname}`);
    }

    let filePath = path.join(PUBLIC_DIR, pathname);

    if (!isPathInStatic(filePath)) {
      return reply.status(403).send("Forbidden");
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      await serveFile(filePath, reply);
    } else {
      reply.status(404).send("Not found");
    }
  });
}
