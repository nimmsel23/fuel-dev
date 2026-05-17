import path from "path";
import fs from "fs";
import { PUBLIC_DIR, VITE_BUILD_DIR } from "../config/paths.mjs";
import { serveFile, isPathInStatic } from "../lib/file-io.mjs";
import { VITE_ORIGIN } from "../config/constants.mjs";

export default async function staticRoute(app) {
  // Root — serve vanilla HTML (V1 classic)
  app.get("/", async (_, reply) => {
    const publicIndexPath = path.join(PUBLIC_DIR, "index.html");
    await serveFile(publicIndexPath, reply);
  });

  // V2 redirect (no slash)
  app.get("/v2", async (req, reply) => {
    if (VITE_ORIGIN) {
      return reply.redirect(`${VITE_ORIGIN}/v2/`);
    }
    reply.redirect("/v2/");
  });

  // V2 — proxy to Vite dev server or serve from dist/
  app.get("/v2/*", async (req, reply) => {
    // Dev mode: always proxy to Vite
    if (VITE_ORIGIN) {
      return reply.redirect(`${VITE_ORIGIN}${req.url}`);
    }

    // Prod mode: serve from dist/ (no fallback — let assets 404 if missing)
    let pathname = req.url.split("?")[0];
    let filePath = path.join(VITE_BUILD_DIR, pathname);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      await serveFile(filePath, reply);
    } else {
      reply.status(404).send("Not found");
    }
  });

  // Static files (V1, assets, etc)
  app.get("/*", async (req, reply) => {
    let pathname = req.url.split("?")[0];
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
