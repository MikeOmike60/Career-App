import { ovrTone } from "@/lib/sim/format";
import { getClub } from "@/lib/sim/data";
import type { GameState } from "@/lib/sim/types";
import { Avatar } from "./Avatar";
import { Crest } from "./Crest";
import { Flag } from "./Flag";

/** Kartenfarben je OVR-Dekade (Original-Farbschema, als Kartenmaterial). */
const CARD = {
  slate: { bg: "linear-gradient(160deg,#e5ebef 0%,#aab7c2 45%,#73828f 100%)", ink: "#1d2730", line: "rgba(29,39,48,.25)" },
  cyan: { bg: "linear-gradient(160deg,#c9f3ff 0%,#3cc8e8 45%,#0a7d9c 100%)", ink: "#06303c", line: "rgba(6,48,60,.25)" },
  emerald: { bg: "linear-gradient(160deg,#cff7e6 0%,#3fd59f 45%,#0a7a53 100%)", ink: "#06321f", line: "rgba(6,50,31,.25)" },
  violet: { bg: "linear-gradient(160deg,#ece2ff 0%,#a985f5 45%,#5a2bbd 100%)", ink: "#fff", line: "rgba(255,255,255,.35)" },
  gold: { bg: "linear-gradient(160deg,#fff6c9 0%,#f0c63c 40%,#b07d0a 100%)", ink: "#2b1d00", line: "rgba(43,29,0,.25)" },
} as const;

export interface CardData {
  name: string;
  avatar: string;
  ovr: number;
  pos: string;
  nat: string;
  clubName?: string | undefined;
  stats: [string, number | string][];
}

export function cardDataFrom(state: GameState): CardData {
  const p = state.player;
  return {
    name: state.profile.name,
    avatar: state.profile.avatar,
    ovr: p.ovr,
    pos: state.profile.pos,
    nat: state.profile.nat1,
    clubName: state.phase === "offers" ? undefined : getClub(p.clubId).name,
    stats: [
      ["ALT", p.age],
      ["FRM", Math.round(p.form)],
      ["FIT", Math.round(p.fitness)],
      ["MOR", Math.round(p.morale)],
      ["REP", Math.round(p.reputation)],
      ["MEN", Math.round(p.mentality)],
    ],
  };
}

/** FUT-artige Spielerkarte mit Glanzanimation. */
export function PlayerCard({ data, width = 168 }: { data: CardData; width?: number }) {
  const tone = CARD[ovrTone(data.ovr)];
  const scale = width / 168;
  const lastName = data.name.split(" ").slice(-1)[0] ?? data.name;
  return (
    <div className="pcard" style={{ width, color: tone.ink }} aria-label={`Spielerkarte ${data.name}, OVR ${data.ovr}`}>
      <div className="pcard-shape" style={{ background: tone.bg }}>
        <svg viewBox="0 0 100 140" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.18 }} aria-hidden>
          <polygon points="50,8 86,29 86,71 50,92 14,71 14,29" fill="none" stroke="#fff" strokeWidth="1.2" />
          <polygon points="50,20 76,35 76,65 50,80 24,65 24,35" fill="none" stroke="#fff" strokeWidth="0.8" />
        </svg>
      </div>
      <div style={{ position: "absolute", inset: 0, padding: `${16 * scale}px ${14 * scale}px` }}>
        <div style={{ position: "absolute", left: 14 * scale, top: 20 * scale, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 * scale, zIndex: 2 }}>
          <span className="pcard-ovr" style={{ fontSize: 40 * scale }}>
            {data.ovr}
          </span>
          <span className="pcard-pos" style={{ fontSize: 17 * scale }}>
            {data.pos}
          </span>
          <span style={{ width: 22 * scale, height: 1, background: tone.line }} />
          <Flag code={data.nat} size={18 * scale} />
          {data.clubName ? <Crest name={data.clubName} size={22 * scale} /> : null}
        </div>
        <div style={{ position: "absolute", right: 8 * scale, top: 22 * scale }}>
          <Avatar avatar={data.avatar} name={data.name} size={98 * scale} transparent />
        </div>
        <div style={{ position: "absolute", left: 10 * scale, right: 10 * scale, top: 124 * scale }}>
          <div className="pcard-name" style={{ fontSize: 18 * scale }}>
            {lastName}
          </div>
          <div style={{ height: 1, background: tone.line, margin: `${4 * scale}px ${10 * scale}px` }} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              columnGap: 8 * scale,
              rowGap: 1,
              padding: `0 ${8 * scale}px`,
              fontFamily: "var(--font-display)",
              fontSize: 13 * scale,
              lineHeight: 1.15,
            }}
          >
            {data.stats.map(([k, v]) => (
              <div key={k} className="tnum" style={{ display: "flex", gap: 4 * scale, justifyContent: "center" }}>
                <b style={{ fontWeight: 800 }}>{v}</b>
                <span style={{ fontWeight: 600, opacity: 0.85 }}>{k}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
