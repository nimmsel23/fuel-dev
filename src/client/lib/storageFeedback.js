export const STORAGE_FEEDBACK_EVENT = "fuel:storage-feedback";

export async function withStorageFeedback(label, write) {
  try {
    const result = await write();
    window.dispatchEvent(new CustomEvent(STORAGE_FEEDBACK_EVENT, { detail: { label, error: null } }));
    return result;
  } catch (error) {
    window.dispatchEvent(new CustomEvent(STORAGE_FEEDBACK_EVENT, { detail: { label, error: error.message || String(error) } }));
    throw error;
  }
}
