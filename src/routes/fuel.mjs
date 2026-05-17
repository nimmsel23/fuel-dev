import { z } from "zod";
import { loadLog, saveLog, addEntry } from "../services/fuel-log.mjs";
import { isISODate, todayISO } from "../lib/validation.mjs";

const logPostSchema = z.object({
  datum: z.string().optional(),
  mahlzeit: z.string().min(1),
  speise: z.string().min(1),
  kalorien: z.coerce.number().min(0).default(0),
  protein: z.coerce.number().min(0).default(0),
  kohlenhydrate: z.coerce.number().min(0).default(0),
  fett: z.coerce.number().min(0).default(0),
  notizen: z.string().default(""),
});

export default async function fuelRoute(app) {
  // GET /fuel/log?date=YYYY-MM-DD
  app.get("/fuel/log", async (req, reply) => {
    const date = (req.query.date || todayISO()).toString();
    if (!isISODate(date)) {
      return reply.status(400).send({ ok: false, error: "Invalid date" });
    }
    const log = loadLog(date);
    return reply.send({ ok: true, datum: date, entries: log.entries || [] });
  });

  // POST /fuel/log
  app.post("/fuel/log", async (req, reply) => {
    try {
      const parsed = logPostSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return reply.status(400).send({ ok: false, error: "Invalid data" });
      }

      const date = (parsed.data.datum || todayISO()).toString();
      if (!isISODate(date)) {
        return reply.status(400).send({ ok: false, error: "Invalid date" });
      }

      const log = loadLog(date);
      const entry = addEntry(log, parsed.data);

      if (!entry) {
        return reply.status(400).send({ ok: false, error: "Invalid entry" });
      }

      saveLog(log);
      return reply.send({ ok: true, entry });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ ok: false, error: "Internal server error" });
    }
  });
}
