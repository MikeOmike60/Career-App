import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, animate } from "framer-motion";
import { ChevronLeft, X } from "lucide-react";
import { ovrTone } from "@/lib/sim/format";
import { tap, useBackHandler } from "./native";

/* --------------------------------------------------------------- Farben */

export const OVR_COLORS = {
  slate: ["#8a9aa8", "#5d6d7c", "#3c4955"],
  cyan: ["#3cc8e8", "#0893b5", "#056780"],
  emerald: ["#3fd59f", "#0b9b6a", "#066b48"],
  violet: ["#a985f5", "#7a45e0", "#4f22a8"],
  gold: ["#ffe28a", "#e3b021", "#a77b04"],
} as const;

export function ovrColor(ovr: number): string {
  return OVR_COLORS[ovrTone(ovr)][1];
}

export function ovrGradient(ovr: number): string {
  const [a, b, c] = OVR_COLORS[ovrTone(ovr)];
  return `linear-gradient(160deg, ${a} 0%, ${b} 55%, ${c} 100%)`;
}

/* ---------------------------------------------------- Hexagon-Hintergrund */

const HEXES: { x: number; y: number; r: number; o: number; dur: number; dx: number; dy: number; rot: number }[] = [
  { x: 330, y: 90, r: 120, o: 0.75, dur: 22, dx: -14, dy: 18, rot: 5 },
  { x: 60, y: 220, r: 70, o: 0.55, dur: 17, dx: 12, dy: -16, rot: -6 },
  { x: 250, y: 330, r: 46, o: 0.5, dur: 15, dx: -10, dy: -12, rot: 8 },
  { x: 380, y: 470, r: 95, o: 0.6, dur: 24, dx: -16, dy: 10, rot: -4 },
  { x: 40, y: 560, r: 110, o: 0.65, dur: 26, dx: 14, dy: -10, rot: 4 },
  { x: 220, y: 690, r: 64, o: 0.5, dur: 19, dx: 10, dy: -16, rot: -7 },
  { x: 150, y: 120, r: 30, o: 0.45, dur: 13, dx: 8, dy: 12, rot: 9 },
  { x: 300, y: 610, r: 34, o: 0.4, dur: 14, dx: -8, dy: -10, rot: -9 },
  { x: 120, y: 420, r: 22, o: 0.5, dur: 12, dx: 6, dy: -8, rot: 10 },
];

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

/** FIFA-13-Bühne: weiße, schwebende Hexagons auf silbrigem Grund. */
export function HexBackground({ dark }: { dark?: boolean }) {
  return (
    <div className={`stage ${dark ? "stage-dark" : ""}`} aria-hidden>
      <svg viewBox="0 0 420 800" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="hexfill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity={dark ? 0.16 : 1} />
            <stop offset="1" stopColor={dark ? "#7cc7ff" : "#e9eef2"} stopOpacity={dark ? 0.03 : 0.7} />
          </linearGradient>
          <filter id="hexshadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="9" floodColor="#24394a" floodOpacity={dark ? 0.5 : 0.16} />
          </filter>
        </defs>
        {HEXES.map((h, i) => (
          <g
            key={i}
            className="hex-float"
            style={
              {
                "--dur": `${h.dur}s`,
                "--delay": `${-i * 2.3}s`,
                "--dx": `${h.dx}px`,
                "--dy": `${h.dy}px`,
                "--rot": `${h.rot}deg`,
              } as React.CSSProperties
            }
          >
            <polygon
              points={hexPoints(h.x, h.y, h.r)}
              fill="url(#hexfill)"
              opacity={h.o}
              filter="url(#hexshadow)"
              stroke={dark ? "rgba(124,199,255,.35)" : "#fff"}
              strokeWidth={2}
            />
            <polygon
              points={hexPoints(h.x, h.y, h.r * 0.78)}
              fill="none"
              stroke={dark ? "rgba(124,199,255,.18)" : "rgba(19,32,43,.06)"}
              strokeWidth={1.5}
            />
          </g>
        ))}
      </svg>
      <div className="stage-ray" />
    </div>
  );
}

/** Hexagon-Wasserzeichen für Kacheln. */
export function HexMark({ color = "currentColor" }: { color?: string }) {
  return (
    <svg className="hexmark" viewBox="0 0 100 100" aria-hidden>
      <polygon points={hexPoints(50, 50, 46)} fill="none" stroke={color} strokeWidth="8" />
      <polygon points={hexPoints(50, 50, 26)} fill={color} />
    </svg>
  );
}

/* ------------------------------------------------------------- Kopfleiste */

export function TopBar({
  title,
  sub,
  onBack,
  right,
  brand,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  onBack?: (() => void) | undefined;
  right?: ReactNode;
  brand?: boolean;
}) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        {onBack && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Zurück"
            onClick={() => {
              tap();
              onBack();
            }}
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="grow">
          {brand ? (
            <div className="brand">
              Legenden<b>weg</b>
            </div>
          ) : (
            <div className="topbar-title">{title}</div>
          )}
          {sub ? <div className="topbar-sub">{sub}</div> : null}
        </div>
        {right}
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- Sheets */

export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
  full,
  gold,
  dismissable = true,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  full?: boolean;
  gold?: boolean;
  /** false = Pflichtentscheidung: kein Schließen über Hintergrund/Zurück. */
  dismissable?: boolean;
  footer?: ReactNode;
}) {
  useBackHandler(open, () => {
    if (dismissable) onClose();
  });
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => dismissable && onClose()}
          />
          <motion.section
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : undefined}
            className={`sheet ${full ? "full" : ""}`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            <div className={`sheet-head ${gold ? "gold" : ""}`}>
              {!full && <div className="sheet-grip" />}
              <div className="row">
                <div className="grow">
                  {eyebrow ? (
                    <div className="eyebrow" style={{ color: gold ? "#f0c63c" : "#8fd134" }}>
                      {eyebrow}
                    </div>
                  ) : null}
                  <h2 className="h-display break" style={{ fontSize: 24 }}>
                    {title}
                  </h2>
                </div>
                {dismissable && (
                  <button type="button" className="icon-btn" aria-label="Schließen" onClick={onClose}>
                    <X size={20} />
                  </button>
                )}
              </div>
            </div>
            <div className="sheet-body">{children}</div>
            {footer ? (
              <div style={{ padding: "10px 14px calc(12px + var(--safe-bottom))", borderTop: "1px solid var(--line)" }}>
                {footer}
              </div>
            ) : null}
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------ Kennzahlen */

export function Stat({ label, value, tone, small }: { label: string; value: ReactNode; tone?: string; small?: boolean }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${small ? "sm" : ""}`} style={tone ? { color: tone } : undefined}>
        {value}
      </div>
    </div>
  );
}

export function Bar({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
        <span className="stat-label">{label}</span>
        <span className="tnum" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>
          {Math.round(value)}
        </span>
      </div>
      <div className="bar">
        <motion.span
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(2, Math.min(100, value))}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          style={color ? { background: color } : {}}
        />
      </div>
    </div>
  );
}

export function OvrHex({ ovr, size = 44, label }: { ovr: number; size?: number; label?: string }) {
  return (
    <span
      className="ovr-hex"
      style={{ width: size, height: size * 1.12, background: ovrGradient(ovr), fontSize: size * 0.48 }}
      aria-label={label ?? `OVR ${ovr}`}
    >
      {ovr}
    </span>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="section-title">
      <h3 className="h-section grow">{children}</h3>
      {right}
    </div>
  );
}

export function Spark({ values, color, height = 36 }: { values: number[]; color: string; height?: number }) {
  if (values.length < 2) return <div className="tiny muted" style={{ height }}>–</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 26}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" style={{ width: "100%", height }} preserveAspectRatio="none" aria-hidden>
      <polygon points={`0,30 ${pts} 100,30`} fill={color} opacity="0.12" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ---------------------------------------------------------- Animationen */

/** Zählt sanft von `from` auf `to` hoch. */
export function CountUp({
  to,
  from = 0,
  duration = 1.1,
  delay = 0,
  decimals = 0,
  prefix = "",
}: {
  to: number;
  from?: number;
  duration?: number;
  delay?: number;
  decimals?: number;
  prefix?: string;
}) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    const controls = animate(from, to, {
      duration,
      delay,
      ease: "easeOut",
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [from, to, duration, delay]);
  return (
    <span className="tnum">
      {prefix}
      {value.toFixed(decimals)}
    </span>
  );
}

/** Kurze Toast-Meldungen im FIFA-Stil. */
export interface ToastItem {
  key: string;
  tone: "gold" | "up" | "down" | "info";
  title: string;
  subtitle: string;
}

export function Toasts({ items, onDismiss }: { items: ToastItem[]; onDismiss: (key: string) => void }) {
  return (
    <div className="toast-stack" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.button
            key={t.key}
            type="button"
            className={`toast ${t.tone}`}
            initial={{ opacity: 0, x: 60, skewX: -8 }}
            animate={{ opacity: 1, x: 0, skewX: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            onClick={() => onDismiss(t.key)}
          >
            <span className="grow">
              <span className="h-section" style={{ display: "block", fontSize: 17 }}>
                {t.title}
              </span>
              <span className="tiny" style={{ color: "#9fb3c3" }}>
                {t.subtitle}
              </span>
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** true auf sehr schmalen Displays (z. B. 320 px). */
export function useNarrow(max = 359): boolean {
  const query = `(max-width: ${max}px)`;
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return narrow;
}

/** Wischgeste nach links/rechts (für Tabwechsel), ohne vertikales Scrollen zu stören. */
export function useSwipe(onLeft: () => void, onRight: () => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (t) start.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      start.current = null;
      const t = e.changedTouches[0];
      if (!s || !t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Date.now() - s.t > 600 || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
      if (dx < 0) onLeft();
      else onRight();
    },
  };
}
