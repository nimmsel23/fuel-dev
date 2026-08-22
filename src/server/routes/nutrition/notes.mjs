import { z } from "zod";
import { readEntry, writeEntry, listEntries } from "../../services/nutrition-notes.mjs";
import { isISODate, todayISO } from "../../../shared/utils/validation.mjs";

const journalSchema = z.object({
  date: z.string().optional(),
  content: z.string().optional(),
});

export default async function journalRoute(app) {
  const getNotes = async (req, reply) => {
    const date = (req.query.date || todayISO()).toString();
    if (!isISODate(date)) {
      return reply.status(400).send({ ok: false, error: "Invalid date" });
    }
    const content = readEntry(date);
    return reply.send({ ok: true, date, content });
  };

  const postNotes = async (req, reply) => {
    try {
      const parsed = journalSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return reply.status(400).send({ ok: false, error: "Invalid data" });
      }
      const date = (parsed.data.date || todayISO()).toString();
      if (!isISODate(date)) {
        return reply.status(400).send({ ok: false, error: "Invalid date" });
      }
      writeEntry(date, parsed.data.content || "");
      return reply.send({ ok: true, date });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ ok: false, error: "Internal server error" });
    }
  };

  // Historisch hieß das hier /nutrition/journal, der Client fragt aber
  // längst /nutrition/notes an. Beide Pfade bleiben gültig.
  app.get("/nutrition/journal", getNotes);
  app.get("/nutrition/notes", getNotes);

  app.post("/nutrition/journal", postNotes);
  app.post("/nutrition/notes", postNotes);

  // GET /nutrition/journal/list
  app.get("/nutrition/journal/list", async (req, reply) => {
    const entries = listEntries();
    return reply.send({ ok: true, entries });
  });
}
