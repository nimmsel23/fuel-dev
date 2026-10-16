import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getUidOrNull } from "../../lib/db.firestore.js";
import { postJson } from "@api";
import { applyIntakeCommand, undoIntakeCommand } from "./optimistic.js";

export function useSupplementMutations(date) {
  const qc = useQueryClient();
  const callbacks = {
    onMutate: async values => {
      const owner = getUidOrNull();
      values.owner = owner;
      const targetDate = values.date || date;
      const key = ["supp-log", targetDate];
      // Abort old reads before patching the shared day cache (also used by the tracker).
      await qc.cancelQueries({ queryKey: key, exact: true });
      if (getUidOrNull() !== owner) throw new Error("Konto hat gewechselt.");
      const item = (qc.getQueryData(["supp-catalog"]) || []).find(item => item.id === values.supplement_id);
      const command = values.delete_id ? { delete_id: values.delete_id } : { intake: {
        id: values.id ||= crypto.randomUUID(),
        supplement_id: values.supplement_id,
        name: values.name || item?.name || values.supplement_id,
        dose: values.dose, unit: values.unit,
        time_of_day: values.time_of_day, notes: values.notes || "",
      } };
      const removed = qc.getQueryData(key)?.intakes?.find(item => item.id === values.delete_id);
      qc.setQueryData(key, current => ({ date: targetDate, ...applyIntakeCommand(current, command) }));
      return { key, command, removed, owner };
    },
    onError: (_error, _values, context) => {
      if (context && getUidOrNull() === context.owner) qc.setQueryData(context.key, current => undoIntakeCommand(current, context.command, context.removed));
    },
    onSettled: (_data, _error, values) => {
      // Refetch in the background; durable outbox commands are projected over reads.
      void qc.invalidateQueries({ queryKey: ["supp-log", values.date || date], exact: true });
      void qc.invalidateQueries({ queryKey: ["supp-stats"] });
      void qc.invalidateQueries({ queryKey: ["nutrition-weekly"] });
    },
  };

  const createIntake = useMutation({
    ...callbacks,
    mutationFn: values => {
      if (getUidOrNull() !== values.owner) throw new Error("Konto hat gewechselt.");
      const item = qc.getQueryData(["supp-log", values.date || date])?.intakes?.find(item => item.id === values.id);
      return postJson("/supplements/log", { date: values.date || date, intake: item || {
        id: values.id, supplement_id: values.supplement_id, name: values.name || values.supplement_id,
        dose: values.dose, unit: values.unit, time_of_day: values.time_of_day, notes: values.notes || "",
      } });
    },
  });
  const deleteIntake = useMutation({
    ...callbacks,
    mutationFn: values => {
      if (getUidOrNull() !== values.owner) throw new Error("Konto hat gewechselt.");
      return postJson("/supplements/log", { date: values.date || date, delete_id: values.delete_id });
    },
  });
  return { createIntake, deleteIntake };
}
