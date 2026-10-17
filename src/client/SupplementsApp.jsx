import SupplementsView from "./views/SupplementsView.jsx";
import { useSuppCatalog, useSuppLog, useSuppStats } from "./hooks/useSupplements.js";

export default function SupplementsApp({ date, onDateChange }) {
  const catalog = useSuppCatalog();
  const log = useSuppLog(date);
  const stats = useSuppStats(date);
  const queries = [catalog, log, stats];
  const failed = queries.filter(query => query.isError);
  if (queries.some(query => query.isPending)) return <p role="status" className="py-12 text-center text-slate-400">Deine Supplements werden geladen…</p>;
  if (failed.length) return <div role="alert" className="rounded-2xl border border-rose-300/30 p-5"><p>Deine Supplements konnten nicht vollständig geladen werden.</p><p className="mt-2 text-sm text-slate-400">{failed[0].error.message}</p><button onClick={() => failed.forEach(query => query.refetch())} className="mt-4 rounded-full bg-lime-300 px-4 py-2 text-slate-950">Erneut laden</button></div>;
  return <SupplementsView date={date} onDateChange={onDateChange} catalog={catalog.data} suppLog={log.data} sup={stats.data} />;
}
