import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Settings as SettingsIcon } from "lucide-react";
import type { GameState, SeasonRecord, Trophy } from "@/lib/sim/types";
import { advanceToNextDecision, applyDecision, seasonLabel } from "@/lib/sim/engine";
import { dynamicStrength } from "@/lib/sim/world";
import { legendStatus } from "@/lib/sim/legend";
import { getClub } from "@/lib/sim/data";
import { TopBar, Toasts, useSwipe, type ToastItem } from "@/ui/primitives";
import { celebrate, tap } from "@/ui/native";
import { Hub } from "./Hub";
import { DecisionSheet } from "./Decision";
import { Kickoff, SeasonRecap } from "./SeasonFlow";
import { DecisionsTab, SeasonSheet, StatsTab, TimelineTab, TrophyGroups, TrophySheet } from "./Tabs";

const TABS = [
  { id: "hub", label: "Karriere" },
  { id: "timeline", label: "Timeline" },
  { id: "stats", label: "Statistik" },
  { id: "trophies", label: "Erfolge" },
  { id: "decisions", label: "Entscheidungen" },
] as const;
type TabId = (typeof TABS)[number]["id"];

type Flow =
  | { kind: "kickoff"; label: string; seasons: SeasonRecord[]; count: number }
  | { kind: "recap"; seasons: SeasonRecord[] }
  | null;

export function Career({
  state,
  setState,
  onMenu,
  onSettings,
  onFinish,
}: {
  state: GameState;
  setState: (s: GameState) => void;
  onMenu: () => void;
  onSettings: () => void;
  onFinish: () => void;
}) {
  const [tab, setTab] = useState<TabId>("hub");
  const [dir, setDir] = useState(1);
  const [flow, setFlow] = useState<Flow>(null);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [season, setSeason] = useState<SeasonRecord | null>(null);
  const [trophy, setTrophy] = useState<Trophy | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  /** Saisons, die eine Entscheidung nebenbei simuliert hat (Tempo 2/5). */
  const recapAfterConsequence = useRef<SeasonRecord[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef(legendStatus(state).tier.name);

  const isGk = state.profile.pos === "TW";

  // Neue Legendenstufe als Toast feiern – nie beim ersten Laden.
  useEffect(() => {
    const name = legendStatus(state).tier.name;
    if (name !== legendRef.current) {
      legendRef.current = name;
      celebrate();
      const key = `legend-${name}`;
      setToasts((t) => [...t, { key, tone: "gold", title: "Neue Legendenstufe", subtitle: name }]);
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.key !== key)), 3200);
    }
  }, [state]);

  const switchTab = (id: TabId) => {
    if (id === tab) return;
    const from = TABS.findIndex((t) => t.id === tab);
    const to = TABS.findIndex((t) => t.id === id);
    setDir(to > from ? 1 : -1);
    setTab(id);
    tap();
    scrollRef.current?.scrollTo({ top: 0 });
  };
  const tabIndex = TABS.findIndex((t) => t.id === tab);
  const swipe = useSwipe(
    () => tabIndex < TABS.length - 1 && switchTab(TABS[tabIndex + 1]!.id),
    () => tabIndex > 0 && switchTab(TABS[tabIndex - 1]!.id),
  );

  /* -------------------------------------------------------- Saisonablauf */

  const kickoff = () => {
    if (flow || state.pending || state.retired) return;
    const before = state.seasons.length;
    const label = seasonLabel(state.startYear, state.seasonIndex);
    const next = advanceToNextDecision(state);
    const fresh = next.seasons.slice(before);
    setState(next);
    setFlow({ kind: "kickoff", label, seasons: fresh, count: Math.max(1, fresh.length) });
  };

  const afterKickoff = () => {
    if (flow?.kind !== "kickoff") return;
    if (flow.seasons.length) {
      setFlow({ kind: "recap", seasons: flow.seasons });
      return;
    }
    setFlow(null);
    if (state.pending) setDecisionOpen(true);
    else if (state.phase === "end") onFinish();
  };

  const afterRecap = () => {
    setFlow(null);
    setTab("hub");
    if (state.pending) setDecisionOpen(true);
    else if (state.phase === "end") onFinish();
  };

  const choose = (optionId: string) => {
    const before = state.seasons.length;
    const next = applyDecision(state, optionId);
    recapAfterConsequence.current = next.seasons.slice(before);
    setState(next);
  };

  const continueAfterConsequence = () => {
    const cleared = { ...state, lastConsequence: undefined };
    setState(cleared);
    const fresh = recapAfterConsequence.current;
    recapAfterConsequence.current = [];
    if (fresh.length) {
      setDecisionOpen(false);
      setFlow({ kind: "recap", seasons: fresh });
      return;
    }
    if (!cleared.pending) {
      setDecisionOpen(false);
      if (cleared.phase === "end") onFinish();
    }
  };

  const sheetOpen = !flow && (Boolean(state.lastConsequence) || (decisionOpen && Boolean(state.pending)));
  const club = getClub(state.player.clubId);

  return (
    <div className="screen">
      <TopBar
        brand
        sub={`${club.name} · Seed ${state.profile.seed}`}
        onBack={onMenu}
        right={
          <button type="button" className="icon-btn" aria-label="Einstellungen" onClick={onSettings}>
            <SettingsIcon size={20} />
          </button>
        }
      />
      <nav className="tabs" aria-label="Karrierebereiche">
        <div className="tabs-inner" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="tab" onClick={() => switchTab(t.id)}>
              {t.label}
              {t.id === "hub" && state.pending && tab !== "hub" ? <span className="dot" /> : null}
              {tab === t.id && <motion.span layoutId="tab-ind" className="tab-indicator" transition={{ type: "spring", damping: 26, stiffness: 380 }} />}
            </button>
          ))}
        </div>
      </nav>

      <div className="scroll" ref={scrollRef} {...swipe}>
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={tab}
            className="content"
            initial={{ opacity: 0, x: dir * 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -50 }}
            transition={{ duration: 0.2 }}
          >
            {tab === "hub" && <Hub state={state} onKickoff={kickoff} onOpenDecision={() => setDecisionOpen(true)} onFinish={onFinish} />}
            {tab === "timeline" && <TimelineTab state={state} onOpenSeason={setSeason} />}
            {tab === "stats" && <StatsTab state={state} />}
            {tab === "trophies" && <TrophyGroups trophies={state.trophies} onOpen={setTrophy} />}
            {tab === "decisions" && <DecisionsTab state={state} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <DecisionSheet
        open={sheetOpen}
        pending={state.pending}
        consequence={state.lastConsequence}
        currentStrength={dynamicStrength(state.world, state.player.clubId)}
        onChoose={choose}
        onContinue={continueAfterConsequence}
        onClose={() => setDecisionOpen(false)}
      />
      <SeasonSheet season={season} state={state} onClose={() => setSeason(null)} onOpenTrophy={setTrophy} />
      <TrophySheet trophy={trophy} onClose={() => setTrophy(null)} />

      <AnimatePresence>
        {flow?.kind === "kickoff" && <Kickoff key="kickoff" label={flow.label} seasons={flow.count} onDone={afterKickoff} />}
        {flow?.kind === "recap" && <SeasonRecap key="recap" seasons={flow.seasons} isGk={isGk} onDone={afterRecap} />}
      </AnimatePresence>

      <Toasts items={toasts} onDismiss={(k) => setToasts((t) => t.filter((x) => x.key !== k))} />
    </div>
  );
}
