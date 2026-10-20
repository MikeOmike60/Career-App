import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Plus, Settings as SettingsIcon } from "lucide-react";
import type { GameState } from "@/lib/sim/types";
import { getClub } from "@/lib/sim/data";
import { seasonLabel } from "@/lib/sim/engine";
import { Crest } from "@/ui/Crest";
import { HexMark, OvrHex } from "@/ui/primitives";
import { tap, thud } from "@/ui/native";

/** Logo: Ball im Hexagon. */
function Logo() {
  return (
    <svg viewBox="0 0 120 132" width={118} height={130} aria-hidden>
      <defs>
        <linearGradient id="lg-hex" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2aa6f2" />
          <stop offset="1" stopColor="#05508a" />
        </linearGradient>
        <linearGradient id="lg-ball" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#cfd8df" />
        </linearGradient>
      </defs>
      <polygon points="60,4 114,35 114,97 60,128 6,97 6,35" fill="url(#lg-hex)" stroke="#fff" strokeWidth="5" />
      <polygon points="60,18 101,42 101,90 60,114 19,90 19,42" fill="none" stroke="#8fd134" strokeWidth="3" />
      <circle cx="60" cy="66" r="30" fill="url(#lg-ball)" stroke="#0e1a24" strokeWidth="2.5" />
      <path d="M60 52 l11.4 8.3 -4.4 13.4 h-14 l-4.4 -13.4 Z" fill="#0e1a24" />
      <path d="M60 36v16M71.4 60.3l14.7-4.8M67 73.7l9 12.4M53 73.7l-9 12.4M48.6 60.3l-14.7-4.8" stroke="#0e1a24" strokeWidth="2.5" />
    </svg>
  );
}

export function Title({
  state,
  onContinue,
  onNew,
  onSettings,
}: {
  state: GameState | null;
  onContinue: () => void;
  onNew: () => void;
  onSettings: () => void;
}) {
  const [started, setStarted] = useState(false);
  const club = state && state.phase !== "offers" ? getClub(state.player.clubId) : null;

  return (
    <div
      className="screen"
      style={{ alignItems: "center", justifyContent: "center", padding: "calc(20px + var(--safe-top)) 18px calc(20px + var(--safe-bottom))" }}
      onClick={() => {
        if (!started) {
          thud();
          setStarted(true);
        }
      }}
    >
      <motion.div initial={{ scale: 0.4, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: "spring", damping: 12, stiffness: 120 }}>
        <Logo />
      </motion.div>
      <motion.h1
        className="h-display"
        style={{ fontSize: "clamp(46px, 14vw, 76px)", marginTop: 10, textAlign: "center", color: "var(--dark)", textShadow: "0 2px 0 #fff" }}
        initial={{ x: -80, opacity: 0, skewX: -14 }}
        animate={{ x: 0, opacity: 1, skewX: 0 }}
        transition={{ delay: 0.25, type: "spring", damping: 14 }}
      >
        Legenden<span style={{ color: "var(--blue)" }}>weg</span>
      </motion.h1>
      <motion.div
        className="eyebrow"
        style={{ color: "var(--ink-2)", letterSpacing: "0.32em", marginTop: 2 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
      >
        Fußball-Karrieremodus
      </motion.div>

      <div style={{ width: "100%", maxWidth: 380, marginTop: 34, minHeight: 190 }}>
        <AnimatePresence mode="wait">
          {!started ? (
            <motion.div key="press" initial={{ opacity: 0 }} animate={{ opacity: [0.35, 1, 0.35], transition: { duration: 1.8, repeat: Infinity } }} exit={{ opacity: 0, transition: { duration: 0.15 } }} style={{ textAlign: "center" }}>
              <span className="h-section" style={{ fontSize: 20, letterSpacing: "0.2em" }}>
                Tippe zum Starten
              </span>
            </motion.div>
          ) : (
            <motion.div key="menu" style={{ display: "grid", gap: 10 }} initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }}>
              {state && (
                <motion.button
                  type="button"
                  variants={{ hidden: { opacity: 0, x: 60 }, show: { opacity: 1, x: 0 } }}
                  className="tile blue shine"
                  style={{ padding: 14 }}
                  onClick={() => {
                    tap();
                    onContinue();
                  }}
                >
                  <HexMark />
                  <div className="row">
                    {club ? <Crest name={club.name} size={40} /> : <Play size={28} />}
                    <div className="grow">
                      <div className="tile-label" style={{ fontSize: 24 }}>
                        Karriere fortsetzen
                      </div>
                      <div className="tiny break" style={{ opacity: 0.85 }}>
                        {state.profile.name}
                        {club ? ` · ${club.name}` : ""}
                        {state.phase === "end" ? " · Hall of Fame" : ` · ${seasonLabel(state.startYear, state.seasonIndex)}`}
                      </div>
                    </div>
                    <OvrHex ovr={state.player.ovr} size={40} />
                  </div>
                </motion.button>
              )}
              <motion.button
                type="button"
                variants={{ hidden: { opacity: 0, x: 60 }, show: { opacity: 1, x: 0 } }}
                className={`tile ${state ? "" : "lime shine"}`}
                style={{ padding: 14 }}
                onClick={() => {
                  tap();
                  onNew();
                }}
              >
                <HexMark color="#0a84d6" />
                <div className="row">
                  <Plus size={28} />
                  <div className="tile-label grow" style={{ fontSize: 24 }}>
                    Neue Karriere
                  </div>
                </div>
              </motion.button>
              <motion.button
                type="button"
                variants={{ hidden: { opacity: 0, x: 60 }, show: { opacity: 1, x: 0 } }}
                className="tile dark"
                style={{ padding: 12 }}
                onClick={() => {
                  tap();
                  onSettings();
                }}
              >
                <HexMark />
                <div className="row">
                  <SettingsIcon size={22} />
                  <div className="tile-label grow" style={{ fontSize: 20 }}>
                    Einstellungen
                  </div>
                </div>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="tiny muted" style={{ position: "absolute", bottom: "calc(10px + var(--safe-bottom))", textAlign: "center", padding: "0 20px" }}>
        Privates, inoffizielles Fanprojekt · keine Verbindung zu Vereinen, Ligen oder Verbänden
      </div>
    </div>
  );
}
