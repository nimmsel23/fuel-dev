import { importShared } from './__federation_fn_import-BlZWqUMR.js';
import { j as jsxRuntimeExports } from './jsx-runtime-CsM3lTE3.js';
import { S as Subscribable, n as notifyManager, s as shallowEqualObjects, r as replaceEqualDeep, u as useQueryClient, a as noop } from './QueryClientProvider-j9id1xDJ.js';
import { Q as QueryObserver, u as useIsRestoring, a as useQueryErrorResetBoundary, e as ensureSuspenseTimers, b as ensurePreventErrorBoundaryRetry, c as useClearResetErrorBoundary, s as shouldSuspend, f as fetchOptimistic, g as getHasError } from './suspense-BlDJtnOU.js';
import { f as fetchJson } from './api-BbKnJ9mL.js';

function difference(array1, array2) {
  const excludeSet = new Set(array2);
  return array1.filter((x) => !excludeSet.has(x));
}
function replaceAt(array, index, value) {
  const copy = array.slice(0);
  copy[index] = value;
  return copy;
}
var QueriesObserver = class extends Subscribable {
  #client;
  #result;
  #queries;
  #options;
  #observers;
  #combinedResult;
  #lastCombine;
  #lastResult;
  #lastQueryHashes;
  #observerMatches = [];
  constructor(client, queries, options) {
    super();
    this.#client = client;
    this.#options = options;
    this.#queries = [];
    this.#observers = [];
    this.#result = [];
    this.setQueries(queries);
  }
  onSubscribe() {
    if (this.listeners.size === 1) {
      this.#observers.forEach((observer) => {
        observer.subscribe((result) => {
          this.#onUpdate(observer, result);
        });
      });
    }
  }
  onUnsubscribe() {
    if (!this.listeners.size) {
      this.destroy();
    }
  }
  destroy() {
    this.listeners = /* @__PURE__ */ new Set();
    this.#observers.forEach((observer) => {
      observer.destroy();
    });
  }
  setQueries(queries, options) {
    this.#queries = queries;
    this.#options = options;
    notifyManager.batch(() => {
      const prevObservers = this.#observers;
      const newObserverMatches = this.#findMatchingObservers(this.#queries);
      newObserverMatches.forEach(
        (match) => match.observer.setOptions(match.defaultedQueryOptions)
      );
      const newObservers = newObserverMatches.map((match) => match.observer);
      const newResult = newObservers.map(
        (observer) => observer.getCurrentResult()
      );
      const hasLengthChange = prevObservers.length !== newObservers.length;
      const hasIndexChange = newObservers.some(
        (observer, index) => observer !== prevObservers[index]
      );
      const hasStructuralChange = hasLengthChange || hasIndexChange;
      const hasResultChange = hasStructuralChange ? true : newResult.some((result, index) => {
        const prev = this.#result[index];
        return !prev || !shallowEqualObjects(result, prev);
      });
      if (!hasStructuralChange && !hasResultChange) return;
      if (hasStructuralChange) {
        this.#observerMatches = newObserverMatches;
        this.#observers = newObservers;
      }
      this.#result = newResult;
      if (!this.hasListeners()) return;
      if (hasStructuralChange) {
        difference(prevObservers, newObservers).forEach((observer) => {
          observer.destroy();
        });
        difference(newObservers, prevObservers).forEach((observer) => {
          observer.subscribe((result) => {
            this.#onUpdate(observer, result);
          });
        });
      }
      this.#notify();
    });
  }
  getCurrentResult() {
    return this.#result;
  }
  getQueries() {
    return this.#observers.map((observer) => observer.getCurrentQuery());
  }
  getObservers() {
    return this.#observers;
  }
  getOptimisticResult(queries, combine) {
    const matches = this.#findMatchingObservers(queries);
    const result = matches.map(
      (match) => match.observer.getOptimisticResult(match.defaultedQueryOptions)
    );
    const queryHashes = matches.map(
      (match) => match.defaultedQueryOptions.queryHash
    );
    return [
      result,
      (r) => {
        return this.#combineResult(r ?? result, combine, queryHashes);
      },
      () => {
        return this.#trackResult(result, matches);
      }
    ];
  }
  #trackResult(result, matches) {
    return matches.map((match, index) => {
      const observerResult = result[index];
      return !match.defaultedQueryOptions.notifyOnChangeProps ? match.observer.trackResult(observerResult, (accessedProp) => {
        matches.forEach((m) => {
          m.observer.trackProp(accessedProp);
        });
      }) : observerResult;
    });
  }
  #combineResult(input, combine, queryHashes) {
    if (combine) {
      const lastHashes = this.#lastQueryHashes;
      const queryHashesChanged = queryHashes !== void 0 && lastHashes !== void 0 && (lastHashes.length !== queryHashes.length || queryHashes.some((hash, i) => hash !== lastHashes[i]));
      if (!this.#combinedResult || this.#result !== this.#lastResult || queryHashesChanged || combine !== this.#lastCombine) {
        this.#lastCombine = combine;
        this.#lastResult = this.#result;
        if (queryHashes !== void 0) {
          this.#lastQueryHashes = queryHashes;
        }
        this.#combinedResult = replaceEqualDeep(
          this.#combinedResult,
          combine(input)
        );
      }
      return this.#combinedResult;
    }
    return input;
  }
  #findMatchingObservers(queries) {
    const prevObserversMap = /* @__PURE__ */ new Map();
    this.#observers.forEach((observer) => {
      const key = observer.options.queryHash;
      if (!key) return;
      const previousObservers = prevObserversMap.get(key);
      if (previousObservers) {
        previousObservers.push(observer);
      } else {
        prevObserversMap.set(key, [observer]);
      }
    });
    const observers = [];
    queries.forEach((options) => {
      const defaultedOptions = this.#client.defaultQueryOptions(options);
      const match = prevObserversMap.get(defaultedOptions.queryHash)?.shift();
      const observer = match ?? new QueryObserver(this.#client, defaultedOptions);
      observers.push({
        defaultedQueryOptions: defaultedOptions,
        observer
      });
    });
    return observers;
  }
  #onUpdate(observer, result) {
    const index = this.#observers.indexOf(observer);
    if (index !== -1) {
      this.#result = replaceAt(this.#result, index, result);
      this.#notify();
    }
  }
  #notify() {
    if (this.hasListeners()) {
      const previousResult = this.#combinedResult;
      const newTracked = this.#trackResult(this.#result, this.#observerMatches);
      const newResult = this.#combineResult(newTracked, this.#options?.combine);
      if (previousResult !== newResult) {
        notifyManager.batch(() => {
          this.listeners.forEach((listener) => {
            listener(this.#result);
          });
        });
      }
    }
  }
};

// src/useQueries.ts
const React$1 = await importShared('react');
function useQueries({
  queries,
  ...options
}, queryClient) {
  const client = useQueryClient();
  const isRestoring = useIsRestoring();
  const errorResetBoundary = useQueryErrorResetBoundary();
  const defaultedQueries = React$1.useMemo(
    () => queries.map((opts) => {
      const defaultedOptions = client.defaultQueryOptions(
        opts
      );
      defaultedOptions._optimisticResults = isRestoring ? "isRestoring" : "optimistic";
      return defaultedOptions;
    }),
    [queries, client, isRestoring]
  );
  defaultedQueries.forEach((queryOptions) => {
    ensureSuspenseTimers(queryOptions);
    const query = client.getQueryCache().get(queryOptions.queryHash);
    ensurePreventErrorBoundaryRetry(queryOptions, errorResetBoundary, query);
  });
  useClearResetErrorBoundary(errorResetBoundary);
  const [observer] = React$1.useState(
    () => new QueriesObserver(
      client,
      defaultedQueries,
      options
    )
  );
  const [optimisticResult, getCombinedResult, trackResult] = observer.getOptimisticResult(
    defaultedQueries,
    options.combine
  );
  const shouldSubscribe = !isRestoring && options.subscribed !== false;
  React$1.useSyncExternalStore(
    React$1.useCallback(
      (onStoreChange) => shouldSubscribe ? observer.subscribe(notifyManager.batchCalls(onStoreChange)) : noop,
      [observer, shouldSubscribe]
    ),
    () => observer.getCurrentResult(),
    () => observer.getCurrentResult()
  );
  React$1.useEffect(() => {
    observer.setQueries(
      defaultedQueries,
      options
    );
  }, [defaultedQueries, options, observer]);
  const shouldAtLeastOneSuspend = optimisticResult.some(
    (result, index) => shouldSuspend(defaultedQueries[index], result)
  );
  const suspensePromises = shouldAtLeastOneSuspend ? optimisticResult.flatMap((result, index) => {
    const opts = defaultedQueries[index];
    if (opts && shouldSuspend(opts, result)) {
      const queryObserver = new QueryObserver(client, opts);
      return fetchOptimistic(opts, queryObserver, errorResetBoundary);
    }
    return [];
  }) : [];
  if (suspensePromises.length > 0) {
    throw Promise.all(suspensePromises);
  }
  const firstSingleResultWhichShouldThrow = optimisticResult.find(
    (result, index) => {
      const query = defaultedQueries[index];
      return query && getHasError({
        result,
        errorResetBoundary,
        throwOnError: query.throwOnError,
        query: client.getQueryCache().get(query.queryHash),
        suspense: query.suspense
      });
    }
  );
  if (firstSingleResultWhichShouldThrow?.error) {
    throw firstSingleResultWhichShouldThrow.error;
  }
  return getCombinedResult(trackResult());
}

const React = await importShared('react');
const NUTRIENTS = [
  // Fettlöslich
  { key: "vitamin_a_ug", label: "Vit. A", unit: "µg" },
  { key: "vitamin_d_ug", label: "Vit. D", unit: "µg" },
  { key: "vitamin_e_mg", label: "Vit. E", unit: "mg" },
  { key: "vitamin_k_ug", label: "Vit. K", unit: "µg" },
  // Wasserlöslich
  { key: "vitamin_c_mg", label: "Vit. C", unit: "mg" },
  { key: "vitamin_b1_mg", label: "B1", unit: "mg" },
  { key: "vitamin_b2_mg", label: "B2", unit: "mg" },
  { key: "vitamin_b3_mg", label: "B3", unit: "mg" },
  { key: "vitamin_b5_mg", label: "B5", unit: "mg" },
  { key: "vitamin_b6_mg", label: "B6", unit: "mg" },
  { key: "vitamin_b7_ug", label: "B7", unit: "µg" },
  { key: "folate_ug", label: "Folat", unit: "µg" },
  { key: "vitamin_b12_ug", label: "B12", unit: "µg" },
  // Mineralstoffe
  { key: "calcium_mg", label: "Calcium", unit: "mg" },
  { key: "phosphorus_mg", label: "Phosphor", unit: "mg" },
  { key: "magnesium_mg", label: "Mg", unit: "mg" },
  { key: "iron_mg", label: "Eisen", unit: "mg" },
  { key: "zinc_mg", label: "Zink", unit: "mg" },
  { key: "selenium_ug", label: "Selen", unit: "µg" },
  { key: "iodine_ug", label: "Jod", unit: "µg" },
  { key: "potassium_mg", label: "Kalium", unit: "mg" },
  { key: "sodium_mg", label: "Natrium", unit: "mg" },
  // Fettsäuren
  { key: "omega3_mg", label: "Omega-3", unit: "mg" }
];
function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return {
    year: d.getFullYear(),
    week: 1 + Math.round(((d - week1) / 864e5 - 3 + (week1.getDay() + 6) % 7) / 7)
  };
}
function lastNWeeks(n) {
  const weeks = [];
  const now = /* @__PURE__ */ new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weeks.push(getISOWeek(d));
  }
  return weeks;
}
function pctColor(pct) {
  if (pct == null) return { bg: "rgba(30,41,59,0.4)", text: "#475569" };
  if (pct >= 90) return { bg: "#16a34a", text: "#fff" };
  if (pct >= 50) return { bg: "#d97706", text: "#fff" };
  return { bg: "#dc2626", text: "#fff" };
}
function Cell({ pct, dach, unit, avg }) {
  const { bg, text } = pctColor(pct);
  const title = pct != null ? `${avg} ${unit} / ${dach} ${unit} DACH (${pct}%)` : "Keine Daten";
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      title,
      className: "flex h-9 w-full items-center justify-center rounded text-[10px] font-semibold transition-opacity",
      style: { background: bg, color: text },
      children: pct != null ? `${pct}%` : "—"
    }
  );
}
function MicrosView() {
  const weeks = lastNWeeks(8);
  const results = useQueries({
    queries: weeks.map(({ year, week }) => ({
      queryKey: ["nutrition-weekly", year, week],
      queryFn: () => fetchJson(`/nutrition/weekly/${year}/${week}`).then((d) => d.ok ? d : null),
      staleTime: 5 * 60 * 1e3
    }))
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-6 p-4", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold text-slate-100", children: "Mikronährstoffe" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-slate-400", children: "Ø täglich vs. DACH-Referenzwerte · letzte 8 Wochen" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-4 text-xs text-slate-400", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "h-3 w-3 rounded", style: { background: "#16a34a" } }),
        " ≥ 90%"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "h-3 w-3 rounded", style: { background: "#d97706" } }),
        " 50–89%"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "h-3 w-3 rounded", style: { background: "#dc2626" } }),
        " < 50%"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "h-3 w-3 rounded", style: { background: "rgba(30,41,59,0.4)", border: "1px solid #334155" } }),
        " keine Daten"
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "grid min-w-[640px] gap-1",
        style: { gridTemplateColumns: `7rem repeat(${weeks.length}, 1fr)` },
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", {}),
          weeks.map(({ year, week }, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-center text-[10px] font-bold text-slate-500", children: [
            "KW",
            week
          ] }, i)),
          NUTRIENTS.map(({ key, label, unit }) => /* @__PURE__ */ jsxRuntimeExports.jsxs(React.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center pr-2 text-sm font-medium text-slate-300", children: [
              label,
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ml-1 text-[10px] text-slate-500", children: unit })
            ] }),
            results.map((res, wi) => {
              const d = res.data?.rda_comparison?.[key];
              return /* @__PURE__ */ jsxRuntimeExports.jsx(
                Cell,
                {
                  pct: d?.percent_of_dach ?? null,
                  dach: d?.dach ?? null,
                  unit,
                  avg: d?.avg_daily ?? null
                },
                `${key}-${wi}`
              );
            })
          ] }, key))
        ]
      }
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-slate-600", children: "Mikronährstoffe werden aus dem Micros-Katalog geschätzt. Mahlzeiten ohne Eintrag zählen als 0." })
  ] });
}

export { MicrosView as default };
