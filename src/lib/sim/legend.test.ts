import { describe, expect, it } from "vitest";
import {
  buildLegendMoment,
  careerNarrative,
  careerSeasonRows,
  isUnderdogTrophy,
  legendBreakdown,
  legendHighlights,
  legendScore,
  legendStatus,
  positionGroup,
} from "./legend";
import { createInitialState, signWithClub } from "./engine";
import { clubsOf, getClub } from "./data";
import { subRng } from "./rng";
import { POSITIONS, type GameState, type Pace, type Profile, type SeasonRecord, type Trophy } from "./types";

function profile(seed: number, over: Partial<Profile> = {}): Profile {
  return {
    name: `Legende ${seed}`,
    birthDate: "2008-07-11",
    height: 182,
    weight: 78,
    nat1: "DE",
    pos: POSITIONS[seed % POSITIONS.length]!,
    avatar: "preset:4",
    pace: 1 as Pace,
    seed,
    ...over,
  };
}

/** Schwacher Verein (Underdog) und Topverein aus den echten Daten. */
const underdog = clubsOf("DE", 4).sort((a, b) => a.strength - b.strength)[0]!;
const giant = clubsOf("DE", 1).sort((a, b) => b.strength - a.strength)[0]!;

function season(index: number, over: Partial<SeasonRecord> = {}): SeasonRecord {
  return {
    index,
    age: 18 + index,
    seasonLabel: `${2026 + index}/${String((27 + index) % 100).padStart(2, "0")}`,
    clubId: giant.id,
    leagueLabel: "Bundesliga",
    apps: 30,
    goals: 8,
    assists: 6,
    cleanSheets: 0,
    saves: 0,
    rating: 7.1,
    form: 70,
    startOvr: 70 + index,
    endOvr: 72 + index,
    tablePosition: 3,
    competitions: ["Bundesliga"],
    trophies: [],
    injuries: [],
    natApps: 0,
    natGoals: 0,
    loan: false,
    ...over,
  };
}

function trophy(over: Partial<Trophy> & Pick<Trophy, "kind" | "name" | "refId">): Trophy {
  return { id: `${over.refId}-${over.season ?? 2030}`, season: 2030, age: 26, description: "Titel", ...over };
}

function stateWith(seasons: SeasonRecord[], trophies: Trophy[], seed = 5): GameState {
  let s = createInitialState(profile(seed));
  s = signWithClub(s, giant.id);
  s.seasons = seasons;
  s.trophies = trophies;
  s.peakOvr = Math.max(80, ...seasons.map((x) => x.endOvr));
  return s;
}

describe("Globaler Legendenstatus", () => {
  it("wertet Underdog-Liga-, Pokal- und Kontinentaltitel stark", () => {
    const withUnderdog = legendBreakdown(
      stateWith(
        [season(0)],
        [
          trophy({ kind: "club", name: "Meisterschaft", refId: "league-DE-1", clubId: underdog.id }),
          trophy({ kind: "club", name: "Pokal", refId: "cup-DE", clubId: underdog.id }),
          trophy({ kind: "club", name: "UEFA Champions League", refId: "ucl", clubId: underdog.id }),
        ],
      ),
    );
    const withGiant = legendBreakdown(
      stateWith(
        [season(0)],
        [
          trophy({ kind: "club", name: "Meisterschaft", refId: "league-DE-1", clubId: giant.id }),
          trophy({ kind: "club", name: "Pokal", refId: "cup-DE", clubId: giant.id }),
          trophy({ kind: "club", name: "UEFA Champions League", refId: "ucl", clubId: giant.id }),
        ],
      ),
    );
    expect(isUnderdogTrophy({ ...trophy({ kind: "club", name: "x", refId: "ucl" }), clubId: underdog.id })).toBe(true);
    expect(withUnderdog.underdog).toBeGreaterThan(150);
    expect(withGiant.underdog).toBe(0);
    expect(legendScore(stateWith([season(0)], [])) < withUnderdog.underdog + withGiant.clubTitles).toBe(true);
  });

  it("erhöht den globalen Status durch Erfolge mit mehreren Clubs", () => {
    const other = clubsOf("DE", 1).find((c) => c.id !== giant.id)!;
    const oneClub = legendBreakdown(
      stateWith(
        [season(0)],
        [
          trophy({ kind: "club", name: "Meisterschaft", refId: "league-DE-1", clubId: giant.id, season: 2030 }),
          trophy({ kind: "club", name: "Meisterschaft", refId: "league-DE-1", clubId: giant.id, season: 2031 }),
        ],
      ),
    );
    const twoClubs = legendBreakdown(
      stateWith(
        [season(0)],
        [
          trophy({ kind: "club", name: "Meisterschaft", refId: "league-DE-1", clubId: giant.id, season: 2030 }),
          trophy({ kind: "club", name: "Meisterschaft", refId: "league-DE-1", clubId: other.id, season: 2031 }),
        ],
      ),
    );
    expect(twoClubs.multiClub).toBeGreaterThan(oneClub.multiClub);
    expect(twoClubs.clubTitles).toBe(oneClub.clubTitles);
  });

  it("wiegt FIFA-WM plus gespeicherten Finalmoment besonders stark", () => {
    const wc = trophy({ kind: "national", name: "FIFA Weltmeisterschaft", refId: "fifa-wc", country: "DE" });
    const euro = trophy({ kind: "national", name: "EURO", refId: "uefa-euro", country: "DE" });
    const withWc = legendBreakdown(stateWith([season(0, { legendMoment: "WM 2030: Dein Tor im Finale." })], [wc]));
    const withEuro = legendBreakdown(stateWith([season(0)], [euro]));
    expect(withWc.national).toBeGreaterThan(withEuro.national + 80);
    expect(withWc.moments).toBeGreaterThan(0);
    expect(withEuro.moments).toBe(0);
    expect(legendStatus(stateWith([season(0, { legendMoment: "WM 2030: Dein Tor im Finale." })], [wc])).score).toBeGreaterThan(
      legendStatus(stateWith([season(0)], [euro])).score,
    );
  });

  it("erfindet in Highlights und Narrative keine Trophäen", () => {
    const s = stateWith([season(0), season(1), season(2)], []);
    s.retirementCause = "choice";
    const highlights = legendHighlights(s);
    const text = [...highlights, ...careerNarrative(s)].join(" ").toLowerCase();
    expect(text).not.toContain("meisterschaft");
    expect(text).not.toContain("champions league");
    expect(text).not.toContain("weltmeister");
    expect(careerNarrative(s).join(" ")).toContain("Titel blieben aus");
    expect(highlights.length).toBeGreaterThan(0);
  });

  it("liefert exakt eine Saisonzeile pro Saison in richtiger Reihenfolge", () => {
    const seasons = [0, 1, 2, 3, 4].map((i) => season(i, { clubId: i < 2 ? underdog.id : giant.id }));
    const rows = careerSeasonRows(stateWith(seasons, []));
    expect(rows).toHaveLength(seasons.length);
    expect(rows.map((r) => r.seasonLabel)).toEqual(seasons.map((s) => s.seasonLabel));
    expect(rows.map((r) => r.age)).toEqual(seasons.map((s) => s.age));
    expect(rows[0]!.clubName).toBe(getClub(underdog.id).name);
    expect(rows[4]!.clubName).toBe(getClub(giant.id).name);
  });

  it("beschreibt eine gehaltene Elfmeterszene als Titelgewinn, nicht als Verlust", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const text = buildLegendMoment(subRng(seed, "gk-moment"), {
        pos: "TW",
        tournament: "FIFA Weltmeisterschaft",
        year: 2034,
        nationName: "Deutschland",
        playerName: "Test",
      });
      expect(positionGroup("TW")).toBe("keeper");
      expect(text).toContain("FIFA Weltmeisterschaft 2034");
      expect(text).not.toMatch(/Titel kostet/);
      expect(text).toMatch(/sichert|rettet|feiert|sichern/);
    }
  });
});
