import { useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, ClipboardList, GraduationCap, Scale, Utensils, Activity, Dumbbell, ShieldCheck } from "lucide-react";

const UNITS = [
  { id: "basics", icon: Utensils, title: "Ernährungslehre & Bedarf", source: "Ernährungsempfehlung und Betreuung · Ernährungsformen und Diäten", intro: "Lebensmittel liefern Makro- und Mikronährstoffe, Wasser und Energie. Bedarf und tatsächliche Zufuhr sind verschiedene Größen; Referenzwerte helfen bei der Einordnung, ersetzen keine individuelle Diagnose.", points: ["Makronährstoffe: Kohlenhydrate, Fette und Proteine", "Mikronährstoffe: Vitamine und Mineralstoffe", "Bedarf wird unter anderem von Alter, Aktivität und Lebenssituation beeinflusst"] },
  { id: "assessment", icon: ClipboardList, title: "Ernährung erfassen & beraten", source: "Ernährungsempfehlung und Betreuung", intro: "Eine strukturierte Erhebung macht Essalltag und Ziele sichtbar. Das Skript behandelt Ernährungserhebungsmethoden, den 24-h-Recall und eine nachvollziehbare Betreuung gesunder Personen.", points: ["Ausgangslage und Auftrag klären", "Methode passend zu Frage und Aufwand wählen", "Empfehlungen verständlich formulieren und Verlauf besprechen"] },
  { id: "forms", icon: BookOpen, title: "Ernährungsformen & Diäten", source: "Ernährungsformen und Diäten", intro: "Ernährungsformen beschreiben Muster; Diäten verfolgen meist eine enger begrenzte Zielsetzung. Die Kursunterlage stellt Formen und Anwendungsansätze vor, die im Beratungskontext kritisch eingeordnet werden sollen.", points: ["Begriffe und Zielsetzungen unterscheiden", "Umsetzbarkeit und Einschränkungen mitdenken", "Keine pauschale Eignung aus einem Label ableiten"] },
  { id: "physiology", icon: Activity, title: "Ernährungsphysiologische Aspekte", source: "Ernährungsphysiologische Aspekte", intro: "Körperzusammensetzung ist ein Modell und wird je nach Methode unterschiedlich erfasst. Messbedingungen, Fehlerquellen und Aussagegrenzen gehören zur Interpretation.", points: ["BMI, Umfangmessungen, Kaliper und BIA unterscheiden", "Hydration und Messzeitpunkt können Werte beeinflussen", "Einzelwerte nicht mit einer vollständigen Gesundheitsbeurteilung verwechseln"] },
  { id: "sport", icon: Dumbbell, title: "Spezielle Sporternährung", source: "Spezielle Sporternährung", intro: "Das Skript ordnet Ernährung nach Leistungsgruppe und Belastung ein und behandelt Energiehaushalt, Ernährung rund um Belastung, Flüssigkeit und Regeneration.", points: ["Belastungsart und Trainingsumfang berücksichtigen", "Flüssigkeitsversorgung als eigenen Themenblock betrachten", "Supplemente kritisch prüfen und nicht als Ersatz für Grundlagen behandeln"] },
  { id: "scope", icon: ShieldCheck, title: "Betreuung & beruflicher Rahmen", source: "Ernährungsempfehlung und Betreuung · Rechtliche Aspekte (AT)", intro: "Der österreichische Berufsrahmen setzt Grenzen für die Tätigkeit. Das Kursskript trennt allgemeine Ernährungsempfehlung für gesunde Personen von medizinischer Diagnose und Therapie.", points: ["Auftrag und Zuständigkeit transparent halten", "Bei medizinischen Fragestellungen weiterverweisen", "Keine Heilversprechen oder Therapie ersetzen"] },
];

const CURRICULUM = {
  "A-Lizenz · Basis": [
    "Anatomie & Physiologie der Verdauung", "Ernährung für Personengruppen", "Ernährungslehre",
    "Ernährungsmedizin", "Ernährungsökologie", "Ernährungspsychologie", "Ernährungstoxikologie",
    "Gesundheitserziehung", "Kräuter und Gewürzkunde", "Lebensmittelkennzeichnung", "Lebensmittelkunde",
  ],
  "B-Lizenz · Vertiefung": [
    "Ernährungsempfehlung und Betreuung", "Ernährungsformen und Diäten",
    "Ernährungsphysiologische Aspekte", "Spezielle Sporternährung",
  ],
};

const QUESTIONS = [
  { q: "Was beschreibt ein 24-h-Recall?", options: ["Eine strukturierte rückblickende Erhebung der letzten 24 Stunden", "Den täglichen Nährstoffbedarf als Messwert", "Eine medizinische Diagnose"], answer: 0, why: "Der Recall ist eine Methode der Ernährungserhebung; er beschreibt erinnerte Aufnahme, nicht automatisch den üblichen Bedarf." },
  { q: "Was ist bei einer BIA-Einordnung besonders zu beachten?", options: ["Sie misst Körperfett direkt und unabhängig von Bedingungen", "Hydration und Messbedingungen können das Ergebnis beeinflussen", "Ein Einzelwert ersetzt andere Informationen"], answer: 1, why: "Die Kursnotiz markiert BIA als abgeleitete Messung mit relevanten Einflussfaktoren." },
  { q: "Wofür ist ein Ernährungstrainer im österreichischen Kursrahmen ausgebildet?", options: ["Allgemeine Empfehlungen für gesunde Personen im eigenen Tätigkeitsrahmen", "Krankheiten diagnostizieren und behandeln", "Medikamente für Klienten verordnen"], answer: 0, why: "Das Skript grenzt Beratung von Diagnose und Therapie ab." },
  { q: "Was gehört zur Pflichtaufgabe Nahrungsaufnahme?", options: ["Ein 7-tägiges Ernährungsprotokoll", "Eine 14-tägige Diätverordnung", "Eine BIA-Messung an sieben Personen"], answer: 0, why: "Fuel hat dafür bereits das Ernährungsprotokoll und den druckfertigen Report." },
];

export default function TrainingModuleView({ setActiveTab }) {
  const [answers, setAnswers] = useState({});
  const [completed, setCompleted] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fuel-training-module-v1") || "[]"); } catch { return []; }
  });
  function toggleUnit(id) {
    const next = completed.includes(id) ? completed.filter((item) => item !== id) : [...completed, id];
    setCompleted(next);
    try { localStorage.setItem("fuel-training-module-v1", JSON.stringify(next)); } catch { /* Progress can remain in view state. */ }
  }
  const score = QUESTIONS.reduce((sum, item, i) => sum + (answers[i] === item.answer ? 1 : 0), 0);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-10">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-400/20 via-teal-400/10 to-transparent p-5 sm:p-8">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><GraduationCap size={18} /> Präventiver Vitaltrainer · Ernährungstrainer</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Ernährungstrainer</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-base-content/70">Lernpfad für Kurswissen, Beratungspraxis und die B-Lizenz-Aufgaben. Die Karten führen durch die vorhandenen Skripte und markieren, wo die Ausbildung Grenzen setzt.</p>
        <div className="mt-5 flex flex-wrap items-center gap-3"><div className="rounded-2xl bg-base-100/70 px-4 py-3"><div className="text-2xl font-black">{completed.length}<span className="text-base text-base-content/50">/{UNITS.length}</span></div><div className="text-xs text-base-content/60">Lernblöcke erledigt</div></div><button onClick={() => setActiveTab?.("report")} className="btn btn-success"><ClipboardList size={16} /> 7-Tage-Protokoll öffnen <ArrowRight size={15} /></button></div>
      </header>

      <section className="rounded-2xl border border-base-300 bg-base-100 p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Fächer des Moduls</h2><p className="mt-1 text-sm text-base-content/60">Vollständiger Umfang laut Master-MOC · elf Basis- und vier Vertiefungsfächer.</p></div><BookOpen size={20} className="shrink-0 text-success" /></div><div className="mt-4 grid gap-4 sm:grid-cols-2">{Object.entries(CURRICULUM).map(([group, subjects]) => <div key={group}><h3 className="mb-2 text-sm font-bold">{group}</h3><ol className="space-y-1.5">{subjects.map((subject, index) => <li key={subject} className="flex gap-2 text-sm text-base-content/75"><span className="w-5 shrink-0 text-right text-xs text-base-content/40">{String(index + 1).padStart(2, "0")}</span><span>{subject}</span></li>)}</ol></div>)}</div><p className="mt-4 border-t border-base-300 pt-3 text-xs text-base-content/50">Quelle: „MOC-Dipl.Ernährungstrainer.md“ unter Dokumente/Dipl. Präventiver Vitaltrainer/00_MOCs. Die Lernkarten darunter sind thematische Einstiege; die vollständigen Skripte bleiben die maßgebliche Kursquelle.</p></section>

      <section className="space-y-3"><div><h2 className="text-xl font-bold">Lernpfad</h2><p className="mt-1 text-sm text-base-content/60">Sechs thematische Einstiege aus den vorhandenen B-Lizenz-Skripten. Öffne einen Block und markiere ihn für deinen Überblick.</p></div>
        <div className="grid gap-3 md:grid-cols-2">{UNITS.map((unit, index) => { const Icon = unit.icon; const done = completed.includes(unit.id); return <article key={unit.id} className="rounded-2xl border border-base-300 bg-base-100 p-4 sm:p-5"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success/10 text-success"><Icon size={19} /></div><div className="min-w-0 flex-1"><div className="text-xs font-semibold uppercase tracking-wide text-base-content/50">Lernblock {String(index + 1).padStart(2, "0")}</div><h3 className="mt-1 font-bold">{unit.title}</h3></div>{done && <CheckCircle2 className="text-success" size={18} />}</div><p className="mt-3 text-sm leading-relaxed text-base-content/70">{unit.intro}</p><details className="mt-3 rounded-xl bg-base-200/60 p-3"><summary className="cursor-pointer text-sm font-semibold">Skriptpunkte &amp; Quelle</summary><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-base-content/70">{unit.points.map((point) => <li key={point}>{point}</li>)}</ul><p className="mt-3 border-t border-base-300 pt-2 text-xs text-base-content/50">Kursquelle: {unit.source}. Zusammenfassung der lokalen Kursnotizen, keine wortgetreue Wiedergabe.</p></details><button onClick={() => toggleUnit(unit.id)} className={`btn btn-sm mt-3 ${done ? "btn-outline" : "btn-success"}`}>{done ? "Als offen markieren" : "Lernblock erledigt"}</button></article>; })}</div>
      </section>

      <section className="rounded-2xl border border-base-300 bg-base-100 p-5 sm:p-6"><div className="flex items-center gap-2"><Scale size={19} className="text-success" /><h2 className="text-xl font-bold">Pflichtaufgabe · 7 Tage Nahrungsaufnahme</h2></div><p className="mt-2 text-sm leading-relaxed text-base-content/70">Die Aufgabenunterlage verlangt ein siebentägiges Ernährungsprotokoll: alle Lebensmittel und Getränke tabellarisch für Vormittag (00–12 Uhr), Nachmittag (12–18 Uhr) und Abend (18–00 Uhr), mit Kaloriensumme pro Tag. Fuel kann geloggte Lebensmittel und Getränke als Tagesübersicht aufbereiten und den Bericht druckfertig ausgeben. Der Bericht ersetzt nicht das Prüfen der konkreten Einreichungsvorgaben deiner Kursplattform.</p><div className="mt-4 grid gap-2 sm:grid-cols-2"><button onClick={() => setActiveTab?.("log")} className="btn btn-outline">1 · Ernährung protokollieren <ArrowRight size={15} /></button><button onClick={() => setActiveTab?.("report")} className="btn btn-success">2 · 7-Tage-Report ansehen <ArrowRight size={15} /></button></div><p className="mt-3 text-xs text-base-content/50">Quelle: FlexyFit Academy, „Ernährungstrainer B-Lizenz · Nahrungsaufnahme Protokoll“ (Pflichtaufgabe_Nahrungsaufnahme.pdf) und Fuel Report für die Ernährungstrainer-Pflichtaufgabe.</p></section>

      <section className="rounded-2xl border border-base-300 bg-base-100 p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-xl font-bold">Prüfungs-Check</h2><p className="mt-1 text-sm text-base-content/60">Vier kurze Fragen aus den Themenblöcken.</p></div><div className="text-sm font-semibold text-success">{Object.keys(answers).length === QUESTIONS.length ? `${score}/${QUESTIONS.length} richtig` : `${Object.keys(answers).length}/${QUESTIONS.length} beantwortet`}</div></div><div className="mt-4 space-y-4">{QUESTIONS.map((item, qi) => <fieldset key={item.q} className="rounded-xl bg-base-200/50 p-4"><legend className="font-semibold">{qi + 1}. {item.q}</legend><div className="mt-3 space-y-2">{item.options.map((option, oi) => <label key={option} className="flex cursor-pointer items-start gap-2 text-sm"><input type="radio" className="radio radio-success radio-sm mt-0.5" name={`fuel-module-${qi}`} checked={answers[qi] === oi} onChange={() => setAnswers((current) => ({ ...current, [qi]: oi }))} /><span>{option}</span></label>)}</div>{answers[qi] !== undefined && <p className={`mt-3 text-xs ${answers[qi] === item.answer ? "text-success" : "text-warning"}`}>{item.why}</p>}</fieldset>)}</div></section>

      <p className="text-xs leading-relaxed text-base-content/50">Quellenbasis: FlexyFit Academy, vollständige Fächerliste aus der Master-MOC, lokale Kursnotizen und Markdown-Konvertierungen zu „Ernährungsempfehlung und Betreuung“, „Ernährungsformen und Diäten“, „Ernährungsphysiologische Aspekte“ und „Spezielle Sporternährung“ sowie die Pflichtaufgabe Nahrungsaufnahme. Die Vertiefungskarten sind Lernhilfen; sie ersetzen keine Originalskripte und ergänzen keine fehlenden Lehrtexte.</p>
    </div>
  );
}
