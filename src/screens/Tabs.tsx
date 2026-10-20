import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { GameState, SeasonRecord, Trophy } from "@/lib/sim/types";
import { getClub, countryName } from "@/lib/sim/data";
import { careerTotals } from "@/lib/sim/engine";
import { formatNumber } from "@/lib/sim/format";
import { buildTimelineView, type TimelineAgeRow } from "@/lib/sim/timeline-view";
import { Crest, LeagueBadge } from "@/ui/Crest";
import { Flag } from "@/ui/Flag";
import { TrophyIcon } from "@/ui/TrophyIcon";
import { OvrHex, SectionTitle, Sheet, Spark, Stat, ovrColor } from "@/ui/primitives";
import { tap } from "@/ui/native";

const listAnim = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

/* --------------------------------------------------------------- Timeline */

function TimelineRow({ row, isGk, onOpen, i }: { row: TimelineAgeRow; isGk: boolean; onOpen: (s: SeasonRecord) => void; i: number }) {
  const delay = Math.min(i * 0.03, 0.3);
  if (row.state === "empty") {
    return (
      <motion.div {...listAnim} transition={{ delay }} className="tl-row empty">
        <span className="tl-age">{row.age}</span>
        <span />
        <span />
      </motion.div>
    );
  }
  if (row.state === "open") {
    return (
      <motion.div {...listAnim} transition={{ delay }} className="tl-row open">
        <span className="tl-age">{row.age}</span>
        <span className="small muted" style={{ fontStyle: "italic" }}>
          To be written…
        </span>
        <span className="h-display muted" style={{ fontSize: 22 }}>
          ?
        </span>
      </motion.div>
    );
  }
  if (row.state === "signature") {
    const c = getClub(row.clubId!);
    return (
      <motion.div {...listAnim} transition={{ delay }} className="tl-row" style={{ borderColor: "#b9dcf4" }}>
        <span className="tl-age">{row.age}</span>
        <span className="row">
          <Crest name={c.name} size={26} />
          <span className="grow">
            <span className="break" style={{ display: "block", fontWeight: 700 }}>
              {c.name}
            </span>
            <span className="tiny" style={{ color: "var(--blue)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {row.note}
            </span>
          </span>
        </span>
        <OvrHex ovr={row.ovr ?? 50} size={34} />
      </motion.div>
    );
  }
  const s = row.season!;
  const c = getClub(s.clubId);
  return (
    <motion.button
      type="button"
      {...listAnim}
      transition={{ delay }}
      whileTap={{ scale: 0.98 }}
      className="tl-row"
      onClick={() => {
        tap();
        onOpen(s);
      }}
    >
      <span className="tl-age">{s.age}</span>
      <span style={{ minWidth: 0 }}>
        <span className="row">
          <Crest name={c.name} size={26} />
          <span className="grow">
            <span className="break" style={{ display: "block", fontWeight: 700, lineHeight: 1.15 }}>
              {c.name}
              {s.loan ? <span className="chip blue" style={{ marginLeft: 6, padding: "1px 5px" }}>Leihe</span> : null}
            </span>
            <span className="tiny muted break">
              {s.seasonLabel} · {s.leagueLabel}
            </span>
          </span>
        </span>
        <span className="row tiny tnum" style={{ gap: 10, marginTop: 5, color: "var(--ink-2)", flexWrap: "wrap" }}>
          <span>
            <b>{s.apps}</b> Sp.
          </span>
          <span>
            <b>{isGk ? s.cleanSheets : s.goals}</b> {isGk ? "Zu Null" : "Tore"}
          </span>
          <span>
            <b>{isGk ? s.saves : s.assists}</b> {isGk ? "Paraden" : "Assists"}
          </span>
          <span>
            Platz <b>{s.tablePosition}</b>
          </span>
          {s.promoted && <span style={{ color: "var(--green)", fontWeight: 700 }}>▲ Aufstieg</span>}
          {s.relegated && <span style={{ color: "var(--red)", fontWeight: 700 }}>▼ Abstieg</span>}
          {s.trophies.map((t) => (
            <TrophyIcon key={t.id} trophy={t} size={16} />
          ))}
        </span>
      </span>
      <OvrHex ovr={s.endOvr} size={36} />
    </motion.button>
  );
}

export function TimelineTab({ state, onOpenSeason }: { state: GameState; onOpenSeason: (s: SeasonRecord) => void }) {
  const isGk = state.profile.pos === "TW";
  const [page, setPage] = useState<number | null>(null);
  const preview = buildTimelineView(state, page);
  const lastAuto = useRef(preview.autoPage);
  useEffect(() => {
    if (preview.autoPage !== lastAuto.current) {
      lastAuto.current = preview.autoPage;
      setPage(null);
    }
  }, [preview.autoPage]);
  const view = buildTimelineView(state, page);

  return (
    <div>
      <div className="panel pad row" style={{ marginBottom: 10 }}>
        {view.national.code ? <Flag code={view.national.code} size={28} /> : null}
        <div className="grow">
          <div className="h-section break" style={{ fontSize: 17 }}>
            {view.national.code ? countryName(view.national.code) : "Nationalteam"}
          </div>
          <div className="tiny muted">{view.national.committed ? "Nationalteam" : "Entscheidung offen"}</div>
        </div>
        <div className="grid-3" style={{ width: 190 }}>
          <Stat label="Spiele" value={view.national.caps} small />
          <Stat label={isGk ? "Paraden" : "Tore"} value={view.national.goals} small />
          <Stat label="Titel" value={state.national.majorTitles} small />
        </div>
      </div>

      {view.rows.map((row, i) => (
        <TimelineRow key={`${view.page}-${row.age}`} row={row} isGk={isGk} onOpen={onOpenSeason} i={i} />
      ))}

      <div className="row" style={{ marginTop: 10 }}>
        <span className="tiny muted grow" style={{ textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Alter {view.from}–{view.to} · Seite {view.page + 1}/{view.pageCount}
        </span>
        <button type="button" className="btn ghost small" aria-label="Frühere Jahre" disabled={view.page <= 0} onClick={() => setPage(Math.max(0, view.page - 1))}>
          <ChevronLeft size={18} />
        </button>
        <button type="button" className="btn ghost small" aria-label="Spätere Jahre" disabled={view.page >= view.pageCount - 1} onClick={() => setPage(Math.min(view.pageCount - 1, view.page + 1))}>
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Statistik */

export function StatsTab({ state }: { state: GameState }) {
  const isGk = state.profile.pos === "TW";
  const totals = careerTotals(state);
  return (
    <div>
      <SectionTitle>Verein</SectionTitle>
      <div className="grid-3">
        <Stat label="Saisons" value={totals.seasons} />
        <Stat label="Einsätze" value={formatNumber(totals.apps)} />
        <Stat label="Ø Note" value={totals.avgRating} />
        <Stat label={isGk ? "Zu Null" : "Tore"} value={formatNumber(isGk ? totals.cleanSheets : totals.goals)} />
        <Stat label={isGk ? "Paraden" : "Assists"} value={formatNumber(isGk ? totals.saves : totals.assists)} />
        <Stat label="Beste Note" value={totals.best} />
      </div>
      <SectionTitle>Nationalteam</SectionTitle>
      <div className="grid-3">
        <Stat label="Länderspiele" value={state.national.caps} />
        <Stat label="Länderspieltore" value={state.national.goals} />
        <Stat label="Turniersiege" value={state.national.majorTitles} />
      </div>
      <SectionTitle>Verlauf</SectionTitle>
      <div className="panel pad">
        <div className="grid-2">
          <div>
            <div className="stat-label">OVR-Verlauf</div>
            <Spark values={state.seasons.map((s) => s.endOvr)} color={ovrColor(state.player.ovr)} height={60} />
          </div>
          <div>
            <div className="stat-label">Form</div>
            <Spark values={state.seasons.map((s) => s.form)} color="#0a84d6" height={60} />
          </div>
        </div>
      </div>
      {state.seasons.length > 0 && (
        <>
          <SectionTitle>Saisons</SectionTitle>
          <div className="panel" style={{ overflowX: "auto" }}>
            <table className="table tnum">
              <thead>
                <tr>
                  <th>Saison</th>
                  <th>Verein</th>
                  <th className="r">Sp.</th>
                  <th className="r">{isGk ? "ZN" : "T"}</th>
                  <th className="r">{isGk ? "P" : "A"}</th>
                  <th className="r">Note</th>
                  <th className="r">OVR</th>
                </tr>
              </thead>
              <tbody>
                {[...state.seasons].reverse().map((s) => (
                  <tr key={s.index}>
                    <td style={{ whiteSpace: "nowrap" }}>{s.seasonLabel}</td>
                    <td>
                      <span className="row" style={{ gap: 6 }}>
                        <Crest name={getClub(s.clubId).name} size={18} />
                        <span className="break small">{getClub(s.clubId).name}</span>
                      </span>
                    </td>
                    <td className="r">{s.apps}</td>
                    <td className="r">{isGk ? s.cleanSheets : s.goals}</td>
                    <td className="r">{isGk ? s.saves : s.assists}</td>
                    <td className="r">{s.rating}</td>
                    <td className="r" style={{ fontWeight: 800, color: ovrColor(s.endOvr) }}>
                      {s.endOvr}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Erfolge */

export function TrophyGroups({ trophies, onOpen }: { trophies: Trophy[]; onOpen: (t: Trophy) => void }) {
  return (
    <div>
      {(["club", "national", "award"] as const).map((kind) => {
        const list = trophies.filter((t) => t.kind === kind);
        const title = kind === "club" ? "Vereinstitel" : kind === "national" ? "Nationaltitel" : "Individuelle Awards";
        return (
          <div key={kind}>
            <SectionTitle right={<span className="chip gold tnum">{list.length}</span>}>{title}</SectionTitle>
            {list.length === 0 ? (
              <div className="placeholder">Noch nichts gewonnen.</div>
            ) : (
              <div className="grid-2">
                {list.map((t, i) => (
                  <motion.button
                    key={t.id}
                    type="button"
                    className="tile"
                    style={{ padding: 10, background: "linear-gradient(160deg,#fffdf6,#f7eccb)" }}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(i * 0.04, 0.4) }}
                    onClick={() => {
                      tap();
                      onOpen(t);
                    }}
                  >
                    <div className="row" style={{ alignItems: "center" }}>
                      <TrophyIcon trophy={t} size={34} />
                      <div className="grow">
                        <div className="small break" style={{ fontWeight: 700, lineHeight: 1.2 }}>
                          {t.name}
                        </div>
                        <div className="tiny muted tnum">{t.season}</div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------- Entscheidungen */

export function DecisionsTab({ state }: { state: GameState }) {
  if (state.decisions.length === 0) return <div className="placeholder">Bisher standest du vor keiner großen Entscheidung.</div>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {[...state.decisions].reverse().map((d, i) => (
        <motion.div key={i} className="panel pad" {...listAnim} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
          <div className="eyebrow">Mit {d.age} Jahren</div>
          <div className="h-section break" style={{ marginTop: 2 }}>
            {d.title}
          </div>
          <div className="small" style={{ color: "var(--blue-2)", fontWeight: 700 }}>
            {d.choice}
          </div>
          <p className="small muted break" style={{ margin: "4px 0 0" }}>
            {d.consequence}
          </p>
          {(d.deltas.length > 0 || d.gamble) && (
            <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {d.gamble && (
                <span className={`chip ${d.gamble.outcome === "win" ? "up" : "down"} tnum`}>
                  {d.gamble.outcome === "win" ? "Gamble gewonnen" : "Gamble verloren"} · {d.gamble.delta > 0 ? `+${d.gamble.delta}` : d.gamble.delta} OVR
                </span>
              )}
              {d.deltas.map((x, j) => (
                <span key={j} className="chip blue tnum">
                  {x}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------- Detail-Sheets */

export function SeasonSheet({
  season,
  state,
  onClose,
  onOpenTrophy,
}: {
  season: SeasonRecord | null;
  state: GameState;
  onClose: () => void;
  onOpenTrophy: (t: Trophy) => void;
}) {
  const isGk = state.profile.pos === "TW";
  const s = season;
  const club = s ? getClub(s.clubId) : null;
  return (
    <Sheet open={Boolean(s)} onClose={onClose} title={s ? `Saison ${s.seasonLabel}` : ""} eyebrow={club?.name}>
      {s && club && (
        <div className="stack">
          <div className="row">
            <Crest name={club.name} size={52} />
            <div className="grow">
              <div className="h-section break">{club.name}</div>
              <div className="row tiny muted" style={{ gap: 6 }}>
                <LeagueBadge league={s.leagueLabel} division={s.division ?? club.division} size={16} />
                <span className="break">{s.leagueLabel}</span>
              </div>
            </div>
            <OvrHex ovr={s.endOvr} size={44} />
          </div>
          <div className="grid-3">
            <Stat label="Alter" value={s.age} small />
            <Stat label="Platz" value={`${s.tablePosition}.`} small />
            <Stat label="Saisonende" value={s.promoted ? "Aufstieg" : s.relegated ? "Abstieg" : "Klassenerhalt"} small />
            <Stat label="Einsätze" value={s.apps} small />
            <Stat label={isGk ? "Zu Null" : "Tore"} value={isGk ? s.cleanSheets : s.goals} small />
            <Stat label={isGk ? "Paraden" : "Assists"} value={isGk ? s.saves : s.assists} small />
            <Stat label="Ø Note" value={s.rating} small />
            <Stat label="Form" value={s.form} small />
            <Stat label="OVR" value={`${s.startOvr} → ${s.endOvr}`} small />
          </div>
          <div className="small" style={{ display: "grid", gap: 6 }}>
            <div className="muted break">Wettbewerbe: {s.competitions.join(", ")}</div>
            {s.qualification && <div style={{ color: "var(--green)" }}>Qualifiziert: {s.qualification}</div>}
            {s.continental && <div style={{ color: "var(--ovr-violet)" }}>{s.continental}</div>}
            {s.clubImpactNote && <div className="notice" style={{ background: "var(--green-soft)", color: "var(--green)", fontWeight: 700 }}>{s.clubImpactNote}</div>}
            {s.relationNote && <div style={{ color: "var(--blue-2)" }}>{s.relationNote}</div>}
            {s.decisionNote && <div className="muted">{s.decisionNote}</div>}
            {s.worldNote && <div className="tiny muted">{s.worldNote}</div>}
            {s.missedSeason && <div style={{ color: "var(--red)" }}>Saison verletzungsbedingt verpasst.</div>}
            {s.transferNote && <div style={{ color: "var(--blue-2)" }}>{s.transferNote}</div>}
            {s.loanNote && <div style={{ color: "var(--blue-2)" }}>{s.loanNote}</div>}
            {s.nationalNote && <div style={{ color: "var(--ovr-cyan)" }}>{s.nationalNote}</div>}
            {s.legendMoment && <div className="notice gold">{s.legendMoment}</div>}
            {s.physicalNote && <div className="muted">{s.physicalNote}</div>}
            {s.investorNote && <div className="muted">{s.investorNote}</div>}
            {s.injuries.length > 0 && <div style={{ color: "var(--red)" }}>Verletzungen: {s.injuries.join(", ")}</div>}
            {state.national.committed && (
              <div className="tiny muted">
                Nationalteam: {countryName(state.national.committed)} · {s.natApps} Spiele, {s.natGoals} Tore
              </div>
            )}
          </div>
          {s.trophies.length > 0 && (
            <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
              {s.trophies.map((t) => (
                <button key={t.id} type="button" className="chip gold" onClick={() => onOpenTrophy(t)}>
                  <TrophyIcon trophy={t} size={16} /> {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

export function TrophySheet({ trophy, onClose }: { trophy: Trophy | null; onClose: () => void }) {
  return (
    <Sheet open={Boolean(trophy)} onClose={onClose} title={trophy?.name ?? ""} eyebrow="Trophäe" gold>
      {trophy && (
        <div style={{ textAlign: "center" }}>
          <motion.div initial={{ scale: 0.3, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", damping: 10 }} style={{ display: "inline-block", filter: "drop-shadow(0 10px 14px rgba(168,121,11,.45))" }}>
            <TrophyIcon trophy={trophy} size={110} />
          </motion.div>
          <p className="small break" style={{ color: "var(--ink-2)", lineHeight: 1.5 }}>
            {trophy.description}
          </p>
          <div className="row" style={{ justifyContent: "center", flexWrap: "wrap", gap: 6 }}>
            <span className="chip tnum">Saison {trophy.season}</span>
            <span className="chip tnum">Alter {trophy.age}</span>
            {trophy.clubId ? (
              <span className="chip">
                <Crest name={getClub(trophy.clubId).name} size={14} /> {getClub(trophy.clubId).name}
              </span>
            ) : null}
            {trophy.country && !trophy.clubId ? (
              <span className="chip">
                <Flag code={trophy.country} /> {countryName(trophy.country)}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </Sheet>
  );
}
