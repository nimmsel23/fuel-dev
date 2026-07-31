import { getFastingWindows } from "../../services/fasting.mjs";

export default async function fastingRoute(app) {
  app.get("/nutrition/fasting", async (req, reply) => {
    const days = Math.min(Math.max(parseInt(req.query?.days, 10) || 14, 1), 90);
    const windows = await getFastingWindows(days);
    return reply.send({ ok: true, windows });
  });
}
