import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, RefreshCw } from "lucide-react";
import { getClub, countryName } from "@/lib/sim/data";
import { regionName } from "@/lib/sim/regions";
import type { GameState } from "@/lib/sim/types";
import { Crest, LeagueBadge } from "@/ui/Crest";
import { Flag } from "@/ui/Flag";
import { HexMark, OvrHex, Stat, TopBar } from "@/ui/primitives";
import { PlayerCard, cardDataFrom } from "@/ui/PlayerCard";
import { tap } from "@/ui/native";
import { Walkout } from "./Walkout";

export function Offers({
  state,
  onReroll,
  onSign,
  onMenu,
}: {
  state: GameState;
  onReroll: () => void;
  onSign: (clubId: string) => void;
  onMenu: () => void;
}) {
  const [revealed, setRevealed] = useState(state.rerolls > 0);
  const card = cardDataFrom(state);

  return (
    <div className="screen">
      <TopBar title="Drei Akademien fragen an" sub={`Karrierestart · ${state.player.age} Jahre`} onBack={onMenu} />
      <div className="scroll">
        <div className="content stack">
          <motion.div className="panel pad row" style={{ gap: 14, alignItems: "center" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <PlayerCard data={card} width={112} />
            <div className="grow">
              <div className="eyebrow">Herzensverein gesucht</div>
              <p className="small" style={{ margin: "4px 0 0" }}>
                <b>{state.profile.name}</b> ist {state.player.age} Jahre alt. Die erste Unterschrift entscheidet über Spielzeit und Ausbildung – und bleibt für immer dein <b>Herzensverein</b>.
              </p>
              <button
                type="button"
                className="btn ghost small"
                style={{ marginTop: 10 }}
                onClick={() => {
                  tap();
                  onReroll();
                }}
              >
                <RefreshCw size={16} /> Neu würfeln
              </button>
            </div>
          </motion.div>

          <AnimatePresence mode="popLayout">
            {state.offers.map((offer, i) => {
              const club = getClub(offer.clubId);
              const region = offer.regionLabel ?? (club.region ? regionName(club.country, club.region) : undefined);
              return (
                <motion.article
                  key={`${state.rerolls}-${offer.clubId}`}
                  className="tile"
                  initial={{ opacity: 0, x: 80, skewX: -6 }}
                  animate={{ opacity: 1, x: 0, skewX: 0 }}
                  exit={{ opacity: 0, x: -80 }}
                  transition={{ delay: 0.08 + i * 0.1, type: "spring", damping: 20 }}
                >
                  <HexMark color="#0a84d6" />
                  <div className="tile dark" style={{ borderRadius: 0, boxShadow: "none", padding: "12px 12px 10px" }}>
                    <div className="row" style={{ alignItems: "center" }}>
                      <Crest name={club.name} size={48} />
                      <div className="grow">
                        <div className="tile-label break" style={{ fontSize: 22 }}>
                          {club.name}
                        </div>
                        <div className="row tiny" style={{ gap: 6, color: "#b8c8d5", flexWrap: "wrap" }}>
                          <Flag code={club.country} />
                          <LeagueBadge league={club.league} division={club.division} size={16} />
                          <span className="break">
                            {club.league} · {countryName(offer.country ?? club.country)}
                            {region && !club.league.includes(region) ? ` · ${region}` : ""}
                          </span>
                        </div>
                      </div>
                      <OvrHex ovr={club.strength} size={40} label={`Clubstärke ${club.strength}`} />
                    </div>
                  </div>
                  <div style={{ padding: 12 }}>
                    <div className="grid-4">
                      <Stat label="Stärke" value={club.strength} small />
                      <Stat label="Jugend" value={club.youth} small />
                      <Stat label="Prestige" value={club.prestige} small />
                      <Stat label="Finanzen" value={club.finances} small />
                    </div>
                    <div className="row" style={{ marginTop: 8 }}>
                      <span className="chip lime">Einsatzchance: {offer.playtime}</span>
                    </div>
                    <p className="small" style={{ color: "var(--ink-2)", lineHeight: 1.45 }}>
                      {offer.scoutText}
                    </p>
                    <button
                      type="button"
                      className="btn primary block"
                      onClick={() => {
                        tap();
                        onSign(club.id);
                      }}
                    >
                      <Heart size={18} /> Bei {club.name} unterschreiben
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>{!revealed && <Walkout data={card} age={state.player.age} onDone={() => setRevealed(true)} />}</AnimatePresence>
    </div>
  );
}
