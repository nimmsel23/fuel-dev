import { MICRO_KEYS } from "../../shared/config/dach.mjs";
import { normalizeOmega3 } from "../../shared/config/omega3.mjs";

// Absence is unknown, while an explicit numeric zero is a known value.
export function knownMicros(raw) {
  if (!raw || typeof raw !== "object") return {};
  return normalizeOmega3(Object.fromEntries(MICRO_KEYS.filter((key) => {
    const value = raw[key];
    return value != null && !(typeof value === "string" && !value.trim())
      && Number.isFinite(Number(value)) && Number(value) >= 0;
  }).map((key) => [key, Number(raw[key])])));
}

export function scaleKnownMicros(raw, factor) {
  return Object.fromEntries(Object.entries(knownMicros(raw)).map(([key, value]) => [key, Math.round(value * factor * 10) / 10]));
}
