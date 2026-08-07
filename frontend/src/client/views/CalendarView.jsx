import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { PlusCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@api";

export default function CalendarView({ date }) {
  const initialMonth = parseISO(`${date}T00:00:00`);
  const start = startOfMonth(initialMonth);
  const end = endOfMonth(initialMonth);

  const range = {
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
  };

  const { data: monthMeals = [] } = useQuery({
    queryKey: ["calendar-month-logs", range.start, range.end],
    queryFn: async () => {
      const days = eachDayOfInterval({ start, end }).map(d => format(d, "yyyy-MM-dd"));
      const results = await Promise.all(
        days.map(d =>
          fetchJson(`/nutrition/log?date=${d}`)
            .then(r => (r.data?.meals || []).map(m => ({ ...m, date: d })))
            .catch(() => [])
        )
      );
      return results.flat();
    },
    staleTime: 5 * 60 * 1000,
  });

  const events = monthMeals.map((meal) => ({
    title: `${meal.type}: ${meal.description}`,
    date: meal.date,
  }));

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Big Calendar</h2>
          <p className="text-sm text-slate-400">Alle Meals des Monats als Events.</p>
        </div>
        <PlusCircle className="h-5 w-5 text-orange-300" />
      </div>
      <div className="mb-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
        Monat: {range.start} bis {range.end}
      </div>
      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          initialDate={date}
          height="auto"
          events={events}
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" }}
        />
      </div>
    </section>
  );
}
