import { getMealsHistory } from "./nutrition.js";
import { getNutritionNotesHistory } from "./notes.js";

export async function getNutritionJournalHistory(limitCount = 30) {
  const [mealsLogs, notesLogs] = await Promise.all([
    getMealsHistory(limitCount),
    getNutritionNotesHistory(limitCount)
  ]);

  const map = {};

  // Add meals
  for (const log of mealsLogs) {
    map[log.date] = { ...log, type: "nutrition-journal", time: `${log.date}T12:00:00` };
  }

  // Add notes
  for (const note of notesLogs) {
    if (!map[note.date]) {
      map[note.date] = { date: note.date, type: "nutrition-journal", time: `${note.date}T12:00:00`, meals: [] };
    }
    map[note.date].text = note.text;
  }

  return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
}
