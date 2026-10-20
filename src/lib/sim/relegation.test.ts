import { describe, expect, it } from "vitest";
import { pickRelegated, profileOf, type TableRow } from "./world";
import { allClubs } from "./data";
import { subRng } from "./rng";
import type { ClubWorldEntry, CountryWorld } from "./types";

/** Zwei sehr stabile Traditionsvereine, die im Test nebeneinander stehen. */
function stableClubIds(count: number): string[] {
  return allClubs()
    .filter((c) => profileOf(c.id).topFlightStability >= 0.85)
    .slice(0, count)
    .map((c) => c.id);
}

function entry(division: number): ClubWorldEntry {
  return { division, strength: 80, crisisLevel: 0, poorStreak: 0 } as ClubWorldEntry;
}

function makeWorld(ids: string[], division: number): CountryWorld {
  const clubs: Record<string, ClubWorldEntry> = {};
  for (const id of ids) clubs[id] = entry(division);
  return { code: "IT", clubs, lastSeason: 0 };
}

function rowsFor(ids: string[]): TableRow[] {
  return ids.map((id, i) => ({ id, name: id, strength: 80 - i, score: 100 - i }));
}

describe("pickRelegated ist schleifensicher", () => {
  it("terminiert mit zwei benachbarten stabilen Clubs am Tabellenende", () => {
    const stable = stableClubIds(2);
    expect(stable.length).toBe(2);
    const filler = allClubs()
      .filter((c) => !stable.includes(c.id) && profileOf(c.id).topFlightStability < 0.85)
      .slice(0, 6)
      .map((c) => c.id);
    const ids = [...filler, ...stable];
    const cw = makeWorld(ids, 2);
    const rows = rowsFor(ids);
    const positions: Record<string, number> = {};
    rows.forEach((r, i) => (positions[r.id] = i + 1));

    const out = pickRelegated(rows, 2, cw, subRng(1, "test"), positions);

    expect(out.length).toBe(2);
    // Kein Ping-Pong: stabile Clubs stehen jetzt über den Absteigern.
    for (const id of stable) expect(out).not.toContain(id);
    // Tabellenplätze bleiben 1-basiert und lückenlos.
    const sorted = rows.map((r) => positions[r.id]!).sort((a, b) => a - b);
    expect(sorted).toEqual(rows.map((_, i) => i + 1));
  });

  it("relegiert weiterhin, wenn nur stabile Clubs vorhanden sind", () => {
    const stable = stableClubIds(4);
    const cw = makeWorld(stable, 2);
    const rows = rowsFor(stable);
    const positions: Record<string, number> = {};
    rows.forEach((r, i) => (positions[r.id] = i + 1));
    const out = pickRelegated(rows, 1, cw, subRng(7, "test"), positions);
    expect(out.length).toBe(1);
    // Der letzte verbleibende Club kann sich nicht mehr wegtauschen.
    expect(out[0]).toBe(stable[stable.length - 1]);
  });

  it("Abstiegspfad bleibt für viele Seeds > 0", () => {
    const ids = allClubs().slice(0, 10).map((c) => c.id);
    let total = 0;
    for (let seed = 0; seed < 50; seed++) {
      const cw = makeWorld(ids, 1);
      const rows = rowsFor(ids);
      const positions: Record<string, number> = {};
      rows.forEach((r, i) => (positions[r.id] = i + 1));
      total += pickRelegated(rows, 2, cw, subRng(seed, "test"), positions).length;
    }
    expect(total).toBe(100);
  });
});
