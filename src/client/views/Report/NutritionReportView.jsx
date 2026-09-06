import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Printer } from "lucide-react";
import { fetchJson } from "@api";

// Ernährungsprotokoll-Report — deckt die FFA-Pflichtaufgabe „7 Tage
// Makronutrient-Protokoll" (Ernährungstrainer, Task 1), das „14 Tage
// Diät-Protokoll" (Task 19) und die Fitnesstrainer-Zusatzaufgabe
// „Ernährungsprotokoll erstellen" (Task 147) aus derselben Datengrundlage ab.
//
// Anforderung lt. Aufgabenstellung: alle Nahrungsmittel + Getränke tabellarisch,
// gruppiert nach Vormittag / Nachmittag / Abend, mit KH-/Fett-/Eiweiß-Anteilen
// und Gesamtkalorien pro Tag. Ausgabe: weißes Blatt am Bildschirm, per Druck
// (Strg+P / „PDF speichern") als abgabefertiges Dokument.

const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const NAME_STORAGE_KEY = "fuel-report-name";

const SLOTS = [
  { key: "vormittag", label: "Vormittag", hint: "bis 12:00 Uhr" },
  { key: "nachmittag", label: "Nachmittag", hint: "12:00 – 17:00 Uhr" },
  { key: "abend", label: "Abend", hint: "ab 17:00 Uhr" },
];

const TYPE_TO_SLOT = { breakfast: "vormittag", lunch: "nachmittag", dinner: "abend", snack: "nachmittag" };

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function shiftIso(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoRange(fromIso, toIso) {
  if (fromIso > toIso) return [];
  const out = [];
  let cur = fromIso;
  // harte Obergrenze gegen versehentliche Riesen-Zeiträume
  for (let i = 0; i < 400 && cur <= toIso; i++) {
    out.push(cur);
    cur = shiftIso(cur, 1);
  }
  return out;
}

function fmtDE(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return `${DAY_NAMES[d.getDay()]}, ${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
}

function hhmm(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function slotForMeal(meal) {
  if (meal.time) {
    const d = new Date(meal.time);
    if (!Number.isNaN(d.getTime())) {
      const h = d.getHours();
      if (h < 12) return "vormittag";
      if (h < 17) return "nachmittag";
      return "abend";
    }
  }
  return TYPE_TO_SLOT[meal.type] || "nachmittag";
}

const n1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
const n0 = (v) => Math.round(Number(v) || 0);

function macroSplit({ protein, carbs, fat }) {
  const pK = (Number(protein) || 0) * 4;
  const cK = (Number(carbs) || 0) * 4;
  const fK = (Number(fat) || 0) * 9;
  const sum = pK + cK + fK;
  if (sum <= 0) return { protein: 0, carbs: 0, fat: 0 };
  return {
    protein: Math.round((pK / sum) * 100),
    carbs: Math.round((cK / sum) * 100),
    fat: Math.round((fK / sum) * 100),
  };
}

function sumMeals(meals) {
  return (meals || []).reduce(
    (acc, m) => ({
      kcal: acc.kcal + (Number(m.kcal) || 0),
      protein: acc.protein + (Number(m.protein) || 0),
      carbs: acc.carbs + (Number(m.carbs) || 0),
      fat: acc.fat + (Number(m.fat) || 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

function MacroCells({ totals }) {
  return (
    <>
      <td className="num">{n0(totals.kcal)}</td>
      <td className="num">{n1(totals.carbs)}</td>
      <td className="num">{n1(totals.fat)}</td>
      <td className="num">{n1(totals.protein)}</td>
    </>
  );
}

function DayBlock({ iso, log }) {
  const meals = log?.meals || [];
  const dayTotals = sumMeals(meals);
  const split = macroSplit(dayTotals);

  return (
    <section className="report-day" style={{ marginTop: 18 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>{fmtDE(iso)}</h3>

      {meals.length === 0 ? (
        <p style={{ margin: 0, fontStyle: "italic", color: "#6b7280" }}>Keine Einträge protokolliert.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: "9%" }}>Zeit</th>
              <th>Nahrungsmittel / Getränk</th>
              <th className="num" style={{ width: "11%" }}>kcal</th>
              <th className="num" style={{ width: "11%" }}>KH&nbsp;(g)</th>
              <th className="num" style={{ width: "11%" }}>Fett&nbsp;(g)</th>
              <th className="num" style={{ width: "11%" }}>EW&nbsp;(g)</th>
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((slot) => {
              const slotMeals = meals
                .filter((m) => slotForMeal(m) === slot.key)
                .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
              if (slotMeals.length === 0) return null;
              const slotTotals = sumMeals(slotMeals);
              return (
                <Fragment key={slot.key}>
                  <tr>
                    <td colSpan={6} style={{ background: "#f0f2f5", fontWeight: 600 }}>
                      {slot.label} <span style={{ fontWeight: 400, color: "#6b7280" }}>({slot.hint})</span>
                    </td>
                  </tr>
                  {slotMeals.map((m) => (
                    <tr key={m.id || `${m.description}-${m.time}`}>
                      <td>{hhmm(m.time)}</td>
                      <td>
                        {m.description}
                        {m.notes ? <span style={{ color: "#6b7280" }}> — {m.notes}</span> : null}
                      </td>
                      <td className="num">{n0(m.kcal)}</td>
                      <td className="num">{n1(m.carbs)}</td>
                      <td className="num">{n1(m.fat)}</td>
                      <td className="num">{n1(m.protein)}</td>
                    </tr>
                  ))}
                  <tr className="slot-subtotal">
                    <td colSpan={2}>Zwischensumme {slot.label}</td>
                    <MacroCells totals={slotTotals} />
                  </tr>
                </Fragment>
              );
            })}
            <tr className="day-total">
              <td colSpan={2}>Gesamt {fmtDE(iso).split(",")[1]?.trim() || iso}</td>
              <MacroCells totals={dayTotals} />
            </tr>
          </tbody>
        </table>
      )}

      {meals.length > 0 && (
        <p style={{ margin: "4px 0 0", color: "#374151" }}>
          Gesamtkalorien: <strong>{n0(dayTotals.kcal)} kcal</strong> · Makro-Verteilung (energetisch):
          {" "}KH {split.carbs}&nbsp;% · Fett {split.fat}&nbsp;% · Eiweiß {split.protein}&nbsp;%
          {log?.water_ml ? <> · Wasser {n0(log.water_ml)} ml</> : null}
        </p>
      )}
    </section>
  );
}

export default function NutritionReportView() {
  const [preset, setPreset] = useState("14");
  const [toIso, setToIso] = useState(isoToday());
  const [fromIso, setFromIso] = useState(shiftIso(isoToday(), -13));
  const [name, setName] = useState(() => {
    try { return localStorage.getItem(NAME_STORAGE_KEY) || ""; } catch { return ""; }
  });

  const { data, isLoading } = useQuery({
    queryKey: ["nutrition-history", "report"],
    queryFn: () => fetchJson("/nutrition/history?limit=180"),
  });

  const logsByDate = useMemo(() => {
    const map = {};
    for (const log of data?.history || []) map[log.date] = log;
    return map;
  }, [data]);

  const applyPreset = (value) => {
    setPreset(value);
    if (value === "7" || value === "14") {
      const today = isoToday();
      setToIso(today);
      setFromIso(shiftIso(today, -(Number(value) - 1)));
    }
  };

  const setName_ = (v) => {
    setName(v);
    try { localStorage.setItem(NAME_STORAGE_KEY, v); } catch { /* ignore */ }
  };

  const dates = useMemo(() => isoRange(fromIso, toIso), [fromIso, toIso]);
  const dayCount = dates.length;

  const summary = useMemo(() => {
    const loggedDates = dates.filter((d) => (logsByDate[d]?.meals || []).length > 0);
    const totals = loggedDates.reduce(
      (acc, d) => {
        const t = sumMeals(logsByDate[d].meals);
        return {
          kcal: acc.kcal + t.kcal,
          protein: acc.protein + t.protein,
          carbs: acc.carbs + t.carbs,
          fat: acc.fat + t.fat,
        };
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    );
    const n = loggedDates.length || 1;
    const avg = { kcal: totals.kcal / n, protein: totals.protein / n, carbs: totals.carbs / n, fat: totals.fat / n };
    return { loggedCount: loggedDates.length, avg, split: macroSplit(avg) };
  }, [dates, logsByDate]);

  return (
    <div className="space-y-6">
      {/* Bedienung — nicht Teil der Druckausgabe */}
      <div className="no-print rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-orange-300" />
          <div>
            <h2 className="text-xl font-bold tracking-tight">Ernährungsprotokoll</h2>
            <p className="text-sm text-slate-400">
              Abgabefertiges Protokoll für die FFA-Aufgaben (7 / 14 Tage). Zeitraum wählen, dann drucken bzw. als PDF speichern.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label className="grid gap-1 text-sm text-slate-300">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Zeitraum</span>
            <div className="flex gap-2">
              {[["7", "7 Tage"], ["14", "14 Tage"], ["custom", "Frei"]].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => applyPreset(v)}
                  className={
                    "rounded-full border px-3 py-1.5 text-sm transition " +
                    (preset === v
                      ? "border-orange-400/40 bg-orange-400 text-slate-950"
                      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10")
                  }
                >
                  {l}
                </button>
              ))}
            </div>
          </label>

          <label className="grid gap-1 text-sm text-slate-300">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Von</span>
            <input
              type="date"
              value={fromIso}
              max={toIso}
              onChange={(e) => { setPreset("custom"); setFromIso(e.target.value); }}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="grid gap-1 text-sm text-slate-300">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Bis</span>
            <input
              type="date"
              value={toIso}
              min={fromIso}
              onChange={(e) => { setPreset("custom"); setToIso(e.target.value); }}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-slate-100"
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-300 flex-1 min-w-[200px]">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Name (auf dem Protokoll)</span>
            <input
              type="text"
              value={name}
              placeholder="Vor- und Nachname"
              onChange={(e) => setName_(e.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-slate-100"
            />
          </label>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full border border-orange-400/40 bg-orange-400 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-orange-300 transition"
          >
            <Printer className="h-4 w-4" />
            Drucken / als PDF
          </button>
        </div>

        <p className="text-xs text-slate-500">
          {dayCount} Kalendertage im Zeitraum · {summary.loggedCount} Tage mit Einträgen.
          Tage ohne Protokoll werden im Dokument als „Keine Einträge" ausgewiesen.
        </p>
      </div>

      {/* Das Blatt */}
      <div className="report-sheet mx-auto max-w-[820px] rounded-2xl p-10 shadow-glow">
        {isLoading ? (
          <p style={{ fontStyle: "italic", color: "#6b7280" }}>Daten werden geladen…</p>
        ) : (
          <>
            <header style={{ borderBottom: "2px solid #14181f", paddingBottom: 10, marginBottom: 12 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Ernährungsprotokoll</h1>
              <table style={{ marginTop: 10, border: "none" }}>
                <tbody>
                  <tr>
                    <td style={{ border: "none", padding: "2px 8px 2px 0", fontWeight: 600, width: 120 }}>Name</td>
                    <td style={{ border: "none", padding: "2px 0" }}>{name || "—"}</td>
                  </tr>
                  <tr>
                    <td style={{ border: "none", padding: "2px 8px 2px 0", fontWeight: 600 }}>Zeitraum</td>
                    <td style={{ border: "none", padding: "2px 0" }}>
                      {fmtDE(fromIso)} – {fmtDE(toIso)} ({dayCount} Tage)
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: "none", padding: "2px 8px 2px 0", fontWeight: 600 }}>Erhebung</td>
                    <td style={{ border: "none", padding: "2px 0" }}>
                      Selbstprotokoll mit Fuel Centre. Makronährwerte je Eintrag aus hinterlegtem
                      Lebensmittel-Katalog bzw. Schätzung (Open Food Facts / KI-Schätzung).
                    </td>
                  </tr>
                </tbody>
              </table>
            </header>

            <section style={{ marginBottom: 4 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 6px" }}>Auswertung (Durchschnitt der protokollierten Tage)</h2>
              <table>
                <thead>
                  <tr>
                    <th>Kennzahl</th>
                    <th className="num">Ø / Tag</th>
                    <th className="num">energetischer Anteil</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Gesamtenergie</td><td className="num">{n0(summary.avg.kcal)} kcal</td><td className="num">100 %</td></tr>
                  <tr><td>Kohlenhydrate</td><td className="num">{n1(summary.avg.carbs)} g</td><td className="num">{summary.split.carbs} %</td></tr>
                  <tr><td>Fett</td><td className="num">{n1(summary.avg.fat)} g</td><td className="num">{summary.split.fat} %</td></tr>
                  <tr><td>Eiweiß</td><td className="num">{n1(summary.avg.protein)} g</td><td className="num">{summary.split.protein} %</td></tr>
                </tbody>
              </table>
              <p style={{ margin: "4px 0 0", color: "#6b7280" }}>
                Grundlage: {summary.loggedCount} von {dayCount} Tagen mit Einträgen.
              </p>
            </section>

            {dates.map((iso, i) => (
              <div key={iso} className={i > 0 && i % 3 === 0 ? "report-page-break" : undefined}>
                <DayBlock iso={iso} log={logsByDate[iso]} />
              </div>
            ))}

            <footer style={{ marginTop: 24, paddingTop: 8, borderTop: "1px solid #c8ccd4", color: "#6b7280" }}>
              Erstellt am {fmtDE(isoToday())} · Fuel Centre
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
