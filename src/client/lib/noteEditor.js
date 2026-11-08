export function pendingNoteKey(date) {
  return `pending:${date}`;
}

export function createNoteEditor(date, drafts = {}) {
  const stashed = typeof drafts[date] === "string" ? drafts[date] : null;
  const pending = typeof drafts[pendingNoteKey(date)] === "string" ? drafts[pendingNoteKey(date)] : "";
  return {
    date,
    loadedDate: null,
    serverText: null,
    text: stashed ?? "",
    textDate: stashed == null ? null : date,
    dirty: stashed != null,
    pendingDraft: pending,
    status: "loading",
    error: "",
    saveToken: 0,
    drafts: { ...drafts },
  };
}

export function canSaveNote(state) {
  return Boolean(state)
    && state.loadedDate === state.date
    && state.textDate === state.date
    && state.status !== "saving"
    && state.status !== "loading"
    && typeof state.text === "string";
}

export function noteSavePayload(state) {
  if (!canSaveNote(state)) return null;
  return { date: state.date, content: state.text };
}

function rememberDraft(drafts, date, text) {
  const next = { ...drafts };
  if (typeof text === "string") next[date] = text;
  else delete next[date];
  return next;
}

export function reduceNoteEditor(state, event) {
  switch (event.type) {
    case "date": {
      if (!event.date || event.date === state.date) return state;
      let drafts = { ...(event.drafts || state.drafts || {}) };
      if (state.dirty && state.textDate === state.date && state.loadedDate === state.date) {
        drafts = rememberDraft(drafts, state.date, state.text);
      }
      if (state.pendingDraft && state.loadedDate !== state.date) {
        drafts = { ...drafts, [pendingNoteKey(state.date)]: state.pendingDraft };
      }
      return { ...createNoteEditor(event.date, drafts), saveToken: state.saveToken };
    }
    case "notes": {
      if (event.date !== state.date || typeof event.content !== "string") return state;
      if (state.dirty && state.textDate === state.date) {
        let text = state.text;
        let drafts = { ...state.drafts };
        delete drafts[pendingNoteKey(event.date)];
        if (state.pendingDraft) {
          text = text ? `${text}\n${state.pendingDraft}` : state.pendingDraft;
          drafts = rememberDraft(drafts, event.date, text);
        }
        return {
          ...state,
          text,
          textDate: event.date,
          dirty: true,
          pendingDraft: "",
          drafts,
          loadedDate: event.date,
          serverText: event.content,
          status: state.status === "saving" || state.status === "error" ? state.status : "ready",
        };
      }
      let text = event.content;
      let dirty = false;
      let drafts = { ...state.drafts };
      delete drafts[pendingNoteKey(event.date)];
      if (state.pendingDraft) {
        text = text ? `${text}\n${state.pendingDraft}` : state.pendingDraft;
        dirty = true;
        drafts = rememberDraft(drafts, event.date, text);
      } else {
        delete drafts[event.date];
      }
      return {
        ...state,
        loadedDate: event.date,
        serverText: event.content,
        text,
        textDate: event.date,
        dirty,
        pendingDraft: "",
        drafts,
        status: "ready",
        error: "",
      };
    }
    case "edit": {
      if (state.loadedDate !== state.date || state.status === "saving") return state;
      const text = String(event.text ?? "");
      const dirty = text !== (state.serverText ?? "");
      return {
        ...state,
        text,
        textDate: state.date,
        dirty,
        drafts: rememberDraft(state.drafts, state.date, dirty ? text : undefined),
      };
    }
    case "intent": {
      const draft = String(event.draft || "");
      if (!draft) return state;
      if (state.loadedDate !== state.date) {
        const pendingDraft = state.pendingDraft ? `${state.pendingDraft}\n${draft}` : draft;
        return {
          ...state,
          pendingDraft,
          drafts: { ...state.drafts, [pendingNoteKey(state.date)]: pendingDraft },
        };
      }
      const text = state.text ? `${state.text}\n${draft}` : draft;
      return {
        ...state,
        text,
        textDate: state.date,
        dirty: true,
        drafts: rememberDraft(state.drafts, state.date, text),
      };
    }
    case "save": {
      if (!canSaveNote(state)) return state;
      return { ...state, status: "saving", error: "", saveToken: (state.saveToken || 0) + 1 };
    }
    case "saved": {
      if (event.token !== state.saveToken) return state;
      const drafts = { ...state.drafts };
      if (drafts[event.date] === event.content) delete drafts[event.date];
      if (state.date !== event.date || state.text !== event.content) return { ...state, drafts };
      return {
        ...state,
        drafts,
        serverText: state.text,
        dirty: false,
        status: "ready",
        error: "",
        loadedDate: state.date,
        textDate: state.date,
      };
    }
    case "save-error": {
      if (event.token !== state.saveToken || state.date !== event.date) return state;
      return { ...state, status: "error", error: event.message || "Die Notiz konnte nicht gespeichert werden." };
    }
    case "discard": {
      if (state.loadedDate !== state.date) return state;
      const drafts = { ...state.drafts };
      delete drafts[state.date];
      return {
        ...state,
        drafts,
        text: state.serverText ?? "",
        textDate: state.date,
        dirty: false,
        status: "ready",
        error: "",
      };
    }
    default:
      return state;
  }
}
