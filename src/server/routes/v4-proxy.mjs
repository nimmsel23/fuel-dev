// v3 (dieser Node-Server) → v4 (Python/FastAPI-Backend, lokal, kein Cloud-Deploy).
// Reine Erreichbarkeits-Route für die Migration (Strangler-Fig) — kein
// gemeinsamer Datenlayer, v4 bleibt bei seiner eigenen Postgres-Anbindung.
const V4_TARGET = process.env.FUEL_V4_URL || "http://127.0.0.1:4000";

export default async function v4ProxyRoute(app) {
  app.all("/v4/*", async (req, reply) => {
    const targetPath = req.url.replace(/^\/v4/, "") || "/";
    const targetUrl = `${V4_TARGET}${targetPath}`;

    try {
      const res = await fetch(targetUrl, {
        method: req.method,
        headers: { "content-type": req.headers["content-type"] || "application/json" },
        body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body ?? {}),
      });
      const text = await res.text();
      reply.code(res.status);
      const contentType = res.headers.get("content-type");
      if (contentType) reply.header("content-type", contentType);
      return text;
    } catch (err) {
      reply.code(502);
      return { error: "v4 backend nicht erreichbar", detail: err.message };
    }
  });
}
