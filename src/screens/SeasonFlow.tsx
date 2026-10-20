import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { ArrowRight, ArrowUp, ArrowDown, Plane, Flag as FlagIcon, Activity, Globe2, Star } from "lucide-react";
import type { SeasonRecord } from "@/lib/sim/types";
import { getClub } from "@/lib/sim/data";
import { Crest, LeagueBadge } from "@/ui/Crest";
import { TrophyIcon } from "@/ui/TrophyIcon";
import { CountUp, HexBackground, OvrHex } from "@/ui/primitives";
import { celebrate, thud, useBackHandler } from "@/ui/native";
import { useSettings } from "@/ui/settings";

const MONTHS = ["AUG", "SEP", "OKT", "NOV", "DEZ", "JAN", "FEB", "MÄR", "APR", "MAI"];

/* ------------------------------------------------------------ Anpfiff */

/** Kurze Anpfiff-Sequenz, während die Engine die Saison bereits berechnet hat. */
export function Kickoff({ label, seasons, onDone }: { label: string; seasons: number; onDone: () => void }) {
  const { fastAnimations } = useSettings();
  const total = fastAnimations ? 900 : 2600;
  const [month, setMonth] = useState(0);
  // Einmalig beenden – Timer und Tippen dürfen sich nicht doppeln.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finished = useRef(false);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    doneRef.current();
  };
  useBackHandler(true, finish);

  useEffect(() => {
    thud();
    const step = total / MONTHS.length;
    const iv = window.setInterval(() => setMonth((m) => Math.min(MONTHS.length - 1, m + 1)), step);
    const done = window.setTimeout(finish, total + 250);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={finish}>
      <HexBackground dark />
      <div style={{ position: "relative", width: "100%", maxWidth: 420, textAlign: "center" }}>
        <motion.div initial={{ x: -120, opacity: 0, skewX: -12 }} animate={{ x: 0, opacity: 1, skewX: 0 }} transition={{ type: "spring", damping: 16 }}>
          <div className="eyebrow" style={{ color: "#8fd134" }}>
            {seasons > 1 ? `${seasons} Saisons am Stück` : "Anpfiff"}
          </div>
          <div className="h-display" style={{ fontSize: 44 }}>
            Saison {label}
          </div>
        </motion.div>

        {/* Spielfeld in Perspektive mit laufendem Ball */}
        <div style={{ perspective: 600, margin: "26px auto 22px", width: "88%" }}>
          <div
            style={{
              position: "relative",
              aspectRatio: "1.55",
              transform: "rotateX(48deg)",
              background: "repeating-linear-gradient(90deg,#2f8f3e 0 10%,#36a046 10% 20%)",
              border: "3px solid rgba(255,255,255,.85)",
              boxShadow: "0 30px 60px -20px rgba(0,0,0,.7)",
            }}
          >
            <svg viewBox="0 0 155 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
              <g fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="0.8">
                <line x1="77.5" y1="0" x2="77.5" y2="100" />
                <circle cx="77.5" cy="50" r="13" />
                <rect x="0" y="26" width="22" height="48" />
                <rect x="133" y="26" width="22" height="48" />
              </g>
            </svg>
            <motion.div
              style={{ position: "absolute", width: 14, height: 14, marginLeft: -7, marginTop: -7, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%,#fff,#cfd8df)", boxShadow: "0 4px 6px rgba(0,0,0,.5)" }}
              animate={{
                left: ["50%", "68%", "40%", "85%", "60%", "20%", "35%", "92%", "50%"],
                top: ["50%", "30%", "70%", "45%", "20%", "55%", "80%", "50%", "50%"],
              }}
              transition={{ duration: total / 1000, ease: "easeInOut" }}
            />
          </div>
        </div>

        <div className="row" style={{ justifyContent: "center", gap: 4, flexWrap: "wrap" }}>
          {MONTHS.map((m, i) => (
            <motion.span
              key={m}
              className="tnum"
              animate={{ background: i <= month ? "#8fd134" : "rgba(255,255,255,.12)", color: i <= month ? "#10200a" : "#9fb3c3" }}
              style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, padding: "4px 6px", borderRadius: 3, minWidth: 34 }}
            >
              {m}
            </motion.span>
          ))}
        </div>
        <div className="tiny" style={{ marginTop: 22, color: "#9fb3c3", letterSpacing: "0.2em", textTransform: "uppercase" }}>
          Tippen zum Überspringen
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------------------------------------------------- Rückblick */

function Note({ icon, text, tone }: { icon: React.ReactNode; text: string; tone?: string }) {
  return (
    <div className="row" style={{ alignItems: "flex-start", gap: 8, fontSize: 13, color: tone ?? "#d6e2ea", textAlign: "left" }}>
      <span style={{ marginTop: 2, flex: "none" }}>{icon}</span>
      <span className="break">{text}</span>
    </div>
  );
}

function RecapStat({ label, value, delay, decimals = 0 }: { label: string; value: number; delay: number; decimals?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      style={{ background: "rgba(8,18,26,.82)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 5, padding: "8px 6px", textAlign: "center" }}
    >
      <div className="h-display tnum" style={{ fontSize: 30 }}>
        <CountUp to={value} delay={delay} decimals={decimals} />
      </div>
      <div className="tiny" style={{ color: "#9fb3c3", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
        {label}
      </div>
    </motion.div>
  );
}

/** Saisonbilanz nach dem Abpfiff – eine Seite je simulierter Saison. */
export function SeasonRecap({ seasons, isGk, onDone }: { seasons: SeasonRecord[]; isGk: boolean; onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const s = seasons[idx]!;
  const last = idx >= seasons.length - 1;
  const club = getClub(s.clubId);
  const delta = s.endOvr - s.startOvr;
  useBackHandler(true, onDone);

  useEffect(() => {
    if (s.trophies.length > 0) {
      const t = window.setTimeout(() => {
        celebrate();
        const shoot = (x: number) =>
          void confetti({ particleCount: 80, angle: x < 0.5 ? 60 : 120, spread: 65, origin: { x, y: 0.7 }, colors: ["#f0c63c", "#fff2b3", "#ffffff", "#8fd134"] });
        shoot(0.1);
        shoot(0.9);
      }, 1300);
      return () => window.clearTimeout(t);
    }
    if (s.promoted) {
      const t = window.setTimeout(celebrate, 900);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [s]);

  const notes: { icon: React.ReactNode; text: string; tone?: string }[] = [];
  if (s.missedSeason) notes.push({ icon: <Activity size={15} />, text: "Saison verletzungsbedingt verpasst.", tone: "#ff9b9b" });
  if (s.injuries.length) notes.push({ icon: <Activity size={15} />, text: `Verletzungen: ${s.injuries.join(", ")}`, tone: "#ff9b9b" });
  if (s.qualification) notes.push({ icon: <Star size={15} />, text: `Qualifiziert: ${s.qualification}`, tone: "#9be07a" });
  if (s.continental) notes.push({ icon: <Globe2 size={15} />, text: s.continental, tone: "#c6b3ff" });
  if (s.clubImpactNote) notes.push({ icon: <ArrowUp size={15} />, text: s.clubImpactNote, tone: "#9be07a" });
  if (s.transferNote) notes.push({ icon: <Plane size={15} />, text: s.transferNote });
  if (s.loanNote) notes.push({ icon: <Plane size={15} />, text: s.loanNote });
  if (s.nationalNote) notes.push({ icon: <FlagIcon size={15} />, text: s.nationalNote, tone: "#7fd8f0" });
  if (s.legendMoment) notes.push({ icon: <Star size={15} />, text: s.legendMoment, tone: "#f0c63c" });
  if (s.relationNote) notes.push({ icon: <Star size={15} />, text: s.relationNote });
  if (s.physicalNote) notes.push({ icon: <Activity size={15} />, text: s.physicalNote });
  if (s.worldNote) notes.push({ icon: <Globe2 size={15} />, text: s.worldNote, tone: "#9fb3c3" });

  return (
    <motion.div className="overlay" style={{ justifyContent: "flex-start", overflowY: "auto" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <HexBackground dark />
      <AnimatePresence mode="wait">
        <motion.div
          key={s.index}
          style={{ position: "relative", width: "100%", maxWidth: 460, textAlign: "center", margin: "auto 0" }}
          initial={{ opacity: 0, x: 80 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -80 }}
        >
          <div className="eyebrow" style={{ color: "#8fd134" }}>
            Abpfiff · Alter {s.age}
            {seasons.length > 1 ? ` · ${idx + 1}/${seasons.length}` : ""}
          </div>
          <div className="h-display" style={{ fontSize: 34 }}>
            Saison {s.seasonLabel}
          </div>

          <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 12, delay: 0.15 }} style={{ margin: "14px 0 6px" }}>
            <Crest name={club.name} size={78} />
          </motion.div>
          <div className="h-section break" style={{ fontSize: 22 }}>
            {club.name}
            {s.loan ? " · Leihe" : ""}
          </div>
          <div className="row tiny" style={{ justifyContent: "center", gap: 6, color: "#9fb3c3", marginTop: 4 }}>
            <LeagueBadge league={s.leagueLabel} division={s.division} size={16} />
            <span className="break">{s.leagueLabel}</span>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 1.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.45, type: "spring", damping: 14 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              margin: "16px 0 4px",
              padding: "6px 18px",
              background: s.promoted ? "linear-gradient(90deg,#5fa514,#8fd134)" : s.relegated ? "linear-gradient(90deg,#b42727,#e05252)" : "rgba(255,255,255,.1)",
              clipPath: "polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%)",
            }}
          >
            {s.promoted ? <ArrowUp size={22} /> : s.relegated ? <ArrowDown size={22} /> : null}
            <span className="h-display" style={{ fontSize: 30 }}>
              Platz {s.tablePosition}
            </span>
            {s.promoted ? <span className="h-section">Aufstieg</span> : s.relegated ? <span className="h-section">Abstieg</span> : null}
          </motion.div>

          <div className="grid-4" style={{ marginTop: 14 }}>
            <RecapStat label="Spiele" value={s.apps} delay={0.6} />
            <RecapStat label={isGk ? "Zu Null" : "Tore"} value={isGk ? s.cleanSheets : s.goals} delay={0.7} />
            <RecapStat label={isGk ? "Paraden" : "Assists"} value={isGk ? s.saves : s.assists} delay={0.8} />
            <RecapStat label="Ø Note" value={s.rating} delay={0.9} decimals={1} />
          </div>

          <motion.div className="row" style={{ justifyContent: "center", gap: 14, marginTop: 16 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05 }}>
            <OvrHex ovr={s.startOvr} size={42} />
            <ArrowRight size={20} color="#9fb3c3" />
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ delay: 1.3, duration: 0.5 }}>
              <OvrHex ovr={s.endOvr} size={54} />
            </motion.div>
            <span className="h-display tnum" style={{ fontSize: 26, color: delta > 0 ? "#9be07a" : delta < 0 ? "#ff9b9b" : "#9fb3c3" }}>
              {delta > 0 ? `+${delta}` : delta}
            </span>
          </motion.div>

          {s.trophies.length > 0 && (
            <div style={{ marginTop: 18, display: "grid", gap: 8 }}>
              {s.trophies.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, scale: 0.3, rotate: -10 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ delay: 1.3 + i * 0.25, type: "spring", damping: 10 }}
                  className="row"
                  style={{
                    justifyContent: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 6,
                    background: "linear-gradient(120deg,rgba(240,198,60,.3),rgba(240,198,60,.08))",
                    border: "1px solid rgba(240,198,60,.6)",
                  }}
                >
                  <TrophyIcon trophy={t} size={34} />
                  <span className="h-section break" style={{ color: "#ffe28a" }}>
                    {t.name}
                  </span>
                </motion.div>
              ))}
            </div>
          )}

          {notes.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} style={{ display: "grid", gap: 6, marginTop: 16, padding: 12, borderRadius: 6, background: "rgba(8,18,26,.82)", border: "1px solid rgba(255,255,255,.1)" }}>
              {notes.map((n, i) => (
                <Note key={i} icon={n.icon} text={n.text} {...(n.tone ? { tone: n.tone } : {})} />
              ))}
            </motion.div>
          )}

          <motion.button
            type="button"
            className="btn primary block"
            style={{ marginTop: 18 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            onClick={() => (last ? onDone() : setIdx(idx + 1))}
          >
            {last ? "Weiter" : "Nächste Saison"} <ArrowRight size={18} />
          </motion.button>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
