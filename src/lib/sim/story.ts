/**
 * Die Lebensgeschichte für den Schlussbildschirm – in Kapiteln, persönlich und
 * mit Pathos. Jeder Satz beruht auf echten Werten aus dem Spielstand; Erfolge,
 * die es nicht gab, werden nicht erfunden. Formulierungen variieren
 * deterministisch über den Seed.
 */
import type { GameState, SeasonRecord, Trophy } from "./types";
import { getClub, countryName } from "./data";
import { regionName } from "./regions";
import { subRng } from "./rng";
import { TRAITS, traitsOfProfile } from "./personality";
import { reputationTags, seasonsAt } from "./reputation";

export interface StoryChapter {
  title: string;
  text: string;
}

export interface StoryContext {
  /** Die wertvollste Trophäe (aus legend.ts). */
  biggest?: Trophy | undefined;
  tierName: string;
  tierKey: string;
  score: number;
}

const club = (id: string) => getClub(id).name;

function longestStint(seasons: SeasonRecord[]): { clubId: string; n: number; from: string; to: string } | null {
  let best: { clubId: string; n: number; from: string; to: string } | null = null;
  let cur: { clubId: string; n: number; from: string; to: string } | null = null;
  for (const s of seasons) {
    const id = s.parentClubId ?? s.clubId;
    if (cur && cur.clubId === id) {
      cur.n++;
      cur.to = s.seasonLabel;
    } else cur = { clubId: id, n: 1, from: s.seasonLabel, to: s.seasonLabel };
    if (!best || cur.n > best.n) best = { ...cur };
  }
  return best;
}

export function careerStory(state: GameState, ctx: StoryContext): StoryChapter[] {
  const seasons = state.seasons;
  const name = state.profile.name;
  const first = seasons[0];
  const last = seasons[seasons.length - 1];
  if (!first || !last) return [{ title: "Prolog", text: `${name} hat noch keine Profisaison abgeschlossen. Die Geschichte wartet auf ihr erstes Kapitel.` }];

  const rng = subRng(state.profile.seed, "story");
  const pick = <T,>(arr: readonly T[]) => rng.pick(arr);
  const chapters: StoryChapter[] = [];
  const isGk = state.profile.pos === "TW";
  const traits = traitsOfProfile(state.profile);
  const peakOvr = Math.max(state.peakOvr, state.player.ovr);
  const birthYear = new Date(state.profile.birthDate).getFullYear();

  /* ---------------------------------------------------------- Prolog */
  const home = state.profile.region ? `${regionName(state.profile.nat1, state.profile.region)}, ${countryName(state.profile.nat1)}` : countryName(state.profile.nat1);
  const heart = state.heartClub ?? first.clubId;
  let prolog =
    `${Number.isFinite(birthYear) ? `${birthYear}, ` : ""}${home}. ` +
    pick([
      `Ein Junge mit einem Ball, der nie stillstand – und einem Traum, den niemand ernst nahm.`,
      `Ein Bolzplatz, ein Tor ohne Netz und ein Kind, das schon damals nicht verlieren konnte.`,
      `Dort, wo die Flutlichter nur samstags brannten, begann eine Geschichte, die keiner kommen sah.`,
    ]) +
    ` Mit ${first.age} Jahren unterschrieb ${name} bei ${club(heart)} – dem Verein, der für immer sein Herzensverein bleiben sollte. ` +
    `Startwert: ${first.startOvr}. ${first.startOvr <= 56 ? "Niemand hätte darauf gewettet." : first.startOvr >= 66 ? "Die Scouts sprachen schon damals von einem Ausnahmetalent." : "Ein Talent unter vielen – noch."}`;
  if (state.profile.personality?.trim()) {
    const described = traits.map((t) => TRAITS[t].label.toLowerCase());
    prolog += ` Gefragt, wer er sei, antwortete er: „${state.profile.personality.trim()}“.${described.length ? ` ${pick(["Er sollte sich daran messen lassen müssen.", "Die Karriere würde zeigen, wie viel davon stimmte.", "Ein Satz, der ihn begleiten würde – im Guten wie im Schlechten."])}` : ""}`;
  }
  chapters.push({ title: "Prolog", text: prolog });

  /* ------------------------------------------------------ Der Aufstieg */
  const jumps = seasons.map((s) => ({ s, d: s.endOvr - s.startOvr }));
  const breakthrough = [...jumps].sort((a, b) => b.d - a.d || a.s.index - b.s.index)[0];
  const firstBig = seasons.find((s) => s.endOvr >= 75);
  const firstTransfer = seasons.find((s) => s.transferNote);
  let rise = "";
  if (breakthrough && breakthrough.d >= 3) {
    rise += `Der Durchbruch kam ${breakthrough.s.seasonLabel} bei ${club(breakthrough.s.clubId)}: +${breakthrough.d} in einer einzigen Saison, ${breakthrough.s.apps} Einsätze, ${isGk ? `${breakthrough.s.cleanSheets} Spiele ohne Gegentor` : `${breakthrough.s.goals} Tore`}. ${pick(["Plötzlich kannte man seinen Namen.", "Ab da schauten die großen Klubs hin.", "Aus dem Versprechen wurde ein Spieler."])} `;
  } else {
    rise += `Ein schneller Durchbruch blieb aus. ${name} musste sich jeden Schritt erarbeiten – Saison für Saison, Training für Training. `;
  }
  if (firstTransfer) {
    rise += `${firstTransfer.transferNote ?? ""} – mit ${firstTransfer.age} Jahren der erste große Schritt in die Fremde. `;
  }
  if (firstBig) {
    rise += `Mit ${firstBig.age} Jahren knackte er erstmals die 75 – ${firstBig.age <= 21 ? "in einem Alter, in dem andere noch auf der Bank sitzen." : "spät, aber umso verdienter."}`;
  }
  chapters.push({ title: "Der Aufstieg", text: rise.trim() });

  /* ---------------------------------------------------- Auf dem Gipfel */
  const peak = [...seasons].sort((a, b) => b.endOvr - a.endOvr || a.index - b.index)[0]!;
  const bestGoals = [...seasons].sort((a, b) => b.goals - a.goals)[0]!;
  const totalApps = seasons.reduce((a, s) => a + s.apps, 0);
  let summit = `${peak.seasonLabel}, ${peak.age} Jahre, ${club(peak.clubId)}: ${name} erreichte ${peakOvr} – ${peakOvr >= 90 ? "Weltklasse, einer der Besten seiner Generation" : peakOvr >= 85 ? "das Niveau, von dem Millionen Kinder träumen" : peakOvr >= 78 ? "ein Spieler, vor dem Gegner Respekt hatten" : peakOvr >= 70 ? "ein gestandener Profi" : "das Beste, was in ihm steckte"}. `;
  if (!isGk && bestGoals.goals >= 15) summit += `Seine torreichste Saison: ${bestGoals.goals} Treffer ${bestGoals.seasonLabel} für ${club(bestGoals.clubId)}. `;
  if (state.trophies.length === 0) {
    summit += `Titel blieben aus. Was bleibt, sind ${totalApps} Pflichtspiele und das Wissen, dass er nie aufgehört hat, es zu versuchen. Manche Karrieren werden nicht in Pokalen gemessen.`;
  } else {
    const club_ = state.trophies.filter((t) => t.kind === "club").length;
    const nat = state.trophies.filter((t) => t.kind === "national").length;
    const aw = state.trophies.filter((t) => t.kind === "award").length;
    if (ctx.biggest) {
      summit += `Der größte Moment: ${ctx.biggest.name} ${ctx.biggest.season}${ctx.biggest.clubId ? ` mit ${club(ctx.biggest.clubId)}` : ctx.biggest.country ? ` mit ${countryName(ctx.biggest.country)}` : ""}. ${pick(["Er hielt den Pokal lange fest, als hätte er Angst, ihn wieder hergeben zu müssen.", "Auf dem Rasen kniend, die Hände vor dem Gesicht – das Bild ging um die Welt.", "Später sagte er, er erinnere sich an keine Sekunde der Siegerehrung. Nur an den Lärm."])} `;
    }
    summit += `Insgesamt ${[club_ ? `${club_} Vereinstitel` : "", nat ? `${nat} Titel mit der Nationalmannschaft` : "", aw ? `${aw} persönliche Auszeichnungen` : ""].filter(Boolean).join(", ")}.`;
  }
  const moment = seasons.find((s) => s.legendMoment)?.legendMoment;
  if (moment) summit += ` ${moment}`;
  if (state.national.caps > 0 && state.national.committed) {
    summit += ` Für ${countryName(state.national.committed)} lief er ${state.national.caps}-mal auf${state.national.goals ? ` und traf ${state.national.goals}-mal` : ""}.`;
  }
  chapters.push({ title: "Auf dem Gipfel", text: summit });

  /* ------------------------------------------------- Narben und Treue */
  const scars: string[] = [];
  const betrayals = state.betrayals ?? [];
  for (const b of betrayals.slice(0, 2)) {
    const victims = b.betrayedClubIds.map(club).join(" und ");
    scars.push(
      b.betrayedClubIds.length > 1
        ? `Mit ${b.age} Jahren der Wechsel zu ${club(b.toClubId)} – Doppelverrat an ${victims}. Für zwei Kurven wurde er an diesem Tag zum Feind.`
        : `Mit ${b.age} Jahren ging er zu ${club(b.toClubId)}. ${b.label}. In ${victims} sprechen sie seinen Namen bis heute nicht aus.`,
    );
  }
  if (state.player.majorInjuries > 0) {
    const injury = seasons.find((s) => s.injuries.some((i) => /riss|bruch/i.test(i)));
    scars.push(
      injury
        ? `${injury.seasonLabel}: ${injury.injuries[0]}. Monate in der Reha, allein im Kraftraum, während die anderen spielten. ${pick(["Er kam zurück.", "Viele hätten aufgehört. Er nicht.", "Das Comeback war leiser als die Verletzung – aber es war seins."])}`
        : `${state.player.majorInjuries} schwere Verletzungen warfen ihn zurück. Jedes Mal kam er wieder.`,
    );
  }
  const stint = longestStint(seasons);
  if (stint && stint.n >= 6) {
    scars.push(`${stint.n} Saisons bei ${club(stint.clubId)} (${stint.from} bis ${stint.to}) – im modernen Fußball eine halbe Ewigkeit.${traits.includes("loyal") ? " Er hatte gesagt, er sei loyal. Er hat es bewiesen." : ""}`);
  } else if (traits.includes("loyal") && betrayals.length) {
    scars.push("Er hatte sich selbst als loyal beschrieben. Die Fans, die er zurückließ, erinnern ihn bis heute daran.");
  }
  if (state.investorProject?.accepted) {
    scars.push(`Dann kam das Angebot von ${state.investorProject.investorName}: ${club(state.investorProject.clubId)}, ein Stadion aus Glas, Weltstars, ein Gehalt jenseits aller Vorstellung. Er sagte ja – und musste sich nie wieder Sorgen um Geld machen.`);
  } else if (state.investorProject && state.investorProject.accepted === false) {
    scars.push(`Als ${state.investorProject.investorName} mit einem Koffer voller Millionen bei ${club(state.investorProject.clubId)} anklopfte, sagte er nein. Manche nannten es Dummheit. Er nannte es Haltung.`);
  }
  const heartSeasons = state.heartClub ? seasonsAt(state, state.heartClub) : 0;
  const returned = state.heartClub && seasons.some((s, i) => i > 0 && s.clubId === state.heartClub && seasons[i - 1]!.clubId !== state.heartClub);
  if (returned) scars.push(`Und irgendwann kehrte er heim zu ${club(state.heartClub!)}. Das Stadion stand, als er zum ersten Mal wieder einlief.`);
  else if (heartSeasons === seasons.length && seasons.length >= 5) scars.push(`Er hat nie für einen anderen Verein als ${club(state.heartClub!)} gespielt. Kein Geld der Welt hat daran etwas geändert.`);
  const tags = reputationTags(state);
  if (tags.length) scars.push(`Was die Fußballwelt über ihn sagt: ${tags.map((t) => t.label).join(", ")}.`);
  if (scars.length) chapters.push({ title: betrayals.length ? "Verrat und Narben" : "Narben und Treue", text: scars.join(" ") });

  /* ---------------------------------------------------- Weichenstellungen */
  const gambles = state.decisions.filter((d) => d.gamble);
  const boldWins = gambles.filter((d) => d.gamble!.outcome === "win" && d.gamble!.delta >= 2);
  const keyDecision = boldWins[0] ?? state.decisions.find((d) => d.kind === "club" && d.choice !== "Beim aktuellen Verein bleiben") ?? state.decisions[0];
  if (keyDecision) {
    chapters.push({
      title: "Die Weichenstellung",
      text: `Mit ${keyDecision.age} Jahren stand er vor der Frage „${keyDecision.title}“. Er entschied sich: ${keyDecision.choice}. ${keyDecision.consequence.split(/(?<=[.!?])\s/)[0] ?? ""} Rückblickend sagte er, das sei der Moment gewesen, in dem er wusste, wer er als Fußballer sein wollte.`,
    });
  }

  /* -------------------------------------------------- Der letzte Vorhang */
  const lastFans = state.fanRelations[last.clubId] ?? 50;
  const ending =
    state.retirementCause === "body"
      ? `Am Ende entschied der Körper. Nach ${last.age} Jahren und ${totalApps} Pflichtspielen ging es nicht mehr. `
      : state.player.retirementExtensions > 0
        ? `${state.player.retirementExtensions === 1 ? "Eine Saison" : `${state.player.retirementExtensions} Saisons`} hängte er noch an – weil er nicht loslassen konnte. Mit ${last.age} war Schluss. `
        : `Mit ${last.age} Jahren entschied er selbst, dass es genug war. `;
  const farewell =
    lastFans >= 75
      ? `Beim letzten Heimspiel für ${club(last.clubId)} erhob sich das ganze Stadion. ${pick(["Er lief eine Ehrenrunde, langsamer als jeder Sprint seiner Karriere.", "Die Kurve hatte eine Choreografie vorbereitet: sein Gesicht, so groß wie die Tribüne.", "Als er ausgewechselt wurde, applaudierten auch die Gästefans."])}`
      : lastFans <= 30
        ? `Sein Abschied bei ${club(last.clubId)} war leise. Keine Choreografie, kein Abschiedsspiel – nur ein letzter Blick in die leere Kabine.`
        : `Der letzte Auftritt für ${club(last.clubId)} endete mit warmem Applaus und einer Umarmung des Zeugwarts, der ihn seit dem ersten Tag kannte.`;
  const comeback = state.comebacks > 0 ? " Und weil er nicht ohne Fußball konnte, kam er sogar noch einmal zurück." : "";
  const closing: Record<string, string[]> = {
    unsterblich: ["Es gibt Spieler, die eine Ära prägen. Und es gibt Spieler, die eine Ära sind.", "Seine Rückennummer wird nie wieder vergeben werden."],
    legende: ["Väter werden ihren Kindern von ihm erzählen.", "Er wird nicht vergessen werden – nicht in diesem Leben."],
    ikone: ["Er war ein Gesicht seiner Zeit.", "In seinen Städten hängt sein Trikot noch heute in den Kneipen."],
    star: ["Ein Name, den die Liga kannte – und den sie vermissen wird.", "Er war gut. An manchen Tagen war er großartig."],
    profi: ["Keine Legende, kein Mythos – aber jemand, der seinen Traum gelebt hat.", "Nicht jeder wird ein Held. Aber jeder Held war einmal ein Kind mit einem Ball."],
  };
  chapters.push({
    title: "Der letzte Vorhang",
    text: `${ending}${farewell}${comeback} ${pick(closing[ctx.tierKey] ?? closing["profi"]!)} ${name} – ${ctx.tierName}.`,
  });

  return chapters;
}
