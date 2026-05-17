import path from "path";
import fs from "fs";
import { PUBLIC_DIR } from "../config/paths.mjs";
import { serveFile } from "../lib/file-io.mjs";

export default async function staticRoute(app) {
  // Root — serve vanilla HTML (V1 classic)
  app.get("/", async (_, reply) => {
    const publicIndexPath = path.join(PUBLIC_DIR, "index.html");
    await serveFile(publicIndexPath, reply);
  });

  // V2 — proxy to Vite dev server if available
  app.get("/v2*", async (req, reply) => {
    const viteOrigin = process.env.FUEL_VITE_ORIGIN;
    if (viteOrigin) {
      // Dev: proxy to Vite
      const targetUrl = new URL(req.url, viteOrigin);
      try {
        const proxyRes = await fetch(targetUrl.toString(), { method: req.method });
        reply.status(proxyRes.status);
        for (const [key, value] of proxyRes.headers) {
          reply.header(key, value);
        }
        reply.send(await proxyRes.text());
      } catch (error) {
        console.error("Vite proxy error:", error.message);
        reply.status(502).send("Vite dev server unavailable");
      }
    } else {
      reply.status(404).send("V2 app not available");
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
