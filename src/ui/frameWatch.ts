import { getSettings, updateSettings } from "./settings";

/**
 * Misst nach dem Start drei Sekunden lang die echte Bildrate. Ruckelt das
 * Gerät deutlich (viele Frames > 50 ms), werden die Dauer-Effekte automatisch
 * reduziert. Läuft nicht, wenn die Person die Einstellung selbst gewählt hat.
 */
export function watchFrameRate(onReduced: () => void): () => void {
  const s = getSettings();
  if (s.reduceEffects || s.effectsChosen || typeof requestAnimationFrame !== "function") return () => undefined;

  let raf = 0;
  let cancelled = false;
  let last = 0;
  let measured = 0;
  const frames: number[] = [];

  const evaluate = () => {
    if (cancelled) return;
    const slow = frames.filter((d) => d > 50).length;
    const avg = frames.reduce((a, b) => a + b, 0) / Math.max(1, frames.length);
    // Stromsparmodus (30 fps) zählt nicht als Ruckeln – erst echte Hänger.
    if (frames.length < 20 || slow / frames.length > 0.2 || avg > 45) {
      updateSettings({ reduceEffects: true });
      onReduced();
    }
  };

  const tick = (t: number) => {
    if (cancelled) return;
    if (document.visibilityState !== "visible") {
      last = 0;
    } else if (last) {
      const d = t - last;
      frames.push(d);
      measured += d;
    }
    last = t;
    if (measured >= 3000) evaluate();
    else raf = requestAnimationFrame(tick);
  };

  const start = window.setTimeout(() => {
    raf = requestAnimationFrame(tick);
  }, 1500);

  return () => {
    cancelled = true;
    window.clearTimeout(start);
    cancelAnimationFrame(raf);
  };
}
