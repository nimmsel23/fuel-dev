import { pushFuelFrame, getFuelFrames } from "../../lib/firestore-admin.mjs";

// Fuel-Frame-Snapshots (unveränderliche Anamnese-Stände, siehe
// FuelProfile.jsx "Frame abschließen") laufen im Coach-Channel über die
// Firestore-Admin-Verbindung, es gibt keinen lokalen Dateispeicher dafür —
// ohne konfiguriertes FUEL_CLOUD_UID läuft dieser Endpoint ins Leere
// (pushFuelFrame/getFuelFrames sind dann no-ops, siehe firestore-admin.mjs).
export default async function framesRoute(app) {
  app.post("/nutrition/frame", async (req, reply) => {
    const frame = req.body?.frame;
    if (!frame || typeof frame !== "object") {
      return reply.status(400).send({ ok: false, error: "frame required" });
    }
    const result = await pushFuelFrame(frame);
    if (!result) {
      return reply.status(503).send({ ok: false, error: "Firestore sync not configured" });
    }
    return reply.send({ ok: true, ...result });
  });

  app.get("/nutrition/frames", async (req, reply) => {
    const limitCount = Math.min(Math.max(parseInt(req.query?.limit, 10) || 20, 1), 100);
    const frames = await getFuelFrames(limitCount);
    return reply.send({ ok: true, frames });
  });
}
