import test from "node:test";
import assert from "node:assert/strict";
import { canSaveNote, createNoteEditor, noteSavePayload, reduceNoteEditor } from "../src/client/lib/noteEditor.js";

function load(state, content) {
  return reduceNoteEditor(state, { type: "notes", date: state.date, content });
}

test("a note cannot be saved before its own day has loaded", () => {
  const loading = createNoteEditor("2026-11-08");
  assert.equal(noteSavePayload(loading), null);
  assert.equal(reduceNoteEditor(loading, { type: "edit", text: "zu früh" }).text, "");
  const ready = load(loading, "gespeicherter Text");
  assert.equal(ready.text, "gespeicherter Text");
  assert.equal(noteSavePayload(ready).date, "2026-11-08");
});

test("changing the day never keeps the previous text as the new day's note", () => {
  let state = load(createNoteEditor("2026-11-08"), "Sonntag");
  state = reduceNoteEditor(state, { type: "edit", text: "Sonntag geändert" });
  state = reduceNoteEditor(state, { type: "date", date: "2026-11-09" });
  assert.equal(state.date, "2026-11-09");
  assert.equal(state.text, "");
  assert.equal(noteSavePayload(state), null);
  state = load(state, "Montag");
  assert.equal(state.text, "Montag");
  assert.equal(noteSavePayload(state).content, "Montag");
  assert.equal(state.drafts["2026-11-08"], "Sonntag geändert");
});

test("returning to a day restores its unsaved text and ignores the server copy", () => {
  let state = load(createNoteEditor("2026-11-08"), "Server");
  state = reduceNoteEditor(state, { type: "edit", text: "Entwurf" });
  state = reduceNoteEditor(state, { type: "date", date: "2026-11-09" });
  state = load(state, "");
  state = reduceNoteEditor(state, { type: "date", date: "2026-11-08", drafts: state.drafts });
  state = load(state, "Server");
  assert.equal(state.text, "Entwurf");
  assert.equal(state.serverText, "Server");
  assert.equal(noteSavePayload(state).content, "Entwurf");
  state = reduceNoteEditor(state, { type: "discard" });
  assert.equal(state.text, "Server");
  assert.equal(state.dirty, false);
});

test("a server refresh does not replace text typed after the note loaded", () => {
  let state = load(createNoteEditor("2026-11-08"), "alt");
  state = reduceNoteEditor(state, { type: "edit", text: "neu" });
  state = load(state, "alt aus anderem Tab");
  assert.equal(state.text, "neu");
  assert.equal(state.serverText, "alt aus anderem Tab");
});

test("a journal draft waits for the loaded note and stays on that day", () => {
  let state = reduceNoteEditor(createNoteEditor("2026-11-08"), { type: "intent", draft: "unterwegs" });
  state = reduceNoteEditor(state, { type: "date", date: "2026-11-09" });
  state = load(state, "Montag");
  assert.equal(state.text, "Montag");
  state = reduceNoteEditor(state, { type: "date", date: "2026-11-08", drafts: state.drafts });
  state = load(state, "Sonntag");
  assert.equal(state.text, "Sonntag\nunterwegs");
  assert.equal(state.dirty, true);
});

test("a failed save keeps the text and can be retried", () => {
  let state = load(createNoteEditor("2026-11-08"), "");
  state = reduceNoteEditor(state, { type: "edit", text: "behalten" });
  const payload = noteSavePayload(state);
  state = reduceNoteEditor(state, { type: "save" });
  assert.equal(state.status, "saving");
  assert.equal(canSaveNote(state), false);
  state = reduceNoteEditor(state, { type: "save-error", date: payload.date, token: state.saveToken, message: "offline" });
  assert.equal(state.status, "error");
  assert.equal(state.error, "offline");
  assert.deepEqual(noteSavePayload(state), { date: "2026-11-08", content: "behalten" });
  state = reduceNoteEditor(state, { type: "save" });
  state = reduceNoteEditor(state, { type: "saved", date: "2026-11-08", content: "behalten", token: state.saveToken });
  assert.equal(state.dirty, false);
  assert.equal(state.drafts["2026-11-08"], undefined);
});

test("a late save acknowledgement does not clear a newer edit or another day", () => {
  let state = load(createNoteEditor("2026-11-08"), "A");
  state = reduceNoteEditor(state, { type: "edit", text: "A1" });
  state = reduceNoteEditor(state, { type: "save" });
  const firstToken = state.saveToken;
  state = reduceNoteEditor(state, { type: "date", date: "2026-11-09" });
  state = load(state, "B");
  state = reduceNoteEditor(state, { type: "saved", date: "2026-11-08", content: "A1", token: firstToken });
  assert.equal(state.date, "2026-11-09");
  assert.equal(state.text, "B");
  assert.equal(state.drafts["2026-11-08"], undefined);
  state = reduceNoteEditor(state, { type: "date", date: "2026-11-08", drafts: state.drafts });
  state = load(state, "A");
  state = reduceNoteEditor(state, { type: "edit", text: "A2" });
  state = reduceNoteEditor(state, { type: "saved", date: "2026-11-08", content: "A1", token: firstToken });
  assert.equal(state.text, "A2");
  assert.equal(state.drafts["2026-11-08"], "A2");
});
