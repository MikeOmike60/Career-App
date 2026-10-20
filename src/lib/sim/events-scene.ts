/**
 * Fußballszene: Derby, Fans, Kabine, Medien, Mentalität, Verletzungsverlauf.
 * Alle Ausgänge sind verdeckt gewichtet – sichere Wege haben kleinere Varianz.
 */
import type { EventDef } from "./events-core";
import { adjust, outcome } from "./events-core";
import { getClub } from "./data";
import { relationsOf } from "./club-relations";
import type { GameState } from "./types";

const rivalOf = (s: GameState) => {
  const rels = relationsOf(s.player.clubId).filter((r) => r.type === "rivalry");
  return rels.length ? getClub(rels[0]!.b) : null;
};
const friendOf = (s: GameState) => {
  const rels = relationsOf(s.player.clubId).filter((r) => r.type === "fanFriendship");
  return rels.length ? getClub(rels[0]!.b) : null;
};
const fanValue = (s: GameState) => s.fanRelations[s.player.clubId] ?? 50;

export const SCENE_EVENTS: EventDef[] = [
  {
    id: "derby-pressure",
    title: "Derbywoche",
    intro: (s) => {
      const rival = rivalOf(s);
      const rel = relationsOf(s.player.clubId).find((r) => r.type === "rivalry");
      return rival
        ? `${rel?.label ?? "Derby"}: In wenigen Tagen empfängt ihr ${rival.name}. Die Stadt spricht über nichts anderes.`
        : "Das Stadtduell steht an. Die Woche fühlt sich anders an als jede andere.";
    },
    weight: 13,
    when: (s) => Boolean(rivalOf(s)) && s.player.age >= 17,
    options: [
      {
        id: "lead",
        label: "Vorangehen und Verantwortung suchen",
        hint: "Du willst das Spiel an dich reißen",
        apply: (s, rng) =>
          outcome(rng, [
            [
              {
                consequence: "Du entscheidest das Derby – die Kurve singt deinen Namen noch Wochen später.",
                deltas: adjust(s, { form: 12, morale: 10, reputation: 8, fans: 16, mentality: 4 }),
              },
              38,
            ],
            [
              {
                consequence: "Ein solides Derby ohne großen Moment, aber ohne Fehler.",
                deltas: adjust(s, { form: 3, morale: 2, fans: 3 }),
              },
              37,
            ],
            [
              {
                consequence: "Dein Fehlpass leitet die Niederlage ein. Die Kritik ist laut.",
                deltas: adjust(s, { form: -12, morale: -10, fans: -12, mentality: -4 }),
              },
              25,
            ],
          ]),
      },
      {
        id: "team",
        label: "Ruhig im Kollektiv arbeiten",
        hint: "Weniger Risiko, weniger Rampenlicht",
        apply: (s, rng) =>
          outcome(rng, [
            [
              {
                consequence: "Du spielst unauffällig stark, die Mannschaft holt ein Unentschieden.",
                deltas: adjust(s, { form: 4, relationship: 5, fans: 3 }),
              },
              62,
            ],
            [
              {
                consequence: "Du bleibst blass – die Kurve hätte sich mehr Mut gewünscht.",
                deltas: adjust(s, { form: -4, fans: -4 }),
              },
              38,
            ],
          ]),
      },
    ],
  },
  {
    id: "derby-shirt",
    title: "Trikottausch nach dem Derby",
    intro: (s) => {
      const rival = rivalOf(s);
      return `Nach dem Abpfiff bittet ein Spieler von ${rival?.name ?? "dem Rivalen"} um dein Trikot. Die Kurve schaut zu.`;
    },
    weight: 8,
    when: (s) => Boolean(rivalOf(s)),
    options: [
      {
        id: "swap",
        label: "Trikot tauschen",
        hint: "Sportlicher Respekt – manche sehen es anders",
        apply: (s, rng) =>
          outcome(rng, [
            [
              { consequence: "Die meisten werten es als Größe. Ein paar Banner am Wochenende darauf nicht.", deltas: adjust(s, { reputation: 4, fans: -6 }) },
              60,
            ],
            [
              { consequence: "Das Bild geht um – als Symbol für Fairness im Derby.", deltas: adjust(s, { reputation: 9, fans: 2, mentality: 2 }) },
              40,
            ],
          ]),
      },
      {
        id: "keep",
        label: "Höflich ablehnen",
        hint: "Du gehst direkt zur Kurve",
        apply: (s) => ({
          consequence: "Du wirfst dein Trikot in den Block. Die Fans nehmen dir das ab.",
          deltas: adjust(s, { fans: 8, morale: 3 }),
        }),
      },
    ],
  },
  {
    id: "ex-club-goal",
    title: "Tor gegen den Ex-Verein",
    intro: (s) => `Du triffst gegen deinen früheren Verein. Der Moment ist eine Sekunde lang völlig still, dann entscheidest du dich.`,
    weight: 7,
    when: (s) => s.seasons.some((x) => x.clubId !== s.player.clubId),
    options: [
      {
        id: "celebrate",
        label: "Jubeln",
        hint: "Emotion pur – nicht überall beliebt",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Deine neue Kurve feiert dich dafür.", deltas: adjust(s, { fans: 12, morale: 6 }) }, 55],
            [{ consequence: "Die Diskussion darüber begleitet dich zwei Wochen.", deltas: adjust(s, { reputation: -5, morale: -4 }) }, 45],
          ]),
      },
      {
        id: "respect",
        label: "Respektvoll die Hände heben",
        hint: "Ruhig, ohne Provokation",
        apply: (s) => ({
          consequence: "Beide Kurven applaudieren. Der Moment bleibt im Gedächtnis.",
          deltas: adjust(s, { reputation: 6, mentality: 3, fans: 3 }),
        }),
      },
    ],
  },
  {
    id: "fan-protest",
    title: "Protest in der Kurve",
    intro: (s) => `Die Fans von ${getClub(s.player.clubId).name} protestieren gegen die Vereinsführung. Ein Sprecher bittet die Mannschaft um ein Zeichen.`,
    weight: 8,
    when: (s) => s.player.age >= 20,
    options: [
      {
        id: "dialog",
        label: "Das Gespräch mit der Kurve suchen",
        hint: "Zeit investieren, zuhören",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Das Gespräch beruhigt die Lage spürbar – du giltst als Bindeglied.", deltas: adjust(s, { fans: 14, reputation: 5, relationship: -3 }) }, 70],
            [{ consequence: "Die Vereinsführung sieht dich plötzlich als Unruhefaktor.", deltas: adjust(s, { fans: 8, relationship: -12 }) }, 30],
          ]),
      },
      {
        id: "neutral",
        label: "Sportlich neutral bleiben",
        hint: "Kein Risiko, aber auch kein Signal",
        apply: (s) => ({
          consequence: "Du hältst dich raus und konzentrierst dich auf das nächste Spiel.",
          deltas: adjust(s, { fans: -4, relationship: 4 }),
        }),
      },
    ],
  },
  {
    id: "fan-friendship",
    title: "Befreundete Kurven",
    intro: (s) => {
      const friend = friendOf(s);
      return `Fans von ${friend?.name ?? "einem befreundeten Verein"} sind zu Gast. Die beiden Kurven planen eine gemeinsame Aktion und fragen dich an.`;
    },
    weight: 5,
    when: (s) => Boolean(friendOf(s)),
    options: [
      {
        id: "join",
        label: "Teilnehmen",
        hint: "Ein Nachmittag mit beiden Fanszenen",
        apply: (s) => ({
          consequence: "Das Bild von dir mit beiden Fanschals geht durch die Szene.",
          deltas: adjust(s, { fans: 10, reputation: 5, morale: 4 }),
        }),
      },
      {
        id: "skip",
        label: "Absagen und regenerieren",
        hint: "Erholung vor dem englischen Spielplan",
        apply: (s) => ({
          consequence: "Du nutzt den freien Tag zur Regeneration.",
          deltas: adjust(s, { fitness: 6, fans: -3 }),
        }),
      },
    ],
  },
  {
    id: "away-whistles",
    title: "Auswärtspfiffe",
    intro: () => "Beim Auswärtsspiel wirst du bei jedem Ballkontakt ausgepfiffen. Es zieht sich über 90 Minuten.",
    weight: 8,
    when: (s) => s.player.reputation >= 35,
    options: [
      {
        id: "ignore",
        label: "Ausblenden und weiterspielen",
        hint: "Fokus auf die Aufgabe",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Du blendest alles aus und spielst deine Normalform.", deltas: adjust(s, { mentality: 6, form: 3 }) }, 68],
            [{ consequence: "Die Pfiffe kriechen doch in den Kopf – zwei schwache Wochen folgen.", deltas: adjust(s, { form: -8, mentality: -3 }) }, 32],
          ]),
      },
      {
        id: "provoke",
        label: "Zurückgeben und antworten",
        hint: "Große Wirkung in beide Richtungen",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Dein Tor und der Jubel vor dem Block machen dich zur Legende der eigenen Kurve.", deltas: adjust(s, { fans: 14, reputation: 8, form: 8 }) }, 40],
            [{ consequence: "Der Verband ermittelt, du wirst gesperrt.", deltas: adjust(s, { reputation: -10, morale: -8, form: -6 }) }, 60],
          ]),
      },
    ],
  },
  {
    id: "social-media",
    title: "Ein Post, viele Meinungen",
    intro: () => "Ein älterer Beitrag von dir wird ausgegraben und diskutiert. Dein Umfeld rät zu unterschiedlichen Wegen.",
    weight: 7,
    when: (s) => s.player.age >= 19,
    options: [
      {
        id: "explain",
        label: "Sachlich einordnen",
        hint: "Ruhig, ohne Eskalation",
        apply: (s) => ({
          consequence: "Deine sachliche Erklärung nimmt der Sache die Schärfe.",
          deltas: adjust(s, { reputation: 4, mentality: 3 }),
        }),
      },
      {
        id: "offline",
        label: "Accounts vorerst schließen",
        hint: "Ruhe im Kopf, weniger Reichweite",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Ohne den täglichen Lärm trainierst du deutlich klarer.", deltas: adjust(s, { mentality: 8, form: 6, reputation: -3 }) }, 72],
            [{ consequence: "Das Schweigen wird als Eingeständnis gelesen.", deltas: adjust(s, { reputation: -6, morale: -4 }) }, 28],
          ]),
      },
    ],
  },
  {
    id: "contract-dispute",
    title: "Vertragsstreit",
    intro: (s) => `${getClub(s.player.clubId).name} bietet weniger als besprochen. Dein Berater will hart verhandeln.`,
    weight: 9,
    when: (s) => s.player.contractYears <= 2 && s.player.age >= 20,
    options: [
      {
        id: "hard",
        label: "Hart verhandeln",
        hint: "Mehr Gehalt, mögliche Unruhe",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Du setzt dich durch – der Verein zahlt, die Kabine registriert es.", deltas: adjust(s, { morale: 8, relationship: -6, fans: -5 }) }, 45],
            [{ consequence: "Die Verhandlung zieht sich, du wirst zeitweise aus dem Kader genommen.", deltas: adjust(s, { playtime: -12, morale: -10, fans: -8 }) }, 30],
            [{ consequence: "Beide Seiten einigen sich fair und schnell.", deltas: adjust(s, { morale: 5, relationship: 5 }) }, 25],
          ]),
      },
      {
        id: "sign",
        label: "Angebot annehmen",
        hint: "Weniger Geld, klare Verhältnisse",
        apply: (s) => ({
          consequence: "Du unterschreibst ohne Theater. Verein und Kurve rechnen es dir an.",
          deltas: adjust(s, { relationship: 10, fans: 8, morale: 3 }),
        }),
      },
    ],
  },
  {
    id: "form-crisis",
    title: "Formkrise",
    intro: () => "Seit Wochen gelingt dir wenig. Jeder Ballverlust wirkt schwerer als er ist.",
    weight: 10,
    when: (s) => s.player.form < 45,
    options: [
      {
        id: "extra",
        label: "Zusatzschichten einlegen",
        hint: "Mehr Arbeit, mehr Belastung",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Die Extraeinheiten greifen, du findest über Wiederholung zurück.", deltas: adjust(s, { form: 14, mentality: 3, fitness: -4 }) }, 55],
            [{ consequence: "Der Körper macht bei dieser Belastung nicht mit.", deltas: adjust(s, { fitness: -10, injuryRisk: 8, form: -3 }) }, 45],
          ]),
      },
      {
        id: "reset",
        label: "Bewusst herunterfahren",
        hint: "Abstand statt Druck",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Zwei ruhige Wochen lösen den Knoten im Kopf.", deltas: adjust(s, { mentality: 8, form: 8, morale: 5 }) }, 65],
            [{ consequence: "Der Trainer liest es als fehlenden Ehrgeiz.", deltas: adjust(s, { relationship: -8, playtime: -6 }) }, 35],
          ]),
      },
    ],
  },
  {
    id: "mental-block",
    title: "Eine Blockade im Kopf",
    intro: () => "Vor dem Elfmeterpunkt zögerst du seit Monaten. Der Verein bietet professionelle Begleitung an.",
    weight: 7,
    when: (s) => s.player.mentality < 60,
    options: [
      {
        id: "support",
        label: "Begleitung annehmen",
        hint: "Ruhig und strukturiert daran arbeiten",
        apply: (s) => ({
          consequence:
            "Du arbeitest regelmäßig mit einer Sportpsychologin. Es braucht Zeit, aber die Sicherheit kommt zurück.",
          deltas: adjust(s, { mentality: 14, morale: 6, form: 3 }),
        }),
      },
      {
        id: "alone",
        label: "Allein damit umgehen",
        hint: "Du willst es selbst lösen",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Du findest einen eigenen Weg – es kostet Kraft, funktioniert aber.", deltas: adjust(s, { mentality: 5, form: 2 }) }, 40],
            [{ consequence: "Die Unsicherheit bleibt und zeigt sich in wichtigen Momenten.", deltas: adjust(s, { mentality: -8, form: -6 }) }, 60],
          ]),
      },
    ],
  },
  {
    id: "long-term-rehab",
    title: "Reha nach schwerer Verletzung",
    intro: (s) =>
      `Nach ${s.player.majorInjuries > 1 ? "der erneuten" : "der"} schweren Verletzung stehen dir mehrere Wege offen. Der Zeitplan ist offen, die Geduld ist die eigentliche Prüfung.`,
    weight: 12,
    when: (s) => s.player.majorInjuries > 0 && s.player.monthsOut >= 4,
    options: [
      {
        id: "conservative",
        label: "Konservativ und geduldig aufbauen",
        hint: "Längere Pause, ruhiger Verlauf",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Der Aufbau verläuft ohne Rückschlag. Du kehrst stabil zurück.", deltas: adjust(s, { fitness: 16, injuryProneness: -6, form: -6 }) }, 70],
            [{ consequence: "Der Aufbau dauert länger als geplant, bleibt aber ohne Komplikationen.", deltas: adjust(s, { fitness: 8, playtime: -8 }) }, 30],
          ]),
      },
      {
        id: "aggressive",
        label: "Beschleunigtes Programm",
        hint: "Schneller zurück – mit Risiko",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Du bist Monate früher zurück als erwartet.", deltas: adjust(s, { fitness: 12, form: 8, playtime: 10 }) }, 35],
            [{ consequence: "Der Aufbau hält, ist aber nicht schneller als der Standardweg.", deltas: adjust(s, { fitness: 6 }) }, 30],
            [{ consequence: "Ein Rückschlag wirft dich erneut monatelang zurück.", deltas: adjust(s, { fitness: -14, injuryProneness: 12, morale: -10 }) }, 35],
          ]),
      },
    ],
  },
  {
    id: "youth-competition",
    title: "Ein Talent drängt nach",
    intro: (s) => `Ein 18-Jähriger aus der Akademie von ${getClub(s.player.clubId).name} trainiert seit Wochen bei den Profis – auf deiner Position.`,
    weight: 8,
    when: (s) => s.player.age >= 26,
    options: [
      {
        id: "mentor",
        label: "Ihn fördern",
        hint: "Verantwortung statt Konkurrenzdenken",
        apply: (s) => ({
          consequence: "Du nimmst ihn mit – die Kabine und der Verein rechnen es dir hoch an.",
          deltas: adjust(s, { relationship: 12, fans: 6, mentality: 4, playtime: -4 }),
        }),
      },
      {
        id: "block",
        label: "Deinen Platz verteidigen",
        hint: "Volle Härte im internen Duell",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Du zeigst im Training, warum du seit Jahren spielst.", deltas: adjust(s, { form: 10, playtime: 8, relationship: -4 }) }, 52],
            [{ consequence: "Der Junge zieht vorbei – die Kabine merkt es zuerst.", deltas: adjust(s, { playtime: -12, morale: -10, mentality: -4 }) }, 48],
          ]),
      },
    ],
  },
  {
    id: "fan-favourite",
    title: "Die Kurve hat dich gewählt",
    intro: (s) => `Die Fans wählen dich zum Spieler der Saison. ${fanValue(s) >= 70 ? "Dein Standing ist enorm." : "Ein Vertrauensvorschuss."}`,
    weight: 6,
    when: (s) => fanValue(s) >= 60,
    options: [
      {
        id: "speech",
        label: "Rede in der Kurve halten",
        hint: "Nähe zeigen",
        apply: (s) => ({
          consequence: "Deine Worte bleiben – du bist endgültig einer von ihnen.",
          deltas: adjust(s, { fans: 12, morale: 8, mentality: 3 }),
        }),
      },
      {
        id: "quiet",
        label: "Sich still bedanken",
        hint: "Kurz, ohne große Bühne",
        apply: (s) => ({
          consequence: "Ein kurzer Gruß, ein Applaus – mehr braucht es nicht.",
          deltas: adjust(s, { fans: 5, form: 4 }),
        }),
      },
    ],
  },
];
