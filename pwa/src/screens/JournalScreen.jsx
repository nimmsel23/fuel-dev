import { useState, useEffect } from "react";
import { getJournal, saveJournal } from "../db.js";

export default function JournalScreen({ date }) {
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setSaved(true);
    getJournal(date).then((c) => { setContent(c); setLoading(false); });
  }, [date]);

  async function save() {
    await saveJournal(date, content);
    setSaved(true);
  }

  return (
    <div className="screen">
      <header>
        <h1>Journal</h1>
        <button onClick={save} disabled={saved} style={{ flexShrink: 0 }}>
          {saved ? "Gespeichert" : "Speichern"}
        </button>
      </header>
      {loading ? (
        <p className="loading">Lade…</p>
      ) : (
        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); setSaved(false); }}
          placeholder="Wie war der Tag? Energie, Stimmung, Besonderheiten…"
          style={{ width: "100%", minHeight: "60vh", resize: "vertical", lineHeight: 1.6 }}
        />
      )}
    </div>
  );
}
