import { NotebookPen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function JournalWidget({ journal, streak }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-5 w-5 text-sky-300" />
          <h2 className="text-lg font-semibold">Journal</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-400">
          streak {streak}d
        </span>
      </div>
      <div className="prose prose-invert prose-sm max-w-none leading-6 text-slate-300">
        {journal ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{journal}</ReactMarkdown>
        ) : (
          <p>Kein Journaleintrag geladen.</p>
        )}
      </div>
    </section>
  );
}
