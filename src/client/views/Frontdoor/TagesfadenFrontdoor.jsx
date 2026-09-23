import React from "react";
import { Mic, Camera, Send, Loader2, Square } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { useAiMealLogger } from "../../hooks/useAiMealLogger.js";

function clockOf(meal) {
  const raw = meal?.logged_at || meal?.time || meal?.created_at;
  if (!raw) return "";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
}

function SpeechCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

// Frontdoor "Tagesfaden": ein Screen, der Tag als Faden, unten ein Feld mit
// Mikrofon. Der Satz geht durch den bestehenden Freitext-Logger
// (hooks/useAiMealLogger.js) — erst Katalog-Match, dann Gemini-Schätzung.
export default function TagesfadenFrontdoor({ fd, onOpenApp }) {
  const { date, meals, totals, kcalGoal, proteinGoal, suggestions } = fd;
  const ai = useAiMealLogger(date);
  const [listening, setListening] = React.useState(false);
  const [heard, setHeard] = React.useState("");
  const recRef = React.useRef(null);
  const threadRef = React.useRef(null);

  const hasSpeech = !!SpeechCtor();

  React.useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [meals.length, ai.pendingEntries.length]);

  const startListening = () => {
    const Ctor = SpeechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "de-AT";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      const txt = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      setHeard(txt);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      setHeard((txt) => {
        if (txt.trim()) {
          ai.setText(txt.trim());
          setTimeout(() => ai.submit(), 0);
        }
        return "";
      });
    };
    recRef.current = rec;
    setHeard("");
    setListening(true);
    rec.start();
  };

  const stopListening = () => {
    recRef.current?.stop();
    setListening(false);
  };

  const proteinPct = Math.min(100, Math.round((totals.protein / (proteinGoal || 150)) * 100));
  const chips = suggestions.slice(0, 3);

  return (
    <div className="relative mx-auto grid w-full max-w-2xl gap-4">
      {/* Tagesleiste */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-semibold text-slate-100">
            Heute, {new Date(date).toLocaleDateString("de-AT", { weekday: "long" })}
          </h3>
          <div className="text-sm tabular-nums text-slate-400">
            <span className="font-semibold text-orange-300">{Math.round(totals.kcal)}</span> / {kcalGoal} kcal
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            { k: "Prot", v: totals.protein, pct: proteinPct, low: proteinPct < 60 },
            { k: "KH", v: totals.carbs, pct: Math.min(100, Math.round((totals.carbs / 250) * 100)), low: false },
            { k: "Fett", v: totals.fat, pct: Math.min(100, Math.round((totals.fat / 80) * 100)), low: false },
          ].map((m) => (
            <div key={m.k}>
              <div className="flex justify-between text-[9px] uppercase tracking-[0.14em] text-slate-500">
                <span>{m.k}</span><span className="tabular-nums">{Math.round(m.v)} g</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded bg-white/10">
                <div className={twMerge("h-full rounded", m.low ? "bg-amber-400" : "bg-emerald-400")} style={{ width: `${m.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Faden */}
      <div ref={threadRef} className="max-h-[46vh] overflow-y-auto pr-1">
        {meals.length === 0 && ai.pendingEntries.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            Noch nichts für heute. Schreib einfach, was du gegessen hast.
          </p>
        ) : (
          <div className="grid gap-4">
            {meals.map((m) => (
              <div key={m.id} className="grid grid-cols-[46px_1fr] gap-3">
                <div className="pt-1 text-right text-[11px] tabular-nums text-slate-500">{clockOf(m)}</div>
                <div className="border-l border-white/10 pl-4">
                  <p className="text-[17px] leading-snug text-slate-100">{m.description}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-[11px] tabular-nums text-slate-500">
                    <span className="text-slate-300">{Math.round(m.kcal || 0)} kcal</span>
                    <span>{Math.round(m.protein || 0)} P</span>
                    <span>{Math.round(m.carbs || 0)} K</span>
                    <span>{Math.round(m.fat || 0)} F</span>
                  </div>
                </div>
              </div>
            ))}

            {ai.pendingEntries.map((entry) => (
              <div key={entry.id} className="grid grid-cols-[46px_1fr] gap-3">
                <div className="pt-1 text-right text-[11px] text-slate-600">…</div>
                <div className="border-l border-amber-400/40 pl-4">
                  <p className="text-[17px] leading-snug text-slate-300">{entry.text}</p>
                  <button
                    onClick={() => ai.reanalyzePending.mutate(entry)}
                    className="mt-1 text-[11px] uppercase tracking-[0.12em] text-amber-400"
                  >
                    wartet auf Analyse · neu versuchen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {ai.error && <p className="text-xs text-red-400">{ai.error}</p>}

      {/* Composer */}
      <form onSubmit={ai.submit} className="grid gap-3 border-t border-white/10 pt-4">
        {chips.length > 0 && !ai.text && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {chips.map((c) => (
              <button
                type="button"
                key={c.key}
                onClick={() => ai.setText(c.description)}
                className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300"
              >
                {c.description}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onOpenApp("log")} aria-label="Foto statt Text" className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-300">
            <Camera className="h-5 w-5" />
          </button>
          <input
            value={ai.text}
            onChange={(e) => ai.setText(e.target.value)}
            placeholder="Was hast du gegessen?"
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3.5 text-slate-100 placeholder:text-slate-600"
          />
          {ai.text.trim() ? (
            <button type="submit" disabled={ai.loading} aria-label="Eintragen" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-400 text-slate-950 disabled:opacity-60">
              {ai.loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              disabled={!hasSpeech}
              title={hasSpeech ? "Diktieren" : "Diktat wird von diesem Browser nicht unterstützt — nutze die Diktattaste der Tastatur"}
              aria-label="Diktieren"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-400 text-slate-950 disabled:opacity-40"
            >
              {listening ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
            </button>
          )}
        </div>
      </form>

      {/* Diktat-Overlay */}
      {listening && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/90 p-8 backdrop-blur" onClick={stopListening}>
          <div className="mb-6 flex h-14 items-end justify-center gap-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className="w-1 animate-pulse rounded bg-emerald-400"
                style={{ height: `${20 + ((i * 7) % 34)}px`, animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
          <p className="text-2xl leading-snug text-slate-100">{heard || "Ich höre zu …"}</p>
          <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-emerald-400">Tippen zum Beenden — der Satz geht direkt in den Faden</p>
        </div>
      )}
    </div>
  );
}
