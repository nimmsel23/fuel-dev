import { useState, useEffect } from "react";
import { Compass, Loader2 } from "lucide-react";
import * as db from "../../lib/db.firestore.js";

// FuelFrameMap — echte Frame Map nach AlphaOS-Vorbild (~/aos/game/gas-frame-map):
// 5 feste Reflexionsfragen, aber nur die Domain "Fuel" statt aller vier
// (Body/Being/Balance/Business) — sonst explodiert dem Klienten der Kopf.
// KEINE Profil-Felder hier (die gehören zu FuelProfile.jsx) — Frame ist
// kein Ersatzname für Profil, sondern ein eigenständiges Reflexions-Tool.
// Kein Snapshot-Verlauf, ein aktueller Stand, direkt gegen Firestore
// (users/{uid}/meta/fuelFrame) — bewusst losgelöst vom lokalen
// Settings-Store/Sync-System.
const FIELDS = [
  { key: "whereNow", label: "Wo stehe ich aktuell mit meiner Ernährung?" },
  { key: "howGotHere", label: "Wie bin ich hierher gekommen?" },
  { key: "howFeel", label: "Wie fühle ich mich dabei?" },
  { key: "whatWorking", label: "Was funktioniert?" },
  { key: "whatNotWorking", label: "Was funktioniert nicht?" },
];

const inputCls = "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100";
const labelCls = "text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 block";

export default function FuelFrameMap({ sectionCls }) {
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!db.getUidOrNull?.()) { setLoaded(true); return; }
    db.getFuelFrame().then((data) => {
      if (data) setAnswers(data);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  async function handleChange(key, value) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (!db.getUidOrNull?.()) return;
    setSaving(true);
    try {
      await db.saveFuelFrame(next);
    } catch (e) {
      console.error("FuelFrameMap save failed:", e);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <section className={sectionCls}>
      <div className="flex items-center gap-2 mb-1">
        <Compass className="h-5 w-5 text-amber-300" />
        <h2 className="text-lg font-semibold">Fuel Frame</h2>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />}
      </div>
      <div className="grid gap-3">
        {FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label className={labelCls}>{label}</label>
            <textarea
              rows={2}
              value={answers[key] || ""}
              onChange={(e) => handleChange(key, e.target.value)}
              className={inputCls}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
