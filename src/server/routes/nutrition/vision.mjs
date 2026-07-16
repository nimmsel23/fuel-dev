export default async function visionRoute(app) {
  app.post("/nutrition/vision", async (req, reply) => {
    try {
      const response = await fetch("http://127.0.0.1:9050/nutrition/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
      });
      
      if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
      }
      
      const data = await response.json();
      return data;
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ ok: false, error: e.message });
    }
  });
}
