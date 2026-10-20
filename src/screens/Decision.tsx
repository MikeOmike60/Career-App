import { useEffect, useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import confetti from "canvas-confetti";
import { ArrowRight, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import type { ClubOffer, DecisionLog, DecisionOption, InvestorProject, PendingDecision } from "@/lib/sim/types";
import { getClub, countryName } from "@/lib/sim/data";
import { formatInvestorMoney } from "@/lib/sim/investor";
import { regionName } from "@/lib/sim/regions";
import { Crest, LeagueBadge } from "@/ui/Crest";
import { Flag } from "@/ui/Flag";
import { CountUp, OvrHex, Sheet } from "@/ui/primitives";
import { celebrate, tap, warn } from "@/ui/native";

/* ------------------------------------------------------------ Hilfen */

function Effect({ label, value, dir = "flat" }: { label: string; value: string; dir?: "up" | "down" | "flat" }) {
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "■";
  return (
    <span className={`chip ${dir === "up" ? "up" : dir === "down" ? "down" : ""}`}>
      <span aria-hidden>{arrow}</span>
      <span style={{ fontWeight: 600, opacity: 0.75, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span className="tnum">{value}</span>
    </span>
  );
}

export function decisionEyebrow(p: PendingDecision): string {
  if (p.kind === "club") {
    if (p.variant === "investor") return "Investoren-Projekt · einmalige Gelegenheit";
    if (p.variant === "stagnation") return "Sportliche Sackgasse";
    if (p.variant === "loan-return") return "Rückkehr aus der Leihe";
    return p.forced ? "Vereinswahl · Pflicht" : "Transferfenster";
  }
  if (p.kind === "nation") return "Nationalteam";
  if (p.kind === "comeback") return "Comeback";
  if (p.kind === "retirement") return "Noch ein Jahr?";
  return "Deine Entwicklung";
}

/* ------------------------------------------------------- OVR-Optionen */

function OptionCard({ option, onChoose, lossStreak = 0 }: { option: DecisionOption; onChoose: (id: string) => void; lossStreak?: number }) {
  const eff = option.ovrEffect;
  const gamble = eff.type === "gamble" ? eff : null;
  const sure = gamble ? gamble.successChance >= 100 : false;
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      className={`tile ${gamble ? "" : ""}`}
      style={{ padding: 0 }}
      onClick={() => onChoose(option.id)}
    >
      <div style={{ padding: "12px 12px 10px" }}>
        <div className="row">
          {gamble ? <TrendingUp size={20} color="var(--blue)" /> : <ShieldCheck size={20} color="var(--muted)" />}
          <div className="h-section grow break" style={{ fontSize: 19 }}>
            {option.label}
          </div>
        </div>
        <p className="small muted" style={{ margin: "4px 0 8px" }}>
          {option.hint}
        </p>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {gamble ? (
            <>
              {gamble && lossStreak > 0 ? (
                <span className="chip lime">{sure ? "Pechsträhnen-Schutz · sicherer Erfolg" : "Pechsträhnen-Schutz · Chance erhöht"}</span>
              ) : null}
              <Effect label="OVR" value={`+${gamble.gain} bei Erfolg`} dir="up" />
              {!sure && <Effect label="OVR" value={`${gamble.loss} bei Misserfolg`} dir="down" />}
              <Effect label="Chance" value={`${gamble.successChance}%`} />
            </>
          ) : (
            <Effect label="OVR" value="0 · kein Risiko" />
          )}
        </div>
      </div>
      {gamble ? (
        <div className="tnum" style={{ display: "flex", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "#fff" }}>
          <span style={{ flex: gamble.successChance, background: "linear-gradient(90deg,#1f9d55,#3fc77a)", padding: "7px 10px", display: "flex", justifyContent: "space-between", minWidth: 0 }}>
            <span>+{gamble.gain}</span>
            <span>{gamble.successChance}%</span>
          </span>
          {!sure && (
            <span style={{ flex: 100 - gamble.successChance, background: "linear-gradient(90deg,#e05252,#b42727)", padding: "7px 10px", display: "flex", justifyContent: "space-between", minWidth: 0 }}>
              <span>{gamble.loss}</span>
              <span>{100 - gamble.successChance}%</span>
            </span>
          )}
        </div>
      ) : (
        <div style={{ background: "var(--panel-soft)", borderTop: "1px solid var(--line)", padding: "7px 10px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--muted)" }}>
          0 OVR · kein Rating-Risiko
        </div>
      )}
    </motion.button>
  );
}

/* ------------------------------------------------------- Vereinsangebote */

function OfferCard({ offer, onChoose, currentStrength }: { offer: ClubOffer; onChoose: (id: string) => void; currentStrength?: number | undefined }) {
  const club = getClub(offer.clubId);
  const loan = offer.deal === "loan";
  const region = club.region ? regionName(club.country, club.region) : undefined;
  const dir = typeof currentStrength === "number" ? (offer.strength > currentStrength ? "up" : offer.strength < currentStrength ? "down" : "flat") : "flat";
  return (
    <motion.button type="button" whileTap={{ scale: 0.98 }} className="tile" style={{ padding: 12 }} onClick={() => onChoose(offer.id)}>
      <div className="row" style={{ alignItems: "center" }}>
        <Crest name={club.name} size={46} />
        <div className="grow">
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            <span className="h-section break" style={{ fontSize: 19 }}>
              {club.name}
            </span>
            <span className={`chip ${loan ? "blue" : "lime"}`}>{loan ? "Leihe · 1 Saison" : "Fester Wechsel"}</span>
          </div>
          <div className="row tiny muted" style={{ gap: 5, marginTop: 2, flexWrap: "wrap" }}>
            {offer.country ? <Flag code={offer.country} /> : null}
            <LeagueBadge league={offer.leagueLabel} division={offer.division} size={15} />
            <span className="break">
              {offer.country ? `${countryName(offer.country)} · ` : ""}
              {offer.leagueLabel}
              {region ? ` · ${region}` : ""}
            </span>
          </div>
        </div>
        <OvrHex ovr={offer.strength} size={38} label={`Clubstärke ${offer.strength}`} />
      </div>
      <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        <Effect label="Clubstärke" value={typeof currentStrength === "number" ? `${Math.round(currentStrength)} → ${offer.strength}` : String(offer.strength)} dir={dir} />
        <Effect label="Rolle" value={offer.expectedRole} />
        <Effect label="Spielzeit" value={offer.playtime} />
        {loan ? <Effect label="Vertrag" value="bleibt beim Stammverein" /> : null}
      </div>
      <p className="small muted break" style={{ margin: "8px 0 0" }}>
        {offer.reason}
      </p>
      {offer.warning ? (
        <p className="notice error small break" style={{ marginTop: 8, fontWeight: 700 }}>
          ⚠ {offer.warning}
        </p>
      ) : null}
    </motion.button>
  );
}

function InvestorDossier({ project }: { project: InvestorProject }) {
  const club = getClub(project.clubId);
  return (
    <section className="panel pad" style={{ background: "linear-gradient(160deg,#fffaf0,#fbf0cf)", borderColor: "#efd99a" }}>
      <div className="eyebrow" style={{ color: "var(--gold-2)" }}>
        Investoren-Dossier
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <Crest name={club.name} size={44} />
        <div className="grow">
          <div className="h-section break">{club.name}</div>
          <div className="row tiny muted" style={{ gap: 5, flexWrap: "wrap" }}>
            <Flag code={project.country} />
            <span className="break">
              {countryName(project.country)} · {project.leagueLabel}
            </span>
          </div>
        </div>
      </div>
      <p className="small muted break">
        Übernahme durch {project.investorName} · {project.startedYearLabel}
      </p>
      <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
        <Effect label="Clubstärke" value={`${project.strengthBefore} → ${project.strengthAfter}`} dir="up" />
        <Effect label="Budget" value="praktisch ohne Grenze" dir="up" />
        <Effect label="Rolle" value={project.role} />
      </div>
      <div className="grid-2" style={{ marginTop: 10 }}>
        <div className="stat">
          <div className="stat-label">Stadion</div>
          <div className="tiny muted break">Vorher: {project.stadiumBefore}</div>
          <div className="small break" style={{ fontWeight: 700, color: "var(--gold-2)" }}>
            Neu: {project.stadiumAfter}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Infrastruktur</div>
          <div className="tiny muted break">Vorher: {project.infrastructureBefore}</div>
          <div className="small break" style={{ fontWeight: 700, color: "var(--gold-2)" }}>
            Neu: {project.infrastructureAfter}
          </div>
        </div>
      </div>
      <div className="stat-label" style={{ marginTop: 12 }}>
        Bereits verpflichtet ({project.stars.length})
      </div>
      <div style={{ display: "grid", gap: 5, marginTop: 5 }}>
        {project.stars.map((star) => (
          <div key={star.name} className="row stat" style={{ padding: "6px 8px" }}>
            <Flag code={star.nationality} />
            <span className="grow break small" style={{ fontWeight: 700 }}>
              {star.name}
            </span>
            <span className="tiny muted tnum">
              {star.position} · {star.ovr} OVR · {star.age} J.
            </span>
          </div>
        ))}
      </div>
      <div className="grid-2" style={{ marginTop: 10 }}>
        <div className="stat">
          <div className="stat-label">Wochengehalt</div>
          <div className="stat-value sm" style={{ color: "var(--gold-2)" }}>
            {formatInvestorMoney(project.wage)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Handgeld</div>
          <div className="stat-value sm" style={{ color: "var(--gold-2)" }}>
            {formatInvestorMoney(project.signingBonus)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Garantiert 1. Jahr</div>
          <div className="stat-value sm" style={{ color: "var(--gold-2)" }}>
            {formatInvestorMoney(project.firstYearGuarantee)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Vertrag</div>
          <div className="stat-value sm">{project.contractYears} Jahre</div>
        </div>
      </div>
      <p className="small break" style={{ marginBottom: 0 }}>
        <b>Sportliches Ziel:</b> {project.target}
      </p>
      <p className="tiny muted" style={{ marginBottom: 0 }}>
        Kein Rating-Bonus, keine Titelgarantie. Das erste Jahr macht dich finanziell unabhängig.
      </p>
    </section>
  );
}

function PlainOption({ label, hint, onClick, strong }: { label: string; hint: string; onClick: () => void; strong?: boolean }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.98 }} className={`tile ${strong ? "selected" : ""}`} style={{ padding: 12 }} onClick={onClick}>
      <div className="row">
        <div className="grow">
          <div className="h-section break" style={{ fontSize: 18 }}>
            {label}
          </div>
          <div className="small muted break" style={{ marginTop: 2 }}>
            {hint}
          </div>
        </div>
        <ArrowRight size={18} className="muted" />
      </div>
    </motion.button>
  );
}

/* ---------------------------------------------------- Gamble-Auflösung */

/**
 * Die Engine hat den Ausgang bereits berechnet. Die Nadel pendelt nur aus
 * und landet in genau dem Bereich, der tatsächlich eingetreten ist.
 */
export function GambleReveal({ consequence, instant }: { consequence: DecisionLog; instant?: boolean }) {
  const g = consequence.gamble!;
  const win = g.outcome === "win";
  const controls = useAnimationControls();
  const [done, setDone] = useState(Boolean(instant));
  const final = win ? g.successChance * (0.25 + ((g.successChance * 7) % 50) / 100) : g.successChance + (100 - g.successChance) * 0.55;
  const ovrAfter = consequence.ovrAfter ?? 0;
  const ovrBefore = ovrAfter - g.delta;

  useEffect(() => {
    let cancelled = false;
    if (instant) {
      void controls.set({ x: `${final}%` });
      return;
    }
    void controls
      .start({
        x: ["0%", "96%", "8%", "88%", "20%", `${final}%`],
        transition: { duration: 2.1, ease: "easeInOut", times: [0, 0.22, 0.45, 0.65, 0.82, 1] },
      })
      .then(() => {
        if (cancelled) return;
        setDone(true);
        if (win) {
          celebrate();
          void confetti({ particleCount: 70, spread: 60, origin: { y: 0.55 }, colors: ["#8fd134", "#1f9d55", "#ffffff"] });
        } else warn();
      });
    return () => {
      cancelled = true;
    };
  }, [controls, final, win, instant]);

  return (
    <div className="panel pad" style={{ overflow: "hidden" }}>
      <div className="eyebrow">Auflösung</div>
      <div className="h-section break" style={{ marginTop: 2 }}>
        {consequence.choice}
      </div>
      <div style={{ position: "relative", marginTop: 14, height: 40 }}>
        <div className="tnum" style={{ display: "flex", height: 40, borderRadius: 4, overflow: "hidden", fontFamily: "var(--font-display)", fontWeight: 800, color: "#fff" }}>
          <motion.div
            animate={done ? { opacity: win ? 1 : 0.25 } : { opacity: 1 }}
            style={{ flex: g.successChance, background: "linear-gradient(90deg,#1f9d55,#3fc77a)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px" }}
          >
            <span>+{g.gain} OVR</span>
            <span>{g.successChance}%</span>
          </motion.div>
          {g.successChance < 100 && (
            <motion.div
              animate={done ? { opacity: win ? 0.25 : 1 } : { opacity: 1 }}
              style={{ flex: 100 - g.successChance, background: "linear-gradient(90deg,#e05252,#b42727)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px" }}
            >
              <span>{g.loss}</span>
              <span>{100 - g.successChance}%</span>
            </motion.div>
          )}
        </div>
        {/* Träger in voller Breite: x in Prozent entspricht der Balkenbreite (nur GPU). */}
        <motion.div animate={controls} initial={{ x: "0%" }} style={{ position: "absolute", top: -8, bottom: -8, left: 0, right: 0, pointerEvents: "none", willChange: "transform" }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: -2, width: 4, background: "#13202b", borderRadius: 2, boxShadow: "0 0 0 2px #fff" }}>
            <div style={{ position: "absolute", top: -6, left: -6, width: 16, height: 10, background: "#13202b", clipPath: "polygon(0 0,100% 0,50% 100%)" }} />
          </div>
        </motion.div>
      </div>
      <motion.div
        className="row"
        style={{ marginTop: 16, justifyContent: "center", gap: 16 }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={done ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
        transition={{ type: "spring", damping: 12 }}
      >
        <OvrHex ovr={ovrBefore} size={46} />
        <ArrowRight size={22} className="muted" />
        <motion.div animate={done ? { scale: [1, 1.25, 1] } : {}} transition={{ delay: 0.15 }}>
          <OvrHex ovr={ovrAfter} size={58} />
        </motion.div>
        <div>
          <div className="h-display" style={{ fontSize: 26, color: win ? "var(--green)" : "var(--red)" }}>
            {win ? "Gewonnen" : "Verloren"}
          </div>
          <div className="row small" style={{ gap: 4, fontWeight: 700, color: win ? "var(--green)" : "var(--red)" }}>
            {win ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {done ? <CountUp from={0} to={g.delta} duration={0.6} prefix={g.delta > 0 ? "+" : ""} /> : null} OVR
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ConsequenceView({ consequence }: { consequence: DecisionLog }) {
  return (
    <div className="stack">
      {consequence.gamble ? <GambleReveal consequence={consequence} /> : null}
      <motion.div className="panel pad" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: consequence.gamble ? 2.2 : 0.05 }}>
        <div className="eyebrow">Folge deiner Entscheidung</div>
        <div className="h-section break" style={{ marginTop: 2 }}>
          {consequence.title}
        </div>
        <div className="small" style={{ color: "var(--blue-2)", fontWeight: 700, marginTop: 2 }}>
          {consequence.choice}
        </div>
        <p className="small break" style={{ color: "var(--ink-2)", lineHeight: 1.5 }}>
          {consequence.consequence}
        </p>
        {consequence.deltas.length > 0 && (
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            {consequence.deltas.map((d, i) => (
              <span key={i} className="chip blue tnum">
                {d}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ----------------------------------------------------------- Sheet */

export function DecisionSheet({
  open,
  pending,
  consequence,
  currentStrength,
  onChoose,
  onContinue,
  onClose,
  lossStreak = 0,
}: {
  lossStreak?: number;
  open: boolean;
  pending: PendingDecision | undefined;
  consequence: DecisionLog | undefined;
  currentStrength?: number | undefined;
  onChoose: (optionId: string) => void;
  onContinue: () => void;
  onClose: () => void;
}) {
  /** Verhindert Doppeltipps auf eine Option. */
  const busy = useRef(false);
  useEffect(() => {
    busy.current = false;
  }, [pending?.id, consequence]);

  const choose = (id: string) => {
    if (busy.current) return;
    busy.current = true;
    tap();
    onChoose(id);
  };

  const showConsequence = Boolean(consequence);
  const title = showConsequence ? "Ergebnis" : (pending?.title ?? "");
  const eyebrow = showConsequence ? "Deine Entscheidung" : pending ? decisionEyebrow(pending) : "";
  const gold = !showConsequence && pending?.kind === "club" && pending.variant === "investor";

  return (
    <Sheet
      open={open}
      onClose={showConsequence ? onContinue : onClose}
      title={title}
      eyebrow={eyebrow}
      full
      gold={gold}
      footer={
        showConsequence ? (
          <button type="button" className="btn primary block" onClick={onContinue}>
            Weiter <ArrowRight size={18} />
          </button>
        ) : undefined
      }
    >
      {showConsequence && consequence ? (
        <ConsequenceView key={`${consequence.title}-${consequence.choice}-${consequence.age}`} consequence={consequence} />
      ) : pending ? (
        <motion.div key={pending.id} className="stack" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}>
          <p className="small break" style={{ color: "var(--ink-2)", lineHeight: 1.55, margin: 0 }}>
            {pending.intro}
          </p>

          {pending.kind === "ovr" && pending.options.map((o) => <OptionCard key={o.id} option={o} onChoose={choose} lossStreak={lossStreak} />)}

          {pending.kind === "club" && (
            <>
              {pending.variant === "investor" && pending.project ? <InvestorDossier project={pending.project} /> : null}
              {pending.offers.map((o) => (
                <OfferCard key={o.id} offer={o} onChoose={choose} currentStrength={currentStrength} />
              ))}
              {!pending.forced && (
                <motion.button type="button" whileTap={{ scale: 0.98 }} className="tile" style={{ padding: 12, background: "linear-gradient(160deg,#f6f8fa,#e4eaee)" }} onClick={() => choose("stay")}>
                  <div className="h-section" style={{ fontSize: 18 }}>
                    {pending.variant === "investor" ? "Absagen und bleiben" : "Beim aktuellen Verein bleiben"}
                  </div>
                  <div className="small muted" style={{ marginTop: 2 }}>
                    {pending.variant === "investor"
                      ? "Das Projekt läuft ohne dich weiter. Diese Gelegenheit kommt nicht zurück."
                      : "Loyalität: Vertrag verlängern, Rolle behalten."}
                  </div>
                  <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    <Effect label="Vereinsbindung" value="steigt" dir="up" />
                    <Effect label="Moral" value="steigt" dir="up" />
                    <Effect label="OVR" value="unverändert" />
                  </div>
                </motion.button>
              )}
            </>
          )}

          {pending.kind === "nation" &&
            pending.options.map((o) => (
              <motion.button key={o.id} type="button" whileTap={{ scale: 0.98 }} className="tile" style={{ padding: 12 }} onClick={() => choose(o.id)}>
                <div className="row">
                  <Flag code={o.code} size={30} />
                  <div className="grow">
                    <div className="h-section break" style={{ fontSize: 18 }}>
                      {o.label}
                    </div>
                    <div className="small muted break">{o.hint}</div>
                  </div>
                </div>
              </motion.button>
            ))}

          {pending.kind === "comeback" && (
            <>
              <div className="notice blue tnum">
                Comeback-Rating: <b>{pending.comebackOvr} OVR</b> nach {pending.years} {pending.years === 1 ? "Jahr" : "Jahren"} Pause.
              </div>
              {pending.offers.map((o) => (
                <OfferCard key={o.id} offer={o} onChoose={choose} />
              ))}
              <PlainOption label="Es dabei belassen" hint="Die Karriere bleibt abgeschlossen." onClick={() => choose("comeback-no")} />
            </>
          )}

          {pending.kind === "retirement" && (
            <>
              <div className="notice tnum">
                Körperlicher Verschleiß: <b>{pending.bodyWear}/100</b>
                {pending.extensions > 0 ? ` · bereits ${pending.extensions} ${pending.extensions === 1 ? "Saison" : "Saisons"} verlängert` : ""}
                <div className="bar" style={{ marginTop: 6 }}>
                  <span style={{ width: `${pending.bodyWear}%`, background: "linear-gradient(90deg,#f0b429,#d93d3d)" }} />
                </div>
              </div>
              {pending.options.map((o) => (
                <PlainOption key={o.id} label={o.label} hint={o.hint} strong={o.id === "retire-continue"} onClick={() => choose(o.id)} />
              ))}
            </>
          )}

          <p className="tiny muted" style={{ margin: 0 }}>
            {pending.kind === "ovr"
              ? "Der Ausgang steht nicht fest – du erfährst ihn direkt nach deiner Wahl."
              : pending.kind === "comeback"
                ? "Ein Comeback setzt dein Rating auf den oben genannten Comeback-Wert."
                : pending.kind === "retirement"
                  ? "Eine weitere Saison kostet Substanz, verändert dein Rating aber nicht direkt."
                  : "Diese Wahl verändert deinen Weg, nicht dein Rating."}
          </p>
        </motion.div>
      ) : null}
    </Sheet>
  );
}
