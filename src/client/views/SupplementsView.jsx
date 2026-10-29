import { useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Pill, Plus } from "lucide-react";
import WeeklyTracker from "./Supplements/WeeklyTracker.jsx";
import DailyChecklist from "./Supplements/DailyChecklist.jsx";
import QuickLog from "./Supplements/QuickLog.jsx";
import SupplementLogger from "./Supplements/SupplementLogger.jsx";
import TodayStack from "./Supplements/TodayStack.jsx";
import StatsCard from "./Supplements/StatsCard.jsx";
import CatalogCard from "./Supplements/CatalogCard.jsx";
import SupplementEditor from "./Supplements/SupplementEditor.jsx";
import { routineProgress, isDueToday } from "./Supplements/utils.js";
import { useQueryClient } from "@tanstack/react-query";

import ReminderSettings from "./Supplements/ReminderSettings.jsx";
const TABS = [["routine", "Tagesroutine"], ["week", "Wochentracker"], ["log", "Einnahmen"], ["catalog", "Mein Katalog"], ["insights", "Auswertung"], ...(import.meta.env.VITE_SOLO === "supplements" ? [["reminders", "Erinnerungen"]] : [])];

export default function SupplementsView({ date, sup, catalog = [], suppLog, onDateChange }) {
  const [tab, setTab] = useState("routine");
  const [adding, setAdding] = useState(false);
  const qc = useQueryClient();
  const stats = sup?.stats || [];
  const intakes = suppLog?.intakes || [];
  const progress = routineProgress(catalog, intakes, date);

  return (
    <section className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl border border-lime-300/20 bg-gradient-to-br from-lime-400/15 via-emerald-400/5 to-slate-950 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-lime-300"><Pill className="h-4 w-4" /> Deine Routine</p>
            <h2 className="text-2xl font-semibold sm:text-3xl">Kleine Schritte. Jeden Tag.</h2>
            <p className="mt-2 text-sm text-slate-300">{format(parseISO(date), "EEEE, d. MMMM yyyy", { locale: de })}</p>
          </div>
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-2 rounded-full bg-lime-300 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-lime-200"><Plus className="h-4 w-4" /> Supplement anlegen</button>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[[progress.completed + "/" + progress.due.length, "Plan erfüllt"], [progress.remaining, "Noch offen"], [intakes.length, "Einnahmen"]].map(([value, label]) => <div key={label} className="rounded-2xl bg-slate-950/40 p-3 sm:p-4"><div className="text-2xl font-semibold text-lime-200">{value}</div><div className="mt-1 text-xs text-slate-400">{label}</div></div>)}
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Erfüllte Tagesroutine" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}><div className="h-full rounded-full bg-lime-300 transition-all" style={{ width: `${progress.percent}%` }} /></div>
        <p className="mt-2 text-xs text-slate-400">{!progress.due.length ? "Kein Plan für diesen Tag. Lege deinen Rhythmus im Katalog fest." : progress.remaining ? `${progress.remaining} geplante Supplements noch offen.` : "Alle geplanten Supplements erfasst."}</p>
      </div>
      <nav aria-label="Supplement-Bereiche" className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-2 sm:grid-cols-3 lg:grid-cols-6">
        {TABS.map(([key, label]) => <button key={key} aria-current={tab === key ? "page" : undefined} onClick={() => setTab(key)} className={`rounded-xl px-3 py-3 text-sm font-medium transition ${tab === key ? "bg-lime-300 text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>{label}</button>)}
      </nav>
      {!catalog.length && <div className="rounded-3xl border border-dashed border-lime-300/30 p-6 text-center"><Pill className="mx-auto mb-3 h-8 w-8 text-lime-300" /><h3 className="text-lg font-semibold">Dein persönlicher Supplement-Plan</h3><p className="mx-auto my-3 max-w-md text-sm text-slate-400">Lege dein erstes Produkt mit deiner eigenen Dosis und deinem Rhythmus an. Danach kannst du Einnahmen direkt abhaken.</p><button onClick={() => setAdding(true)} className="rounded-full bg-lime-300 px-4 py-2 text-sm font-semibold text-slate-950">Erstes Supplement anlegen</button></div>}
      {tab === "routine" && <div className="space-y-5"><DailyChecklist date={date} catalog={catalog} intakes={intakes} /><QuickLog date={date} catalog={catalog} stats={stats} /><WeeklyTracker key={date} date={date} catalog={catalog} onDateChange={onDateChange} /></div>}
      {tab === "week" && <WeeklyTracker key={date} date={date} catalog={catalog} onDateChange={onDateChange} />}
      {tab === "log" && <div className="grid items-start gap-5 lg:grid-cols-2"><SupplementLogger key={date} date={date} catalog={catalog} intakes={intakes} /><TodayStack date={date} intakes={intakes} /></div>}
      {tab === "catalog" && <CatalogCard catalog={catalog} />}
      {tab === "insights" && <StatsCard stats={stats} />}
      {tab === "reminders" && <ReminderSettings />}
      {adding && <SupplementEditor onClose={() => setAdding(false)} onSaved={() => { setAdding(false); qc.invalidateQueries({ queryKey: ["supp-catalog"] }); }} />}
    </section>
  );
}
