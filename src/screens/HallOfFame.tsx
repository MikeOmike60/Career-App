import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { toBlob } from "html-to-image";
import { Download, ImageIcon, RotateCcw, Share2 } from "lucide-react";
import { aspectMatches, budgetFor, exportPixelRatio, fitsBudget, reducedRatio } from "@/lib/export-image";
import type { GameState, Trophy } from "@/lib/sim/types";
import { careerTotals, clubHistory } from "@/lib/sim/engine";
import { getClub, countryName } from "@/lib/sim/data";
import { formatMoney, formatNumber } from "@/lib/sim/format";
import { careerNarrative, careerSeasonRows, legendHighlights, legendStatus } from "@/lib/sim/legend";
import { bodyWearLabel } from "@/lib/sim/body";
import { Avatar } from "@/ui/Avatar";
import { Crest } from "@/ui/Crest";
import { Flag } from "@/ui/Flag";
import { TrophyIcon } from "@/ui/TrophyIcon";
import { OvrHex, Spark, TopBar, ovrColor } from "@/ui/primitives";
import { celebrate, isNative, shareImageNative } from "@/ui/native";
import { TrophySheet } from "./Tabs";

const EXPORT_WIDTH = 1000;

function decodeSize(blob: Blob): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const probe = new Image();
    const tmp = URL.createObjectURL(blob);
    const done = (v: { w: number; h: number } | null) => {
      URL.revokeObjectURL(tmp);
      resolve(v && v.w > 0 && v.h > 0 ? v : null);
    };
    probe.onload = () => done({ w: probe.naturalWidth, h: probe.naturalHeight });
    probe.onerror = () => done(null);
    probe.src = tmp;
  });
}

/** Aufeinanderfolgende Saisons beim selben Verein zu Stationen bündeln. */
function clubStations(state: GameState) {
  const out: { clubId: string; from: string; to: string; seasons: number }[] = [];
  for (const s of state.seasons) {
    const prev = out[out.length - 1];
    if (prev && prev.clubId === s.clubId) {
      prev.to = s.seasonLabel;
      prev.seasons += 1;
    } else out.push({ clubId: s.clubId, from: s.seasonLabel, to: s.seasonLabel, seasons: 1 });
  }
  return out;
}

function Chapter({ index, title, subtitle, children }: { index: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 18 }}>
      <div className="row" style={{ borderBottom: "2px solid var(--line-strong)", paddingBottom: 6, marginBottom: 10 }}>
        <span className="h-display" style={{ fontSize: 24, color: "var(--blue)" }}>
          {index}
        </span>
        <div className="grow">
          <div className="h-section break">{title}</div>
          {subtitle ? <div className="tiny muted break">{subtitle}</div> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

const CareerCard = forwardRef<HTMLDivElement, { state: GameState; onOpenTrophy: (t: Trophy) => void; exporting: boolean }>(function CareerCard(
  { state, onOpenTrophy, exporting },
  ref,
) {
  const totals = careerTotals(state);
  const isGk = state.profile.pos === "TW";
  const first = state.seasons[0];
  const last = state.seasons[state.seasons.length - 1];
  const legend = legendStatus(state);
  const highlights = legendHighlights(state);
  const narrative = careerNarrative(state);
  const seasonRows = careerSeasonRows(state);
  const stations = clubStations(state);
  const clubs = clubHistory(state);

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        background: "linear-gradient(180deg,#ffffff 0%,#eef2f5 100%)",
        borderRadius: exporting ? 0 : 8,
        padding: exporting ? 36 : 14,
        boxShadow: exporting ? "none" : "var(--shadow-lg)",
        overflow: "hidden",
        color: "var(--ink)",
      }}
    >
      {/* Kopf: dunkles FIFA-Banner */}
      <div style={{ margin: exporting ? "-36px -36px 0" : "-14px -14px 0", padding: exporting ? "28px 36px 22px" : "18px 14px 14px", background: "linear-gradient(135deg,#1d2e3c,#0e1a24)", color: "#fff", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: "linear-gradient(90deg,#8fd134 0 28%,#0a84d6 28% 100%)" }} />
        <div className="row" style={{ gap: 14 }}>
          <Avatar avatar={state.profile.avatar} name={state.profile.name} size={exporting ? 110 : 76} />
          <div className="grow">
            <div className="eyebrow" style={{ color: "#8fd134", letterSpacing: "0.3em" }}>
              Legendenweg · Hall of Fame
            </div>
            <div className="h-display break" style={{ fontSize: exporting ? 48 : 30 }}>
              {state.profile.name}
            </div>
            <div className="row small" style={{ gap: 6, color: "#b8c8d5", flexWrap: "wrap" }}>
              <Flag code={state.profile.nat1} />
              {state.profile.nat2 ? <Flag code={state.profile.nat2} /> : null}
              <span className="break">
                {state.profile.pos} · {first?.seasonLabel ?? "–"} bis {last?.seasonLabel ?? "–"} · Seed {state.profile.seed}
              </span>
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <OvrHex ovr={state.peakOvr} size={exporting ? 74 : 54} />
            <div className="tiny" style={{ color: "#b8c8d5", fontWeight: 700, letterSpacing: "0.1em", marginTop: 2 }}>
              PEAK
            </div>
          </div>
        </div>
      </div>

      <Chapter index="01" title="Karriere-Steckbrief" subtitle="Globaler Legendenrang">
        <div className="notice gold">
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <div>
              <div className="eyebrow" style={{ color: "var(--gold-2)" }}>
                Legendenstatus
              </div>
              <div className="h-display" style={{ fontSize: 30, color: "var(--gold-2)" }}>
                {legend.tier.name}
              </div>
            </div>
            <div className="small muted tnum">
              Score {legend.score}
              {legend.next ? ` · ${legend.toNext} bis ${legend.next.name}` : " · Höchste Stufe"}
            </div>
          </div>
          <p className="small muted break" style={{ margin: "4px 0 0" }}>
            {legend.tier.blurb}
          </p>
          <p className="tiny muted break" style={{ margin: "4px 0 0" }}>
            Körperlicher Zustand am Karriereende: {bodyWearLabel(state.player.bodyWear)}
            {state.retirementCause === "body" ? " · Der Körper konnte nicht mehr." : ""}
          </p>
        </div>
        {state.investorProject ? (
          <div className="notice gold" style={{ marginTop: 8 }}>
            <div className="eyebrow" style={{ color: "var(--gold-2)" }}>
              Das Investoren-Projekt
            </div>
            <div className="h-section break">
              {getClub(state.investorProject.clubId).name} · {state.investorProject.startedYearLabel}
            </div>
            <div className="tiny muted break">
              Übernahme durch {state.investorProject.investorName} · Clubstärke {state.investorProject.strengthBefore} → {state.investorProject.strengthAfter} ·{" "}
              {state.investorProject.accepted ? "du hast das Projekt angeführt" : "du hast abgesagt – es lief ohne dich weiter"}
            </div>
            {state.wealth?.financiallySecure ? (
              <div className="tiny tnum break" style={{ fontWeight: 700, color: "var(--gold-2)" }}>
                Finanziell abgesichert seit {state.wealth.securedLabel ?? "der Unterschrift"} · dokumentierte Einnahmen {formatMoney(state.wealth.careerEarnings)}
              </div>
            ) : null}
          </div>
        ) : null}
      </Chapter>

      <Chapter index="02" title="Die wichtigsten Zahlen" subtitle="Gesamte Karriere">
        <div className="grid-4">
          {(
            [
              ["Saisons", String(totals.seasons)],
              ["Einsätze", formatNumber(totals.apps)],
              [isGk ? "Zu Null" : "Tore", formatNumber(isGk ? totals.cleanSheets : totals.goals)],
              [isGk ? "Paraden" : "Assists", formatNumber(isGk ? totals.saves : totals.assists)],
              ["Vereinstitel", String(totals.clubTrophies)],
              ["Nationaltitel", String(totals.nationalTrophies)],
              ["Awards", String(totals.awards)],
              ["Nationalteam", state.national.committed ? `${countryName(state.national.committed)} · ${state.national.caps}` : "keins"],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="stat">
              <div className="stat-label">{label}</div>
              <div className="stat-value sm break">{value}</div>
            </div>
          ))}
        </div>
        {state.seasons.length > 1 && (
          <div style={{ marginTop: 10 }}>
            <Spark values={state.seasons.map((s) => s.endOvr)} color={ovrColor(state.peakOvr)} height={exporting ? 90 : 60} />
          </div>
        )}
      </Chapter>

      <Chapter index="03" title="Vereinsstationen" subtitle={`${clubs.length} Vereine im Laufe der Karriere`}>
        <div className="grid-2">
          {stations.map((st, i) => (
            <div key={`${st.clubId}-${i}`} className="row stat">
              <Crest name={getClub(st.clubId).name} size={30} offline={exporting} />
              <div className="grow">
                <div className="small break" style={{ fontWeight: 700 }}>
                  {getClub(st.clubId).name}
                </div>
                <div className="tiny muted tnum">
                  {st.from === st.to ? st.from : `${st.from} – ${st.to}`} · {st.seasons} {st.seasons === 1 ? "Saison" : "Saisons"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Chapter>

      <Chapter index="04" title="Titel und Auszeichnungen" subtitle="Verein · Nationalteam · individuell">
        <div className="grid-3">
          {(["club", "national", "award"] as const).map((kind) => {
            const list = state.trophies.filter((t) => t.kind === kind);
            const title = kind === "club" ? "Vereinstitel" : kind === "national" ? "Nationalteam" : "Individuell";
            return (
              <div key={kind} className="stat">
                <div className="stat-label" style={{ color: "var(--blue)" }}>
                  {title} ({list.length})
                </div>
                {list.length === 0 ? (
                  <div className="tiny muted">Keine.</div>
                ) : (
                  <div style={{ display: "grid", gap: 4, marginTop: 4 }}>
                    {list.map((t) => (
                      <button key={t.id} type="button" disabled={exporting} onClick={() => onOpenTrophy(t)} className="row tiny" style={{ gap: 5, textAlign: "left" }}>
                        <TrophyIcon trophy={t} size={16} />
                        <span className="grow break">{t.name}</span>
                        <span className="muted tnum">{t.season}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Chapter>

      {highlights.length > 0 && (
        <Chapter index="05" title="Legendäre Momente" subtitle="Belegt durch echte Saisondaten">
          <div style={{ display: "grid", gap: 6 }}>
            {highlights.map((h, i) => (
              <div key={i} className="row small" style={{ alignItems: "flex-start" }}>
                <span style={{ color: "var(--gold)" }}>◆</span>
                <span className="break" style={{ color: "var(--ink-2)" }}>
                  {h}
                </span>
              </div>
            ))}
          </div>
        </Chapter>
      )}

      {narrative.length > 0 && (
        <Chapter index="06" title="Karriereerzählung">
          {narrative.map((para, i) => (
            <p key={i} className="small break" style={{ color: "var(--ink-2)", lineHeight: 1.55, margin: "0 0 8px" }}>
              {para}
            </p>
          ))}
        </Chapter>
      )}

      <Chapter index="07" title="Saisonchronik" subtitle={`Alle ${seasonRows.length} Saisons`}>
        <table className="table tnum" style={{ tableLayout: "fixed", fontSize: exporting ? 13 : 11 }}>
          <colgroup>
            <col style={{ width: "15%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "30%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Saison</th>
              <th>Alter</th>
              <th>Verein</th>
              <th className="r">Sp.</th>
              <th className="r">{isGk ? "ZN·P" : "T·A"}</th>
              <th className="r">Pl.</th>
              <th className="r">OVR</th>
            </tr>
          </thead>
          <tbody>
            {seasonRows.map((r, i) => (
              <tr key={i}>
                <td>{r.seasonLabel}</td>
                <td>{r.age}</td>
                <td className="break">
                  {r.clubName}
                  {r.honours && r.honours !== "–" ? <div className="tiny muted break">{r.honours}</div> : null}
                  {exporting && r.note ? <div className="tiny muted break">{r.note}</div> : null}
                </td>
                <td className="r">{r.apps}</td>
                <td className="r">{r.output}</td>
                <td className="r">{r.tablePosition}</td>
                <td className="r" style={{ fontWeight: 800 }}>
                  {r.ovr}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Chapter>

      {state.decisions.length > 0 && (
        <Chapter index="08" title="Entscheidungen" subtitle={`${state.decisions.length} dokumentierte Weichenstellungen`}>
          {exporting ? (
            <div style={{ display: "grid", gap: 3 }}>
              {state.decisions.map((d, i) => (
                <div key={i} className="small break muted">
                  <b className="tnum" style={{ color: "var(--ink)" }}>
                    {d.age}
                  </b>{" "}
                  · {d.title}: {d.choice}
                </div>
              ))}
            </div>
          ) : (
            <details>
              <summary className="btn ghost small" style={{ listStyle: "none" }}>
                Alle {state.decisions.length} Entscheidungen anzeigen
              </summary>
              <div style={{ display: "grid", gap: 3, marginTop: 8 }}>
                {state.decisions.map((d, i) => (
                  <div key={i} className="small break muted">
                    <b className="tnum" style={{ color: "var(--ink)" }}>
                      {d.age}
                    </b>{" "}
                    · {d.title}: {d.choice}
                  </div>
                ))}
              </div>
            </details>
          )}
        </Chapter>
      )}
      <div className="tiny muted" style={{ marginTop: 16, textAlign: "center" }}>
        Privates, inoffizielles Fanprojekt · LEGENDENWEG
      </div>
    </div>
  );
});

type ExportPhase = "idle" | "preparing" | "ready" | "saving" | "error";

export function HallOfFame({ state, onRestart, onMenu }: { state: GameState; onRestart: () => void; onMenu: () => void }) {
  const exportRef = useRef<HTMLDivElement>(null);
  const urlRef = useRef<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const busyRef = useRef(false);
  const genRef = useRef(0);
  const mountedRef = useRef(true);
  const [phase, setPhase] = useState<ExportPhase>("idle");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [trophy, setTrophy] = useState<Trophy | null>(null);

  const fileName = `legendenweg-${state.profile.name.replace(/\s+/g, "-").toLowerCase() || "karriere"}.png`;

  useEffect(() => {
    mountedRef.current = true;
    celebrate();
    const t = window.setTimeout(() => {
      void confetti({ particleCount: 140, spread: 90, origin: { y: 0.3 }, colors: ["#f0c63c", "#fff2b3", "#8fd134", "#0a84d6", "#ffffff"] });
    }, 400);
    return () => {
      mountedRef.current = false;
      window.clearTimeout(t);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, []);

  /** PNG vorbereiten: rendern, dekodieren, Größe prüfen – bei Bedarf mit kleinerer Auflösung. */
  const prepare = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const gen = ++genRef.current;
    setPhase("preparing");
    setMessage("");
    setExporting(true);
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      try {
        await document.fonts.ready;
      } catch {
        /* Schriften sind optional. */
      }
      const node = exportRef.current;
      if (!node) throw new Error("Exportdarstellung konnte nicht aufgebaut werden");
      await Promise.all(Array.from(node.querySelectorAll("img")).map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))));
      const height = node.scrollHeight;
      const budget = budgetFor(window.innerWidth);
      let ratio = exportPixelRatio(EXPORT_WIDTH, height, budget);
      if (ratio <= 0) throw new Error("Die Karriere ist für einen Bildexport zu lang");
      let blob: Blob | null = null;
      let real: { w: number; h: number } | null = null;
      let lastProblem = "";
      for (let attempt = 0; attempt < 4; attempt++) {
        blob = null;
        real = null;
        try {
          blob = await toBlob(node, {
            pixelRatio: ratio,
            cacheBust: false,
            backgroundColor: "#eef2f5",
            width: EXPORT_WIDTH,
            height,
            style: { width: `${EXPORT_WIDTH}px`, maxWidth: "none" },
          });
        } catch {
          blob = null;
        }
        if (!blob || blob.size < 1000) lastProblem = "das Bild blieb leer";
        else {
          real = await decodeSize(blob);
          if (!real) lastProblem = "das Bild ließ sich nicht dekodieren";
          else if (!fitsBudget(real.w, real.h, budget)) lastProblem = "das Bild wurde zu groß für dieses Gerät";
          else if (!aspectMatches(EXPORT_WIDTH, height, real.w, real.h)) lastProblem = "das Bild wäre abgeschnitten gewesen";
          else break;
          real = null;
        }
        const smaller = reducedRatio(ratio);
        if (smaller === null) break;
        ratio = smaller;
      }
      if (!blob || !real) throw new Error(lastProblem || "das Bild konnte nicht erzeugt werden");
      if (gen !== genRef.current || !mountedRef.current) return;
      const url = URL.createObjectURL(blob);
      const old = urlRef.current;
      urlRef.current = url;
      blobRef.current = blob;
      if (old) URL.revokeObjectURL(old);
      setImageUrl(url);
      setPhase("ready");
      setMessage(ratio < 2 ? `Bild fertig (${real.w} × ${real.h} px). Wegen der Länge deiner Karriere ist die Auflösung reduziert – es wurde nichts abgeschnitten.` : "");
    } catch (err) {
      if (gen !== genRef.current || !mountedRef.current) return;
      setPhase("error");
      setMessage(`Das Bild konnte nicht erzeugt werden: ${err instanceof Error ? err.message : "unbekannter Fehler"}. Deine Karriere bleibt erhalten – versuche es erneut.`);
    } finally {
      busyRef.current = false;
      if (mountedRef.current && gen === genRef.current) setExporting(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void prepare(), 900);
    return () => window.clearTimeout(t);
  }, [prepare]);

  const downloadNow = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  /** Läuft direkt im Tap, damit iOS die Nutzeraktion für das Teilen-Menü akzeptiert. */
  const save = () => {
    if (phase === "saving") return;
    const blob = blobRef.current;
    const url = urlRef.current;
    if (!blob || !url) return;
    if (isNative) {
      setPhase("saving");
      shareImageNative(blob, fileName, `Legendenweg – ${state.profile.name}`)
        .then(() => setPhase("ready"))
        .catch(() => {
          setPhase("ready");
          setMessage("Das Teilen hat nicht geklappt. Versuche es erneut.");
        });
      return;
    }
    const file = new File([blob], fileName, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    let shareable = false;
    try {
      shareable = typeof nav.share === "function" && nav.canShare?.({ files: [file] }) === true;
    } catch {
      shareable = false;
    }
    if (shareable) {
      setPhase("saving");
      nav
        .share({ files: [file], title: "Legendenweg", text: state.profile.name })
        .then(() => {
          setPhase("ready");
          setMessage("");
        })
        .catch((err: unknown) => {
          setPhase("ready");
          const aborted = err instanceof DOMException && err.name === "AbortError";
          setMessage(aborted ? "" : "Das Teilen hat nicht geklappt. Nutze „Bild öffnen“ und speichere es mit langem Drücken.");
        });
      return;
    }
    downloadNow(url);
  };

  const canShare = isNative || (typeof navigator !== "undefined" && typeof navigator.share === "function");

  return (
    <div className="screen">
      <TopBar title="Hall of Fame" sub={`Karriereende · ${state.profile.name}`} onBack={onMenu} />
      <div className="scroll">
        <div className="content">
          <motion.div initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", damping: 18 }}>
            <CareerCard state={state} onOpenTrophy={setTrophy} exporting={false} />
          </motion.div>

          <div className="panel pad" style={{ marginTop: 14 }}>
            <div className="h-section">Karriere-Karte sichern</div>
            <div className="tiny muted">
              {phase === "preparing" ? "Bild wird vorbereitet …" : phase === "ready" || phase === "saving" ? "Bereit" : phase === "error" ? "Vorbereitung fehlgeschlagen" : "Noch nicht vorbereitet"}
            </div>
            {message ? (
              <p className={`notice ${phase === "error" ? "error" : ""}`} style={{ marginTop: 8 }} role={phase === "error" ? "alert" : "status"}>
                {message}
              </p>
            ) : null}
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {phase === "ready" || phase === "saving" ? (
                <>
                  <button type="button" className="btn primary block" onClick={save} disabled={phase === "saving"}>
                    {canShare ? <Share2 size={18} /> : <Download size={18} />}
                    {canShare ? "Bild teilen oder speichern" : "Als PNG herunterladen"}
                  </button>
                  {imageUrl && !isNative ? (
                    <a className="btn ghost block" href={imageUrl} target="_blank" rel="noopener noreferrer">
                      <ImageIcon size={18} /> Bild öffnen
                    </a>
                  ) : null}
                </>
              ) : (
                <button type="button" className="btn blue block" onClick={() => void prepare()} disabled={phase === "preparing"}>
                  <Download size={18} className={phase === "preparing" ? "spin" : ""} />
                  {phase === "preparing" ? "PNG wird vorbereitet …" : "PNG vorbereiten"}
                </button>
              )}
              <button type="button" className="btn ghost block" onClick={onRestart}>
                <RotateCcw size={18} /> Neue Karriere
              </button>
            </div>
            {imageUrl ? (
              <figure style={{ margin: "12px 0 0" }}>
                <img src={imageUrl} alt={`Karriere-Karte von ${state.profile.name} als PNG`} style={{ width: "100%", maxHeight: 320, objectFit: "contain", objectPosition: "top", borderRadius: 6, border: "1px solid var(--line)" }} />
                <figcaption className="tiny muted" style={{ marginTop: 4 }}>
                  Vorschau des fertigen PNG.
                </figcaption>
              </figure>
            ) : null}
          </div>
        </div>
      </div>

      {exporting ? (
        <div aria-hidden style={{ position: "fixed", left: 0, top: 0, zIndex: -50, opacity: 0, pointerEvents: "none", transform: "translateX(-200vw)", width: EXPORT_WIDTH }}>
          <div style={{ width: EXPORT_WIDTH }}>
            <CareerCard ref={exportRef} state={state} onOpenTrophy={() => {}} exporting />
          </div>
        </div>
      ) : null}

      <TrophySheet trophy={trophy} onClose={() => setTrophy(null)} />
    </div>
  );
}
