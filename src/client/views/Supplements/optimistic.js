// Apply/undo only this command; never restore an entire stale day snapshot.
export function applyIntakeCommand(current, command) {
  const log = current || { intakes: [] };
  const intakes = log.intakes || [];
  if (command.delete_id) return { ...log, intakes: intakes.filter(item => item.id !== command.delete_id) };
  if (!command.intake || intakes.some(item => item.id === command.intake.id)) return log;
  return { ...log, intakes: [...intakes, command.intake] };
}

export function undoIntakeCommand(current, command, removed) {
  if (command.intake) return applyIntakeCommand(current, { delete_id: command.intake.id });
  return removed ? applyIntakeCommand(current, { intake: removed }) : current;
}
