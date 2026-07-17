import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postJson } from "@api";

export function useSupplementMutations(date) {
  const qc = useQueryClient();

  const createIntake = useMutation({
    mutationFn: (values) =>
      postJson("/supplements/log", {
        date: values.date || date,
        intake: {
          supplement_id: values.supplement_id,
          dose: values.dose,
          unit: values.unit,
          time_of_day: values.time_of_day,
          notes: values.notes || "",
        },
      }),
    onSuccess: (_, values) => {
      const targetDate = values.date || date;
      qc.invalidateQueries({ queryKey: ["supp-log", targetDate] });
      qc.invalidateQueries({ queryKey: ["supp-stats", targetDate] });
    },
  });

  const deleteIntake = useMutation({
    mutationFn: ({ date: intakeDate, delete_id }) =>
      postJson("/supplements/log", { date: intakeDate || date, delete_id }),
    onSuccess: (_, values) => {
      const targetDate = values.date || date;
      qc.invalidateQueries({ queryKey: ["supp-log", targetDate] });
      qc.invalidateQueries({ queryKey: ["supp-stats", targetDate] });
      qc.invalidateQueries({ queryKey: ["nutrition-weekly"] });
    },
  });

  return { createIntake, deleteIntake };
}
