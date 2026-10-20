import type { GameState } from "./types";
import { getClub, countryName } from "./data";
import { adjust, logDecision, outcome, type EventDef, type EventOptionDef } from "./events-core";
import { SCENE_EVENTS } from "./events-scene";

export { adjust, logDecision, outcome };
export type { EventDef, EventOptionDef };

const young = (s: GameState) => s.player.age <= 22;
const veteran = (s: GameState) => s.player.age >= 30;

const BASE_EVENTS: EventDef[] = [
  {
    id: "injury",
    title: "Medizinischer Bericht: ein Schlag zur Unzeit",
    intro: () => "Ein Tritt lässt dich vor der englischen Woche angeschlagen zurück. Die Ärzte raten zur Ruhe, der Trainer hofft auf dich.",
    weight: 14,
    when: (s) => s.player.fitness < 92 || s.player.injuryRisk > 20,
    options: [
      {
        id: "rush",
        label: "Comeback erzwingen",
        hint: "Früher zurück – ein Rückfall wäre teuer",
        apply: (s, rng) => {
          if (rng.chance(0.45)) {
            return {
              consequence: "Du hältst durch, spielst im Schmerz und gewinnst die Kabine für dich.",
              deltas: adjust(s, { morale: 6, reputation: 4, fitness: -4, injuryRisk: 6 }),
            };
          }
          return {
            consequence: "Nach zwei Spielen reißt die Muskulatur erneut – vier Monate Pause.",
            deltas: adjust(s, { morale: -10, fitness: -14, injuryRisk: 12 }),
          };
        },
      },
      {
        id: "heal",
        label: "Sauber auskurieren",
        hint: "Du verpasst Spiele, kehrst aber voll fit zurück",
        apply: (s) => ({
          consequence: "Du fehlst zehn Wochen, kommst dafür ohne Restbeschwerden zurück.",
          deltas: adjust(s, { fitness: 12, injuryRisk: -10, morale: -3, form: -8 }),
        }),
      },
    ],
  },
  {
    id: "burnout",
    title: "Der Kopf ist müde",
    intro: () => "Die Saison war lang. Schlaf, Druck und Erwartungen ziehen an dir. Du merkst: so geht es nicht weiter.",
    weight: 9,
    when: (s) => s.player.morale < 62 || s.player.age >= 24,
    options: [
      {
        id: "push",
        label: "Weitermachen wie bisher",
        hint: "Du beißt dich durch die Belastung",
        apply: (s, rng) =>
          rng.chance(0.4)
            ? {
                consequence: "Du findest über die Arbeit zurück in einen Rhythmus – knapp, aber es trägt.",
                deltas: adjust(s, { form: 6, morale: -4, fitness: -5 }),
              }
            : {
                consequence: "Die Erschöpfung holt dich mitten in der Rückrunde ein.",
                deltas: adjust(s, { morale: -12, fitness: -8, form: -12 }),
              },
      },
      {
        id: "support",
        label: "Auszeit und psychologische Unterstützung",
        hint: "Du nimmst dir bewusst Zeit für deine Gesundheit",
        apply: (s) => ({
          consequence:
            "Du sprichst offen mit dem Verein und arbeitest mit einer Sportpsychologin. Ein paar Spiele fehlst du – danach fühlst du dich klarer als seit Jahren.",
          deltas: adjust(s, { morale: 18, fitness: 6, form: -4, reputation: 2 }),
        }),
      },
    ],
  },
  {
    id: "newcoach",
    title: "Neuer Trainer, neue Idee",
    intro: (s) =>
      `Beim ${getClub(s.player.clubId).name} übernimmt ein Trainer mit klarem Plan – und sieht dich auf einer anderen Position.`,
    weight: 10,
    when: () => true,
    options: [
      {
        id: "accept",
        label: "Positionswechsel annehmen",
        hint: "Neue Rolle, neue Anforderungen",
        apply: (s, rng) =>
          rng.chance(0.55)
            ? {
                consequence: "Die neue Rolle passt dir überraschend gut, du wirst unverzichtbar.",
                deltas: adjust(s, { morale: 6, relationship: 8 }),
              }
            : {
                consequence: "Du wirkst in der neuen Rolle verloren und verlierst Rhythmus.",
                deltas: adjust(s, { form: -10, morale: -6 }),
              },
      },
      {
        id: "refuse",
        label: "Auf deiner Position bestehen",
        hint: "Du bleibst dir treu, riskierst aber Reibung",
        apply: (s, rng) =>
          rng.chance(0.5)
            ? {
                consequence: "Der Trainer akzeptiert dein Profil und baut die Elf um dich herum.",
                deltas: adjust(s, { morale: 8, form: 6, relationship: 3 }),
              }
            : {
                consequence: "Der Trainer setzt dich auf die Bank, um ein Zeichen zu setzen.",
                deltas: adjust(s, { morale: -10, relationship: -14, form: -8 }),
              },
      },
    ],
  },
  {
    id: "bench",
    title: "Bankrolle oder Leihe",
    intro: (s) => `Beim ${getClub(s.player.clubId).name} bist du nur noch Rotationsspieler. Ein Zweitligist würde dich sofort ausleihen.`,
    weight: 11,
    when: (s) => s.player.ovr < getClub(s.player.clubId).strength - 3 && s.player.age < 30,
    options: [
      {
        id: "stay",
        label: "Bleiben und kämpfen",
        hint: "Wenig Spielzeit, aber Topniveau im Training",
        apply: (s, rng) =>
          rng.chance(0.45)
            ? {
                consequence: "Du drängst dich über das Training zurück in die Startelf.",
                deltas: adjust(s, { morale: 5, relationship: 6 }),
              }
            : {
                consequence: "Ein Jahr auf der Bank kostet dich Rhythmus und Selbstvertrauen.",
                deltas: adjust(s, { morale: -10, form: -12 }),
              },
      },
      {
        id: "loan",
        label: "Leihe annehmen",
        hint: "Volle Spielzeit eine Klasse tiefer",
        apply: (s) => {
          s.player.loan = true;
          return {
            consequence: "Du spielst jede Minute, sammelst Tore und Vertrauen.",
            deltas: adjust(s, { form: 12, morale: 8, fitness: 4 }),
          };
        },
      },
    ],
  },
  {
    id: "moneymove",
    title: "Ein Angebot, das alles verändert",
    intro: () => "Ein finanzstarker Klub aus einer schwächeren Liga bietet dir das Vierfache deines Gehalts.",
    weight: 8,
    when: (s) => s.player.ovr >= 74,
    options: [
      {
        id: "money",
        label: "Dem Geld folgen",
        hint: "Finanzielle Sicherheit, sportlich ein Risiko",
        apply: (s) => {
          s.player.wage = Math.round(s.player.wage * 3.4);
          return {
            consequence: "Du unterschreibst einen Rekordvertrag – die Fachpresse rätselt über deine Motive.",
            deltas: adjust(s, { morale: 8, reputation: -6 }),
          };
        },
      },
      {
        id: "sport",
        label: "Sportlichen Weg gehen",
        hint: "Weniger Gehalt, mehr Wettbewerb",
        apply: (s) => ({
          consequence: "Du lehnst ab und stellst klar, dass Titel zählen. Die Fans feiern das.",
          deltas: adjust(s, { reputation: 8, morale: 6, relationship: 8 }),
        }),
      },
    ],
  },
  {
    id: "agent",
    title: "Streit mit dem Berater",
    intro: () => "Dein Agent verhandelt hinter deinem Rücken. Vertrauen ist keins mehr da.",
    weight: 7,
    when: (s) => s.player.age >= 19,
    options: [
      {
        id: "split",
        label: "Trennen und neu aufstellen",
        hint: "Unruhige Monate, danach klare Verhältnisse",
        apply: (s) => ({
          consequence: "Der Wechsel kostet Nerven, aber dein Umfeld arbeitet endlich für dich.",
          deltas: adjust(s, { morale: -4, reputation: 3, form: -4 }),
        }),
      },
      {
        id: "keep",
        label: "Aussprechen und weiterarbeiten",
        hint: "Bekanntes Umfeld, ungelöster Konflikt",
        apply: (s, rng) =>
          rng.chance(0.5)
            ? {
                consequence: "Ihr klärt die Regeln neu – die Zusammenarbeit läuft wieder rund.",
                deltas: adjust(s, { morale: 5, reputation: 2 }),
              }
            : {
                consequence: "Die nächste Indiskretion landet in der Presse.",
                deltas: adjust(s, { morale: -8, reputation: -7 }),
              },
      },
    ],
  },
  {
    id: "media",
    title: "Die Medien haben dich gefunden",
    intro: () => "Nach einer schwachen Phase wird jede Bewegung von dir zerlegt. Die Talkrunden diskutieren deinen Marktwert.",
    weight: 8,
    when: (s) => s.player.form < 55 || s.player.reputation > 60,
    options: [
      {
        id: "silence",
        label: "Schweigen und arbeiten",
        hint: "Keine Schlagzeilen, nur Leistung",
        apply: (s) => ({
          consequence: "Du gibst keine Interviews mehr und beantwortest alles auf dem Platz.",
          deltas: adjust(s, { form: 8, morale: 3, reputation: 2 }),
        }),
      },
      {
        id: "answer",
        label: "Öffentlich Stellung beziehen",
        hint: "Klare Worte – mit Echo",
        apply: (s, rng) =>
          rng.chance(0.5)
            ? {
                consequence: "Deine ehrliche Pressekonferenz macht dich zum Sympathieträger.",
                deltas: adjust(s, { reputation: 10, morale: 8 }),
              }
            : {
                consequence: "Ein Halbsatz wird herausgeschnitten und beschäftigt dich wochenlang.",
                deltas: adjust(s, { reputation: -8, morale: -8, form: -6 }),
              },
      },
    ],
  },
  {
    id: "captain",
    title: "Die Binde wartet auf dich",
    intro: (s) => `Die Mannschaft des ${getClub(s.player.clubId).name} hat gewählt: Du sollst Kapitän werden.`,
    weight: 8,
    when: (s) => s.player.age >= 25 && s.player.reputation >= 45,
    once: true,
    options: [
      {
        id: "yes",
        label: "Verantwortung übernehmen",
        hint: "Mehr Einfluss, mehr Druck",
        apply: (s) => ({
          consequence: "Du führst die Kabine – laut, wenn nötig, ruhig, wenn es zählt.",
          deltas: adjust(s, { reputation: 12, morale: 8, relationship: 12, form: -2 }),
        }),
      },
      {
        id: "no",
        label: "Ablehnen und Spieler bleiben",
        hint: "Fokus ganz auf dein eigenes Spiel",
        apply: (s) => ({
          consequence: "Du konzentrierst dich auf deine Leistung – der Trainer respektiert das.",
          deltas: adjust(s, { form: 8, reputation: -3 }),
        }),
      },
    ],
  },
  {
    id: "mentor",
    title: "Ein Routinier nimmt dich mit",
    intro: () => "Ein 34-jähriger Mitspieler bietet an, dich täglich eine Stunde extra zu coachen.",
    weight: 9,
    when: young,
    options: [
      {
        id: "accept",
        label: "Zusatztraining annehmen",
        hint: "Weniger Freizeit, mehr Handwerk",
        apply: (s) => ({
          consequence: "Deine Entscheidungsfindung im letzten Drittel wird sichtbar besser.",
          deltas: adjust(s, { fitness: -3, morale: 4 }),
        }),
      },
      {
        id: "decline",
        label: "Dankend ablehnen",
        hint: "Erholung ist auch Training",
        apply: (s) => ({
          consequence: "Du achtest auf Regeneration und bleibst über die Saison konstant frisch.",
          deltas: adjust(s, { fitness: 10, injuryRisk: -6, form: 4 }),
        }),
      },
    ],
  },
  {
    id: "family",
    title: "Familie oder Fahrtzeit",
    intro: () => "Deine Familie lebt weit weg. Ein Verein näher an der Heimat fragt an – sportlich ein kleiner Schritt zurück.",
    weight: 7,
    when: (s) => s.player.age >= 23,
    options: [
      {
        id: "home",
        label: "Nähe zur Familie wählen",
        hint: "Ruhe im Kopf, kleinere Bühne",
        apply: (s) => ({
          consequence: "Du wohnst wieder 20 Minuten von zuhause. Der Kopf ist frei wie lange nicht.",
          deltas: adjust(s, { morale: 16, form: 6, reputation: -4 }),
        }),
      },
      {
        id: "stay",
        label: "Sportlich oben bleiben",
        hint: "Große Bühne, weite Wege",
        apply: (s) => ({
          consequence: "Du bleibst – und telefonierst jeden Abend nach Hause.",
          deltas: adjust(s, { morale: -6, reputation: 3 }),
        }),
      },
    ],
  },
  {
    id: "language",
    title: "Sprachbarriere in der Kabine",
    intro: (s) => `In ${countryName(getClub(s.player.clubId).country)} verstehst du die Hälfte der Ansagen nicht.`,
    weight: 7,
    when: (s) => getClub(s.player.clubId).country !== s.profile.nat1,
    options: [
      {
        id: "learn",
        label: "Intensivkurs neben dem Training",
        hint: "Anstrengend, aber nachhaltig",
        apply: (s) => ({
          consequence: "Nach vier Monaten führst du die Interviews in der Landessprache.",
          deltas: adjust(s, { relationship: 14, morale: 8, fitness: -2 }),
        }),
      },
      {
        id: "translator",
        label: "Mit Dolmetscher arbeiten",
        hint: "Bequem, aber Distanz bleibt",
        apply: (s) => ({
          consequence: "Auf dem Platz klappt es, daneben bleibst du außen vor.",
          deltas: adjust(s, { relationship: -8, form: 3 }),
        }),
      },
    ],
  },
  {
    id: "youngster",
    title: "Ein Talent atmet dir im Nacken",
    intro: () => "Ein 18-Jähriger aus der eigenen Jugend trainiert auf deiner Position – und ist richtig gut.",
    weight: 9,
    when: veteran,
    options: [
      {
        id: "help",
        label: "Ihn fördern",
        hint: "Du gibst Wissen weiter",
        apply: (s) => ({
          consequence: "Du wirst zur Führungsfigur; der Klub verlängert aus Überzeugung.",
          deltas: adjust(s, { reputation: 10, relationship: 14, morale: 6 }),
        }),
      },
      {
        id: "fight",
        label: "Platz verteidigen",
        hint: "Volle Härte im Zweikampf um die Elf",
        apply: (s, rng) =>
          rng.chance(0.55)
            ? {
                consequence: "Du zeigst im Training, warum du seit Jahren spielst.",
                deltas: adjust(s, { form: 10, relationship: -4 }),
              }
            : {
                consequence: "Der Junge zieht vorbei – die Kabine merkt es zuerst.",
                deltas: adjust(s, { morale: -10, relationship: -8 }),
              },
      },
    ],
  },
  {
    id: "rehab",
    title: "Reha-Entscheidung",
    intro: () => "Nach einer langen Verletzung stehen zwei Wege offen: klassische Reha im Verein oder ein teures Spezialprogramm im Ausland.",
    weight: 6,
    when: (s) => s.player.fitness < 78,
    options: [
      {
        id: "special",
        label: "Spezialprogramm im Ausland",
        hint: "Teuer, individuell, weit weg vom Team",
        apply: (s, rng) =>
          rng.chance(0.65)
            ? {
                consequence: "Du kommst athletisch stärker zurück als vor der Verletzung.",
                deltas: adjust(s, { fitness: 20, injuryRisk: -14, relationship: -5 }),
              }
            : {
                consequence: "Das Programm bringt wenig, dafür fehlst du der Mannschaft.",
                deltas: adjust(s, { fitness: 6, morale: -8, relationship: -8 }),
              },
      },
      {
        id: "club",
        label: "Reha im Verein",
        hint: "Nah am Team, Standardweg",
        apply: (s) => ({
          consequence: "Du arbeitest täglich mit dem Ärzteteam und bleibst Teil der Gruppe.",
          deltas: adjust(s, { fitness: 12, relationship: 8, injuryRisk: -6 }),
        }),
      },
    ],
  },
  {
    id: "fanproject",
    title: "Die Kurve fragt nach dir",
    intro: () => "Ein Fanprojekt bittet dich, Pate eines Nachwuchszentrums im Viertel zu werden. Es kostet Zeit.",
    weight: 6,
    when: (s) => s.player.age >= 21,
    options: [
      {
        id: "join",
        label: "Patenschaft übernehmen",
        hint: "Zeit investieren, Wurzeln schlagen",
        apply: (s) => ({
          consequence: "Dein Name steht künftig auf der Fassade eines Trainingszentrums.",
          deltas: adjust(s, { reputation: 12, relationship: 12, morale: 6, fitness: -2 }),
        }),
      },
      {
        id: "skip",
        label: "Freundlich ablehnen",
        hint: "Voller Fokus auf die Saison",
        apply: (s) => ({
          consequence: "Du hältst deinen Kalender frei und trainierst stattdessen.",
          deltas: adjust(s, { form: 5, reputation: -4 }),
        }),
      },
    ],
  },
];

export const EVENTS: EventDef[] = [...BASE_EVENTS, ...SCENE_EVENTS];

export function eventById(id: string): EventDef | undefined {
  return EVENTS.find((e) => e.id === id);
}
