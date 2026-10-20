import { motion } from "framer-motion";
import { AlertCircle, Play } from "lucide-react";
import type { GameState } from "@/lib/sim/types";
import { getClub, countryName } from "@/lib/sim/data";
import { fanStatus, fanValue, leagueLabelFor, seasonLabel } from "@/lib/sim/engine";
import { dynamicDivision, dynamicStrength } from "@/lib/sim/world";
import { legendStatus } from "@/lib/sim/legend";
import { bodyWearLabel } from "@/lib/sim/body";
import { formatMoney } from "@/lib/sim/format";
import { Crest, LeagueBadge } from "@/ui/Crest";
import { Flag } from "@/ui/Flag";
import { PlayerCard, cardDataFrom } from "@/ui/PlayerCard";
import { Bar, HexMark, SectionTitle, Spark, Stat, ovrColor, useNarrow } from "@/ui/primitives";
import { decisionEyebrow } from "./Decision";

type FieldStatus = "now" | "next" | "done" | "closed";
const STATUS_LABEL: Record<FieldStatus, string> = {
  now: "Jetzt entscheiden",
  next: "Als Nächstes",
  done: "Abgeschlossen",
  closed: "Kein Fenster",
};

function SeasonField({
  index,
  title,
  subtitle,
  status,
  text,
  onOpen,
}: {
  index: string;
  title: string;
  subtitle: string;
  status: FieldStatus;
  text: string;
  onOpen: () => void;
}) {
  const active = status === "now";
  return (
    <motion.button
      type="button"
      whileTap={{ scale: active ? 0.97 : 1 }}
      disabled={!active}
      onClick={onOpen}
      className={`tile ${active ? "blue shine pulse" : ""}`}
      style={{ padding: 12, opacity: status === "closed" ? 0.7 : 1 }}
    >
      <HexMark />
      <div className="row" style={{ alignItems: "flex-start" }}>
        <span className="h-display" style={{ fontSize: 26, color: active ? "#fff" : "var(--blue)" }}>
          {index}
        </span>
        <div className="grow">
          <div className="tile-label break" style={{ fontSize: 19 }}>
            {title}
          </div>
          <div className="tiny" style={{ opacity: 0.75 }}>
            {subtitle}
          </div>
        </div>
        <span className={`status ${status}`}>{STATUS_LABEL[status]}</span>
      </div>
      <div className="small break" style={{ marginTop: 6, opacity: active ? 0.95 : 0.8 }}>
        {text}
      </div>
    </motion.button>
  );
}

export function Hub({
  state,
  onKickoff,
  onOpenDecision,
  onFinish,
}: {
  state: GameState;
  onKickoff: () => void;
  onOpenDecision: () => void;
  onFinish: () => void;
}) {
  const narrow = useNarrow();
  const p = state.player;
  const club = getClub(p.clubId);
  const leagueLabel = leagueLabelFor(state.world, club.id);
  const legend = legendStatus(state);
  const fans = fanValue(state, club.id);
  const pending = state.pending;
  const queuedKinds = state.queue.map((q) => q.kind);
  const played = state.seasons.length > 0;
  const lastSeason = state.seasons[state.seasons.length - 1];

  // Gleiche Statuslogik wie der Saison-Hub des Originals.
  const clubResolved = (state.cooldowns["club"] ?? -1) > state.seasonIndex;
  const canStillOpenClub =
    !clubResolved && (["ovr", "retirement", "comeback"] as const).some((k) => pending?.kind === k || queuedKinds.includes(k));
  const ovrStatus: FieldStatus = pending?.kind === "ovr" ? "now" : queuedKinds.includes("ovr") ? "next" : played ? "done" : "next";
  const clubStatus: FieldStatus =
    pending?.kind === "club"
      ? "now"
      : queuedKinds.includes("club")
        ? "next"
        : clubResolved
          ? "done"
          : state.retired
            ? "closed"
            : canStillOpenClub
              ? "next"
              : "closed";
  const extraKinds = ["nation", "retirement", "comeback"] as const;
  type ExtraKind = (typeof extraKinds)[number];
  const isExtra = (k: string): k is ExtraKind => (extraKinds as readonly string[]).includes(k);
  const extraPending = pending && isExtra(pending.kind) ? pending : undefined;
  const extraKind: ExtraKind | undefined = extraPending ? (extraPending.kind as ExtraKind) : queuedKinds.find(isExtra);

  const deciding = Boolean(pending) || state.queue.length > 0;
  const headline = deciding
    ? `Saison ${lastSeason?.seasonLabel ?? seasonLabel(state.startYear, state.seasonIndex)} · ${lastSeason?.age ?? p.age} Jahre`
    : `Nächste Saison ${seasonLabel(state.startYear, state.seasonIndex)} · ${p.age} Jahre`;

  const injuryLabel =
    p.monthsOut > 0 ? `${p.monthsOut} Mon. Ausfall` : p.majorInjuries > 0 ? `${p.majorInjuries} schwere Verl.` : "fit";
  const project = state.investorProject;
  const projectClub = project ? getClub(project.clubId) : undefined;

  return (
    <div>
      {/* Spielerkarte + Verein */}
      <motion.div className="panel" style={{ padding: 12, overflow: "hidden" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="row" style={{ alignItems: "stretch", gap: 12 }}>
          <PlayerCard data={cardDataFrom(state)} width={narrow ? 104 : 132} />
          <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <div className="eyebrow break">{headline}</div>
              <div className="h-display break" style={{ fontSize: 26 }}>
                {state.profile.name}
              </div>
              <div className="row tiny muted" style={{ gap: 5, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700 }}>
                  {state.profile.pos}
                  {state.profile.pos2 ? `/${state.profile.pos2}` : ""}
                </span>
                <Flag code={state.profile.nat1} />
                {state.profile.nat2 ? <Flag code={state.profile.nat2} /> : null}
                <span>· {p.role}</span>
              </div>
            </div>
            <div className="row stat" style={{ padding: 8 }}>
              <Crest name={club.name} size={34} />
              <div className="grow">
                <div className="small break" style={{ fontWeight: 700, lineHeight: 1.15 }}>
                  {club.name}
                </div>
                <div className="row tiny muted" style={{ gap: 4 }}>
                  <LeagueBadge league={leagueLabel} division={dynamicDivision(state.world, club.id)} size={14} />
                  <span className="break">{leagueLabel}</span>
                </div>
              </div>
            </div>
            <div className="grid-2" style={{ gap: 6 }}>
              <Stat label="Marktwert" value={formatMoney(p.value)} small />
              <Stat label="Vertrag" value={`${p.contractYears} J.`} small />
            </div>
          </div>
        </div>
        <div className="grid-3" style={{ marginTop: 12, gap: 10 }}>
          <Bar label="Form" value={p.form} />
          <Bar label="Fitness" value={p.fitness} color="linear-gradient(90deg,#5fa514,#8fd134)" />
          <Bar label="Moral" value={p.morale} color="linear-gradient(90deg,#a8790b,#f0c63c)" />
        </div>
      </motion.div>

      {project && projectClub ? (
        <div className="notice gold row" style={{ marginTop: 10, gap: 8, alignItems: "center" }}>
          <Crest name={projectClub.name} size={26} />
          <span className="small break grow">
            <b>Investoren-Projekt:</b> {projectClub.name} · {project.startedYearLabel} · Stärke {project.strengthBefore} → {project.strengthAfter}
            {project.accepted === true ? " · du führst das Projekt an" : project.accepted === false ? " · ohne dich" : " · Entscheidung offen"}
          </span>
          {state.wealth?.financiallySecure ? <span className="chip gold">Abgesichert</span> : null}
        </div>
      ) : null}

      <SectionTitle>Saison-Hub</SectionTitle>
      <div style={{ display: "grid", gap: 8 }}>
        <SeasonField
          index="01"
          title="Deine Entwicklung"
          subtitle="Ereignis · Gesamtbewertung (OVR)"
          status={ovrStatus}
          text={
            ovrStatus === "now"
              ? `${pending!.title} – tippe, um zu entscheiden.`
              : ovrStatus === "done"
                ? "Die Entwicklungsentscheidung dieser Saison ist getroffen."
                : "Sobald die Saison gespielt ist, entscheidest du hier über deine Entwicklung."
          }
          onOpen={onOpenDecision}
        />
        <SeasonField
          index="02"
          title="Deine Vereinszukunft"
          subtitle={pending?.kind === "club" && pending.variant === "investor" ? "Investoren-Projekt · einmalige Gelegenheit" : "Transferfenster"}
          status={clubStatus}
          text={
            clubStatus === "now"
              ? `${pending ? decisionEyebrow(pending) : ""}: ${pending?.title ?? ""}`
              : clubStatus === "next"
                ? "Das Transferfenster öffnet direkt nach deiner Entwicklungsentscheidung."
                : clubStatus === "done"
                  ? (lastSeason?.transferNote ?? lastSeason?.loanNote ?? `Du bleibst bei ${club.name}.`)
                  : "In dieser Saison liegt dir kein Vereinsangebot vor."
          }
          onOpen={onOpenDecision}
        />
        {extraKind && (
          <SeasonField
            index="03"
            title={extraKind === "retirement" ? "Noch ein Jahr?" : extraKind === "comeback" ? "Comeback" : "Nationalteam"}
            subtitle="Zusatzentscheidung"
            status={extraPending ? "now" : "next"}
            text={extraPending ? `${extraPending.title} – tippe, um zu entscheiden.` : "Diese Entscheidung folgt gleich."}
            onOpen={onOpenDecision}
          />
        )}
      </div>

      {/* Haupt-CTA */}
      <div style={{ marginTop: 14 }}>
        {pending ? (
          <button type="button" className="btn primary block pulse" onClick={onOpenDecision}>
            <AlertCircle size={20} /> Entscheidung treffen
          </button>
        ) : state.retired || state.phase === "end" ? (
          <button type="button" className="btn primary block" onClick={onFinish}>
            Zur Hall of Fame
          </button>
        ) : (
          <motion.button
            type="button"
            className="tile lime shine pulse"
            whileTap={{ scale: 0.97 }}
            onClick={onKickoff}
            style={{ padding: "16px 14px", textAlign: "center" }}
          >
            <HexMark color="#10200a" />
            <div className="row" style={{ justifyContent: "center", gap: 10 }}>
              <Play size={26} fill="currentColor" />
              <span className="tile-label" style={{ fontSize: 28 }}>
                Saison {seasonLabel(state.startYear, state.seasonIndex)} anpfeifen
              </span>
            </div>
            <div className="tiny" style={{ fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 4, opacity: 0.8 }}>
              Tempo: {state.profile.pace === 1 ? "jede Saison" : `alle ${state.profile.pace} Saisons`}
            </div>
          </motion.button>
        )}
      </div>

      <SectionTitle>Spielerdetails</SectionTitle>
      <div className="grid-3">
        <Stat label="Wochengehalt" value={formatMoney(p.wage)} small />
        <Stat label="Clubstärke" value={Math.round(dynamicStrength(state.world, club.id))} small />
        <Stat label="Trophäen" value={state.trophies.length} small tone="var(--gold-2)" />
        <Stat label="Nationalteam" value={state.national.committed ? `${countryName(state.national.committed)} · ${state.national.caps}` : "offen"} small />
        <Stat label="Mentalität" value={Math.round(p.mentality)} small />
        <Stat label="Fanstatus" value={fanStatus(fans)} small />
        <Stat label="Verletzung" value={injuryLabel} small />
        <Stat label="Legende" value={legend.tier.name} small tone="var(--gold-2)" />
        <Stat label="Körper" value={bodyWearLabel(p.bodyWear)} small />
      </div>
      <div className="panel pad" style={{ marginTop: 10 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="stat-label">Legendenstatus · {legend.tier.name}</span>
          <span className="tiny muted tnum">{legend.next ? `${legend.toNext} bis ${legend.next.name}` : "Höchste Stufe"}</span>
        </div>
        <div className="bar" style={{ marginTop: 6 }}>
          <motion.span initial={{ width: 0 }} animate={{ width: `${Math.round(legend.progress * 100)}%` }} transition={{ duration: 1 }} style={{ background: "linear-gradient(90deg,#a8790b,#f0c63c)" }} />
        </div>
        <div style={{ marginTop: 10 }}>
          <Bar label="Reputation" value={p.reputation} />
        </div>
        <div className="grid-2" style={{ marginTop: 10 }}>
          <div>
            <div className="stat-label">OVR-Verlauf</div>
            <Spark values={state.seasons.map((s) => s.endOvr)} color={ovrColor(p.ovr)} />
          </div>
          <div>
            <div className="stat-label">Form</div>
            <Spark values={state.seasons.map((s) => s.form)} color="#0a84d6" />
          </div>
        </div>
      </div>
    </div>
  );
}
