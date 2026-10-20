import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GameState, Profile } from "@/lib/sim/types";
import { createInitialState, rerollOffers, signWithClub } from "@/lib/sim/engine";
import { getClub } from "@/lib/sim/data";
import { clearState, loadState, saveState } from "@/lib/sim/storage";
import { HexBackground, Sheet } from "@/ui/primitives";
import { Crest } from "@/ui/Crest";
import { celebrate, setRootBackHandler } from "@/ui/native";
import { useSettings } from "@/ui/settings";
import { Title } from "@/screens/Title";
import { Setup } from "@/screens/Setup";
import { Offers } from "@/screens/Offers";
import { Career } from "@/screens/Career";
import { HallOfFame } from "@/screens/HallOfFame";
import { SettingsSheet } from "@/screens/SettingsSheet";

type View = "title" | "game";

const screenAnim = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
  transition: { duration: 0.25 },
};

/** Kurze „Willkommen“-Szene nach der ersten Unterschrift. */
function Welcome({ clubName, onDone }: { clubName: string; onDone: () => void }) {
  useEffect(() => {
    celebrate();
    const t = window.setTimeout(onDone, 2300);
    return () => window.clearTimeout(t);
  }, [onDone]);
  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onDone}>
      <HexBackground dark still />
      <motion.div initial={{ scale: 3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 12 }} style={{ position: "relative" }}>
        <Crest name={clubName} size={130} />
      </motion.div>
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} style={{ position: "relative", textAlign: "center", marginTop: 18 }}>
        <div className="eyebrow" style={{ color: "#8fd134" }}>
          Dein Herzensverein
        </div>
        <div className="h-display break" style={{ fontSize: 34 }}>
          Willkommen bei {clubName}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function App() {
  const [state, setStateRaw] = useState<GameState | null>(() => loadState());
  const [view, setView] = useState<View>("title");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [welcome, setWelcome] = useState<string | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  // Ein frisch geladenes Karriereende zeigt direkt die Hall of Fame.
  const [endAck, setEndAck] = useState(() => state?.phase === "end");

  const setState = (s: GameState | null) => {
    setStateRaw(s);
    if (s) saveState(s);
  };

  useEffect(() => {
    setRootBackHandler(view === "game" ? () => setView("title") : null);
  }, [view]);

  const { reduceEffects } = useSettings();
  useEffect(() => {
    document.documentElement.classList.toggle("lite", reduceEffects);
  }, [reduceEffects]);

  const reset = () => {
    clearState();
    setState(null);
    setEndAck(false);
    setSettingsOpen(false);
    setView("game");
  };

  const start = (profile: Profile) => {
    setEndAck(false);
    setState(createInitialState(profile));
  };

  const phase = state?.phase ?? "setup";
  const showHall = state && phase === "end" && endAck && !state.lastConsequence;

  let screen: React.ReactNode;
  let key: string;
  if (view === "title") {
    key = "title";
    screen = (
      <Title
        state={state}
        onContinue={() => setView("game")}
        onNew={() => {
          if (state) setConfirmNew(true);
          else setView("game");
        }}
        onSettings={() => setSettingsOpen(true)}
      />
    );
  } else if (!state || phase === "setup") {
    key = "setup";
    screen = <Setup onStart={start} onExit={() => setView("title")} />;
  } else if (phase === "offers") {
    key = "offers";
    screen = (
      <Offers
        state={state}
        onMenu={() => setView("title")}
        onReroll={() => setState(rerollOffers(state))}
        onSign={(clubId) => {
          setState(signWithClub(state, clubId));
          setWelcome(getClub(clubId).name);
        }}
      />
    );
  } else if (showHall) {
    key = "hall";
    screen = <HallOfFame state={state} onRestart={reset} onMenu={() => setView("title")} />;
  } else {
    key = "career";
    screen = (
      <Career
        state={state}
        setState={setState}
        onMenu={() => setView("title")}
        onSettings={() => setSettingsOpen(true)}
        onFinish={() => setEndAck(true)}
      />
    );
  }

  return (
    <div className="app">
      <HexBackground />
      <AnimatePresence mode="wait">
        <motion.div key={key} className="screen" {...screenAnim}>
          {screen}
        </motion.div>
      </AnimatePresence>
      <Sheet open={confirmNew} onClose={() => setConfirmNew(false)} title="Neue Karriere starten?" eyebrow="Achtung">
        <p className="small" style={{ marginTop: 0 }}>
          Deine aktuelle Karriere mit <b>{state?.profile.name}</b> wird endgültig gelöscht und du startest wieder im Setup.
        </p>
        <div className="grid-2">
          <button type="button" className="btn ghost" onClick={() => setConfirmNew(false)}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              setConfirmNew(false);
              reset();
            }}
          >
            Neu starten
          </button>
        </div>
      </Sheet>
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} state={state} setState={setState} onReset={reset} />
      <AnimatePresence>{welcome && <Welcome key="welcome" clubName={welcome} onDone={() => setWelcome(null)} />}</AnimatePresence>
    </div>
  );
}
