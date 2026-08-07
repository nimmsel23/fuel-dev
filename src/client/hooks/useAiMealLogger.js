import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson } from "@api";
import { isCloud, resolveMealText } from "../lib/aiMealLogger.js";
import { usePendingAiEntries } from "./useNutrition.js";

// Ein Einstiegspunkt für den Freitext-AI-Logger, geteilt zwischen dem
// vollen Log-Tab (Log/LogView.jsx) und der kompakten Dashboard-Variante
// (components/QuickAiLog.jsx). Vorher hatten beide eine eigene, mit der Zeit
// auseinandergedriftete Kopie derselben Vertex-Logik — Dashboard ohne
// Katalog-Match, ohne Mikros, ohne Pending-Entry-Sicherheitsnetz.
export function useAiMealLogger(date) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const cloud = isCloud();

  const { data: pendingEntries = [] } = usePendingAiEntries(date);

  const { data: catalogData } = useQuery({
    queryKey: ["nutrition-catalog"],
    queryFn: () => fetchJson("/nutrition/catalog"),
    staleTime: 60_000,
  });
  const catalogItems = catalogData?.items || [];

  const { data: suppCatalogData } = useQuery({
    queryKey: ["supp-catalog"],
    queryFn: () => fetchJson("/supplements/catalog"),
    staleTime: 300_000,
  });
  const suppCatalog = suppCatalogData?.items || [];

  const invalidateAfterLog = () => {
    qc.invalidateQueries({ queryKey: ["nutrition", date] });
    qc.invalidateQueries({ queryKey: ["week-logs"] });
    qc.invalidateQueries({ queryKey: ["supp-log", date] });
    qc.invalidateQueries({ queryKey: ["supp-stats", date] });
    qc.invalidateQueries({ queryKey: ["ai-pending", date] });
  };

  const resolvePendingEntry = async (entry) => {
    const firestore = await import("../lib/db.firestore.js");
    await resolveMealText({ date, rawText: entry.text, catalogItems, suppCatalog });
    await firestore.removePendingAiEntry(date, entry);
  };

  const reanalyzePending = useMutation({
    mutationFn: (entry) => resolvePendingEntry(entry),
    onError: (err) => {
      console.error("Pending AI entry analysis error:", err);
      setError((err.message || "Analyse fehlgeschlagen.") + " Eintrag bleibt in der Warteliste — jederzeit erneut versuchbar.");
    },
    onSuccess: () => setError(""),
    onSettled: invalidateAfterLog,
  });

  const submit = async (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    setError("");
    setSubmitting(true);
    const rawText = text.trim();

    if (!cloud) {
      try {
        await postJson("/nutrition/ai-log", { text: rawText, date });
        invalidateAfterLog();
        setText("");
      } catch (err) {
        console.error("AI Logging error:", err);
        setError(err.message || "Fehler beim KI-Logging.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // 1. Optimistic Save — Text landet sofort als wartender Eintrag,
    //    unabhängig davon ob Vertex AI danach erreichbar ist.
    const firestore = await import("../lib/db.firestore.js");
    const entry = { id: `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, text: rawText, created_at: new Date().toISOString() };
    await firestore.addPendingAiEntry(date, entry);
    qc.invalidateQueries({ queryKey: ["ai-pending", date] });
    setText("");

    // 2. Analyse nachgelagert — Fehler hier verlieren den Text nicht mehr,
    //    er bleibt als wartender Eintrag mit Retry-Button stehen.
    try {
      await resolvePendingEntry(entry);
    } catch (analysisErr) {
      console.error("AI Logging analysis error:", analysisErr);
      setError((analysisErr.message || "Analyse fehlgeschlagen.") + " Text wurde gesichert — über \"Neu analysieren\" erneut versuchen.");
    } finally {
      invalidateAfterLog();
      setSubmitting(false);
    }
  };

  const retryLast = () => submit();

  return {
    text, setText,
    loading: submitting || reanalyzePending.isPending,
    error,
    submit,
    retryLast,
    pendingEntries,
    reanalyzePending,
    cloud,
  };
}
