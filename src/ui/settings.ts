import { useSyncExternalStore } from "react";

/** Geräteeinstellungen – getrennt vom Spielstand, damit ein Reset sie nicht löscht. */
export interface Settings {
  haptics: boolean;
  /** Anpfiff- und Saisonanimationen kurz halten. */
  fastAnimations: boolean;
  /** Dauer-Effekte (schwebende Hexagons, Glanz, Pulsieren) aus – für ältere Handys. */
  reduceEffects: boolean;
}

const KEY = "legendenweg:settings:v1";
const DEFAULTS: Settings = { haptics: true, fastAnimations: false, reduceEffects: false };

let current: Settings = read();
const listeners = new Set<() => void>();

function read(): Settings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      haptics: typeof parsed.haptics === "boolean" ? parsed.haptics : DEFAULTS.haptics,
      fastAnimations: typeof parsed.fastAnimations === "boolean" ? parsed.fastAnimations : DEFAULTS.fastAnimations,
      reduceEffects: typeof parsed.reduceEffects === "boolean" ? parsed.reduceEffects : DEFAULTS.reduceEffects,
    };
  } catch {
    return DEFAULTS;
  }
}

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(current));
  } catch {
    /* Speicher voll oder gesperrt – Einstellung gilt dann nur für diese Sitzung. */
  }
  for (const l of listeners) l();
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
