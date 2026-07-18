import GoalsSection from "./GoalsSection.jsx";

// Dünner Wrapper — die eigentliche Sektion lebt in GoalsSection.jsx
// (wird auch von der vitalos-Shell direkt importiert, kein Doppel-Code).
export default function GoalsCard({ sectionCls, labelCls, inputCls }) {
  return <GoalsSection className={sectionCls} labelCls={labelCls} inputCls={inputCls} />;
}
