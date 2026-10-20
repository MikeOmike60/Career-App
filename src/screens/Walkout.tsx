import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { countryName } from "@/lib/sim/data";
import { HexBackground, ovrColor } from "@/ui/primitives";
import { PlayerCard, type CardData } from "@/ui/PlayerCard";
import { Flag } from "@/ui/Flag";
import { celebrate, thud, useBackHandler } from "@/ui/native";
import { POSITION_LABEL } from "./Setup";
import type { Position } from "@/lib/sim/types";

/**
 * Enthüllung im Stil eines Pack-Walkouts: Nationalität → Position → Karte.
 * Zeigt ausschließlich echte Werte des frischen Spielstands.
 */
export function Walkout({ data, age, onDone }: { data: CardData; age: number; onDone: () => void }) {
  const [stage, setStage] = useState(0);
  useBackHandler(true, onDone);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setStage((v) => Math.max(v, 1)), 700),
      window.setTimeout(() => setStage((v) => Math.max(v, 2)), 1700),
      window.setTimeout(() => {
        setStage((v) => {
          if (v < 3) thud();
          return 3;
        });
      }, 2700),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  useEffect(() => {
    if (stage !== 3) return;
    celebrate();
    if (data.ovr >= 65) {
      void confetti({ particleCount: 90, spread: 70, origin: { y: 0.45 }, colors: ["#8fd134", "#0a84d6", "#ffffff", "#f0c63c"] });
    }
  }, [stage, data.ovr]);

  const glow = ovrColor(data.ovr);

  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => (stage < 3 ? setStage(3) : onDone())}>
      <HexBackground dark still />
      {/* Lichtstrahlen: bildschirmgroß und nur pulsierend – eine riesige rotierende
          Fläche hat Safari auf dem iPhone auf ~3 fps gedrückt. */}
      <motion.div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `repeating-conic-gradient(from 0deg at 50% 45%, ${glow}38 0deg 8deg, transparent 8deg 22deg)`,
          willChange: "opacity",
        }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
      />
      <motion.div
        aria-hidden
        style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", background: `radial-gradient(circle, ${glow}aa, transparent 65%)` }}
        animate={{ scale: stage >= 3 ? [1, 1.4, 1.15] : 0.6 + stage * 0.15, opacity: stage >= 1 ? 1 : 0.4 }}
        transition={{ duration: 0.8 }}
      />

      <div style={{ position: "relative", display: "grid", placeItems: "center", minHeight: 300 }}>
        <AnimatePresence mode="wait">
          {stage === 1 && (
            <motion.div key="nat" initial={{ scale: 2.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} style={{ textAlign: "center" }}>
              <Flag code={data.nat} size={96} />
              <div className="h-display" style={{ fontSize: 30, marginTop: 10 }}>
                {countryName(data.nat)}
              </div>
            </motion.div>
          )}
          {stage === 2 && (
            <motion.div key="pos" initial={{ scale: 2.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} style={{ textAlign: "center" }}>
              <div className="h-display" style={{ fontSize: 88, color: "#8fd134" }}>
                {data.pos}
              </div>
              <div className="h-display" style={{ fontSize: 22 }}>
                {POSITION_LABEL[data.pos as Position] ?? data.pos}
              </div>
            </motion.div>
          )}
          {stage >= 3 && (
            <motion.div
              key="card"
              initial={{ rotateY: 180, scale: 0.4, opacity: 0 }}
              animate={{ rotateY: 0, scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 14, stiffness: 120 }}
              style={{ display: "grid", placeItems: "center", perspective: 800 }}
            >
              <PlayerCard data={data} width={210} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {stage >= 3 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} style={{ position: "relative", textAlign: "center", marginTop: 18 }}>
          <div className="eyebrow" style={{ color: "#8fd134" }}>
            Ein Talent mit {age} Jahren
          </div>
          <div className="h-display" style={{ fontSize: 26, marginTop: 4 }}>
            {data.name}
          </div>
          <button type="button" className="btn primary" style={{ marginTop: 16, minWidth: 220 }} onClick={onDone}>
            Zu den Akademien
          </button>
        </motion.div>
      )}
      {stage < 3 && (
        <div className="tiny" style={{ position: "absolute", bottom: "calc(24px + var(--safe-bottom))", color: "#9fb3c3", letterSpacing: "0.2em", textTransform: "uppercase" }}>
          Tippen zum Überspringen
        </div>
      )}
    </motion.div>
  );
}
