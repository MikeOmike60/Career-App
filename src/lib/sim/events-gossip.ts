/**
 * Klatsch & Tratsch: Boulevard, Social Media, Gerüchte, Kabinen-Leaks.
 * Jede Geschichte hat einen mutigen Weg (Option 0, wird zum Gamble) und einen
 * sicheren Weg (Option 1). Charakterzüge steuern, wie oft eine Geschichte kommt.
 */
import type { EventDef } from "./events-core";
import { adjust, outcome } from "./events-core";
import { getClub, countryName } from "./data";
import { relationsOf } from "./club-relations";
import type { GameState } from "./types";

const club = (s: GameState) => getClub(s.player.clubId);
const rivalOf = (s: GameState) => {
  const rels = relationsOf(s.player.clubId).filter((r) => r.type === "rivalry");
  return rels.length ? getClub(rels[0]!.b) : null;
};
const lastName = (s: GameState) => s.profile.name.split(" ").slice(-1)[0] ?? s.profile.name;
const nationOf = (s: GameState) => s.national.committed ?? s.profile.nat1;
const betrayedHere = (s: GameState) => {
  const here = club(s);
  const ids = [...new Set((s.betrayals ?? []).flatMap((b) => b.betrayedClubIds))];
  return ids.map(getClub).find((c) => c.country === here.country && c.id !== here.id) ?? null;
};

export const GOSSIP_EVENTS: EventDef[] = [
  {
    id: "rumor-rival",
    title: "Schlagzeile: Wechsel zum Erzrivalen?",
    intro: (s) =>
      `„${lastName(s).toUpperCase()} VOR WECHSEL ZU ${rivalOf(s)!.name.toUpperCase()}!“ – die Zeitung will es aus „Vereinskreisen“ wissen. Vor dem Trainingsgelände stehen 200 aufgebrachte Fans.`,
    weight: 10,
    when: (s) => Boolean(rivalOf(s)) && s.seasons.length >= 2,
    traits: { loyal: 1.5, greedy: 1.4, showman: 1.2 },
    options: [
      {
        id: "kiss-badge",
        label: "Vor der Kurve das Wappen küssen",
        hint: "Großes Bekenntnis – wirkt nur, wenn du es auch lebst",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Die Kurve tobt vor Freude. Das Gerücht ist tot, dein Name steht auf neuen Bannern.", deltas: adjust(s, { fans: 18, morale: 8, relationship: 6 }) }, 60],
            [{ consequence: "Ein Fan filmt, wie du am selben Abend mit dem Sportdirektor des Rivalen essen gehst. Zufall – glaubt dir keiner.", deltas: adjust(s, { fans: -16, morale: -8, reputation: -4 }) }, 40],
          ]),
      },
      {
        id: "berater",
        label: "Schweigen – soll dein Berater das klären",
        hint: "Kein Öl ins Feuer, aber auch kein Dementi",
        apply: (s) => ({ consequence: "Das Gerücht verläuft im Sand. Ein paar Fans bleiben misstrauisch.", deltas: adjust(s, { fans: -4 }) }),
      },
    ],
  },
  {
    id: "boulevard-romance",
    title: "Neue Liebe auf Seite 1",
    intro: (s) =>
      `Paparazzi-Fotos zeigen dich händchenhaltend mit einer bekannten Schauspielerin aus einer Netflix-Serie. Die Kommentarspalten explodieren, ${club(s).name}-Fans fragen: „Hat der noch Zeit für Fußball?“`,
    weight: 8,
    when: (s) => s.player.age >= 19,
    traits: { showman: 2.4, humble: 0.4 },
    options: [
      {
        id: "official",
        label: "Offiziell machen – Pärchenfoto posten",
        hint: "Reichweite, aber auch Druck",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Traumpaar der Liga: Werbeanfragen, Titelseiten, und du spielst befreit auf.", deltas: adjust(s, { reputation: 8, morale: 10, form: 4 }) }, 55],
            [{ consequence: "Nach zwei schwachen Spielen heißt es nur noch „Liebes-Krise auf dem Platz“. Die Kurve singt hämische Lieder.", deltas: adjust(s, { form: -8, fans: -8, mentality: -4 }) }, 45],
          ]),
      },
      {
        id: "private",
        label: "Privat bleibt privat",
        hint: "Kein Kommentar, kein Foto",
        apply: (s) => ({ consequence: "Die Story verschwindet nach einer Woche aus den Schlagzeilen.", deltas: adjust(s, { morale: 2, mentality: 2 }) }),
      },
    ],
  },
  {
    id: "paparazzi-holiday",
    title: "Urlaubsfotos aus Mykonos",
    intro: () =>
      "Eine Woche vor Trainingsstart: Fotos von dir auf einer Yacht, Cocktail in der Hand, Bauch nicht ganz im Wettkampfmodus. Der Trainer schickt nur ein Emoji: 🙄.",
    weight: 8,
    when: (s) => s.player.age >= 20,
    traits: { showman: 2, professional: 0.4 },
    options: [
      {
        id: "meme",
        label: "Mit einem Meme kontern",
        hint: "Humor kann retten – oder alles schlimmer machen",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Dein Selbstironie-Post geht viral. Selbst der Trainer muss lachen – und du kommst topfit in die Vorbereitung.", deltas: adjust(s, { reputation: 6, morale: 6, relationship: 4 }) }, 50],
            [{ consequence: "Der Trainer findet es nicht lustig. Extraschichten, Bank im ersten Testspiel.", deltas: adjust(s, { relationship: -10, playtime: -6, fitness: -4 }) }, 50],
          ]),
      },
      {
        id: "work",
        label: "Früher ins Training einsteigen",
        hint: "Taten statt Worte",
        apply: (s) => ({ consequence: "Du stehst als Erster auf dem Platz. Das Thema ist vom Tisch.", deltas: adjust(s, { fitness: 6, relationship: 4, morale: -2 }) }),
      },
    ],
  },
  {
    id: "ex-teammate-podcast",
    title: "Ein Ex-Mitspieler packt aus",
    intro: (s) => {
      const prev = s.seasons.map((x) => x.clubId).find((id) => id !== s.player.clubId);
      const from = prev ? getClub(prev).name : club(s).name;
      return `Ein früherer Teamkollege von ${from} erzählt im Kult-Podcast „Kabinengeflüster“, du seist „der faulste Trainingsspieler, den ich je gesehen habe“. 400.000 Abrufe in zwei Tagen.`;
    },
    weight: 8,
    when: (s) => s.seasons.length >= 3,
    traits: { hothead: 1.8, showman: 1.4, humble: 0.6 },
    options: [
      {
        id: "clapback",
        label: "Öffentlich zurückschießen",
        hint: "Wer zuletzt postet, gewinnt?",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Dein Konter ist so gut, dass der Podcast sich entschuldigt. Das Netz feiert dich.", deltas: adjust(s, { reputation: 6, morale: 8 }) }, 45],
            [{ consequence: "Der Streit eskaliert über Tage. Am Ende wirkst du dünnhäutig – und er hat noch mehr Abrufe.", deltas: adjust(s, { reputation: -6, mentality: -6, form: -4 }) }, 55],
          ]),
      },
      {
        id: "call",
        label: "Ihn persönlich anrufen",
        hint: "Unter vier Augen klären",
        apply: (s) => ({ consequence: "Ihr redet eine Stunde. Er stellt in der nächsten Folge klar: „War übertrieben.“", deltas: adjust(s, { mentality: 4, reputation: 2 }) }),
      },
    ],
  },
  {
    id: "dressing-room-leak",
    title: "Der Maulwurf in der Kabine",
    intro: (s) =>
      `Taktik, Streit, sogar die Aufstellung – alles steht vor dem Spiel in der Zeitung. Bei ${club(s).name} verdächtigt man ausgerechnet dich, weil du mit einem Journalisten befreundet bist.`,
    weight: 7,
    when: (s) => s.seasons.length >= 2,
    traits: { showman: 1.5, leader: 1.3 },
    options: [
      {
        id: "detective",
        label: "Den echten Maulwurf entlarven",
        hint: "Riskant: Wenn du falsch liegst, hast du einen Feind mehr",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Du findest heraus, dass es der Zeugwart war. Die Kabine vertraut dir mehr denn je.", deltas: adjust(s, { relationship: 12, morale: 8, reputation: 4 }) }, 50],
            [{ consequence: "Du beschuldigst den Falschen. Die Stimmung ist im Keller, der Trainer setzt dich auf die Bank.", deltas: adjust(s, { relationship: -12, playtime: -8, morale: -6 }) }, 50],
          ]),
      },
      {
        id: "calm",
        label: "Ruhe bewahren, Vertrauen zurückgewinnen",
        hint: "Abwarten und liefern",
        apply: (s) => ({ consequence: "Nach drei Wochen ist das Thema vergessen. Ein bisschen Misstrauen bleibt.", deltas: adjust(s, { relationship: -3, mentality: 2 }) }),
      },
    ],
  },
  {
    id: "fast-food-deal",
    title: "Der Burger-Deal",
    intro: () =>
      "Eine Fastfood-Kette bietet dir sieben Stellen für einen Werbespot – inklusive eigenem Burger mit deinem Namen. Der Ernährungsberater des Vereins wird blass.",
    weight: 7,
    when: (s) => s.player.reputation >= 35,
    traits: { greedy: 2.2, showman: 1.5, professional: 0.5 },
    options: [
      {
        id: "sign",
        label: "Unterschreiben – her mit dem Burger",
        hint: "Geld und Kult – oder Spott",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Der Burger wird Kult, Kinder kommen mit Pommes-Plakaten ins Stadion. Du bist eine Marke.", deltas: adjust(s, { reputation: 8, morale: 6, fans: 4 }) }, 55],
            [{ consequence: "Nach einem verlorenen Laufduell ist der Hashtag #BurgerBeine weltweit im Trend.", deltas: adjust(s, { reputation: -6, fans: -6, mentality: -4 }) }, 45],
          ]),
      },
      {
        id: "decline",
        label: "Höflich ablehnen",
        hint: "Image vor Geld",
        apply: (s) => ({ consequence: "Der Verein lobt deine Professionalität in der Pressekonferenz.", deltas: adjust(s, { relationship: 5, fitness: 2 }) }),
      },
    ],
  },
  {
    id: "tattoo-blunder",
    title: "Tattoo-Panne",
    intro: () =>
      "Dein neues Unterarm-Tattoo sollte „Niemals aufgeben“ heißen. Dort steht „Niemlas aufgeben“. Ein Fotograf hat es gesehen.",
    weight: 6,
    when: (s) => s.player.age >= 18,
    traits: { showman: 1.6, hothead: 1.2 },
    options: [
      {
        id: "embrace",
        label: "Zur Marke machen: Trikots mit „Niemlas“",
        hint: "Selbstironie als Marketing",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "„Niemlas“ wird zum Fan-Gesang. Der Fanshop verkauft 20.000 Shirts.", deltas: adjust(s, { fans: 14, reputation: 6, morale: 6 }) }, 60],
            [{ consequence: "Die Gegner-Fans haben jetzt ein Lieblingslied über dich. Es reimt sich auf „Niemlas“.", deltas: adjust(s, { morale: -6, mentality: -4 }) }, 40],
          ]),
      },
      {
        id: "laser",
        label: "Weglasern lassen und schweigen",
        hint: "Kurz peinlich, dann vorbei",
        apply: (s) => ({ consequence: "Zwei Wochen Verband am Arm, dann redet niemand mehr darüber.", deltas: adjust(s, { morale: -2 }) }),
      },
    ],
  },
  {
    id: "documentary",
    title: "Kameras in der Kabine",
    intro: (s) =>
      `Ein Streamingdienst will eine Doku-Serie über die Saison von ${club(s).name} drehen – mit dir als Hauptfigur. Mikrofone im Bus, Kameras beim Physio.`,
    weight: 6,
    when: (s) => s.player.reputation >= 40,
    traits: { showman: 2.2, humble: 0.4, leader: 1.2 },
    options: [
      {
        id: "star",
        label: "Die Hauptrolle übernehmen",
        hint: "Weltruhm – oder Bloßstellung",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Die Serie wird ein weltweiter Hit. Deine Kabinenansprache aus Folge 4 läuft in jeder Sportsendung.", deltas: adjust(s, { reputation: 12, morale: 8, fans: 8 }) }, 50],
            [{ consequence: "Folge 6 zeigt deinen Wutanfall in der Halbzeitpause in voller Länge. Der Trainer schaut die Folge zweimal.", deltas: adjust(s, { relationship: -12, reputation: -4, mentality: -6 }) }, 50],
          ]),
      },
      {
        id: "decline",
        label: "Absagen – Fokus auf Fußball",
        hint: "Weniger Ruhm, mehr Ruhe",
        apply: (s) => ({ consequence: "Die Doku läuft ohne dich. Du bekommst drei Sekunden Bildschirmzeit beim Aufwärmen.", deltas: adjust(s, { mentality: 4, form: 2 }) }),
      },
    ],
  },
  {
    id: "videogame-rating",
    title: "Das Videospiel-Rating",
    intro: (s) =>
      `Das neue Fußball-Videospiel ist draußen – und gibt dir eine ${Math.max(45, s.player.ovr - 5)}. Dein jüngerer Cousin schickt dir einen Screenshot mit 14 Lach-Emojis.`,
    weight: 6,
    when: (s) => s.player.ovr >= 65,
    traits: { showman: 1.6, hothead: 1.4, ambitious: 1.3 },
    options: [
      {
        id: "complain",
        label: "Den Entwickler öffentlich markieren",
        hint: "„Habt ihr mich überhaupt mal spielen sehen?“",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Der Entwickler reagiert mit Humor und verspricht ein Upgrade. Du bekommst eine Spezialkarte – das Netz liebt es.", deltas: adjust(s, { reputation: 6, morale: 8 }) }, 50],
            [{ consequence: "Die Community gräbt deine schlechtesten Szenen aus. Das Rating wird zum Running Gag.", deltas: adjust(s, { reputation: -4, mentality: -6 }) }, 50],
          ]),
      },
      {
        id: "motivation",
        label: "Als Motivation an den Spind kleben",
        hint: "Antwort auf dem Platz",
        apply: (s) => ({ consequence: "Der Screenshot hängt jetzt neben deinem Trikot. Jeden Morgen.", deltas: adjust(s, { form: 4, mentality: 4 }) }),
      },
    ],
  },
  {
    id: "referee-rant",
    title: "Nach dem Abpfiff: Wut im Bauch",
    intro: () =>
      "Elfmeter verweigert, Abseitstor gegeben, Spiel verloren. Das Sky-Mikro steht direkt vor dir, die Halsschlagader pocht.",
    weight: 7,
    when: () => true,
    traits: { hothead: 2.6, humble: 0.4, professional: 0.6 },
    options: [
      {
        id: "rant",
        label: "Klartext reden",
        hint: "Wahr, aber womöglich teuer",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Dein Interview wird zum Kult-Clip. Die Fans feiern dich als einen, der sagt, was alle denken.", deltas: adjust(s, { fans: 12, reputation: 4, morale: 6 }) }, 45],
            [{ consequence: "Drei Spiele Sperre und 40.000 € Strafe. Der Verein ist not amused.", deltas: adjust(s, { playtime: -10, relationship: -8, form: -6 }) }, 55],
          ]),
      },
      {
        id: "breathe",
        label: "Durchatmen – „Wir schauen nach vorne“",
        hint: "Langweilig, aber sicher",
        apply: (s) => ({ consequence: "Ein Satz, ein Nicken, Kabine. Niemand erinnert sich an das Interview.", deltas: adjust(s, { mentality: 3 }) }),
      },
    ],
  },
  {
    id: "fan-wedding",
    title: "Die Hochzeitseinladung",
    intro: (s) =>
      `Ein Fan von ${club(s).name} hat dich per Video zu seiner Hochzeit eingeladen. Das Video hat 3 Millionen Aufrufe. Die Hochzeit ist am Tag nach dem Auswärtsspiel.`,
    weight: 6,
    when: (s) => (s.fanRelations[s.player.clubId] ?? 50) >= 45,
    traits: { humble: 1.6, loyal: 1.5, leader: 1.2 },
    options: [
      {
        id: "go",
        label: "Überraschend auftauchen",
        hint: "Nach dem Auswärtsspiel die Nacht durchfahren",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Du stehst mit Trikot auf der Tanzfläche. Das Video geht um die Welt – du bist für immer einer von ihnen.", deltas: adjust(s, { fans: 18, reputation: 6, morale: 8 }) }, 70],
            [{ consequence: "Die Nacht im Auto rächt sich: müde Beine, schwaches Training, Bank am Wochenende.", deltas: adjust(s, { fitness: -8, playtime: -4, fans: 6 }) }, 30],
          ]),
      },
      {
        id: "shirt",
        label: "Signiertes Trikot und Videogruß schicken",
        hint: "Herzlich, aber ohne Risiko",
        apply: (s) => ({ consequence: "Das Brautpaar zeigt dein Video auf der Leinwand. Riesiger Jubel.", deltas: adjust(s, { fans: 6, morale: 3 }) }),
      },
    ],
  },
  {
    id: "nightclub-video",
    title: "Das Video aus dem Club",
    intro: () =>
      "Freitagnacht, zwei Uhr, Tanzfläche – und Samstag ist Spieltag. Jemand hat gefilmt. Montag liegt das Video auf dem Tisch des Sportdirektors.",
    weight: 7,
    when: (s) => s.player.age >= 19,
    traits: { showman: 2.6, professional: 0.3, humble: 0.5 },
    options: [
      {
        id: "deny",
        label: "„Das war ein altes Video!“",
        hint: "Wenn es durchgeht, ist alles gut",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Du triffst am Samstag doppelt. Niemand fragt mehr nach dem Video.", deltas: adjust(s, { form: 6, morale: 6 }) }, 45],
            [{ consequence: "Das Video hat einen Zeitstempel. Suspendierung für ein Spiel, die Kabine ist sauer.", deltas: adjust(s, { relationship: -14, playtime: -8, reputation: -6 }) }, 55],
          ]),
      },
      {
        id: "sorry",
        label: "Bei Mannschaft und Trainer entschuldigen",
        hint: "Fehler zugeben",
        apply: (s) => ({ consequence: "Geldstrafe in die Mannschaftskasse, ein langes Gespräch – dann ist es erledigt.", deltas: adjust(s, { relationship: 3, morale: -3 }) }),
      },
    ],
  },
  {
    id: "agent-war",
    title: "Berater-Krieg",
    intro: () =>
      "Zwei Spielerberater streiten öffentlich darum, wer dich vertreten darf. Ein Boulevardblatt druckt ihre WhatsApp-Nachrichten – inklusive Spitznamen für dich.",
    weight: 6,
    when: (s) => s.player.ovr >= 66,
    traits: { greedy: 1.8, ambitious: 1.3 },
    options: [
      {
        id: "superagent",
        label: "Den Superberater mit Top-Kontakten wählen",
        hint: "Große Bühne, große Provision",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Er öffnet Türen, von denen du nicht wusstest. Europas Topklubs kennen jetzt deinen Namen.", deltas: adjust(s, { reputation: 10, morale: 6 }) }, 55],
            [{ consequence: "Er drängt dich in Interviews, die du nicht geben willst. Der Verein ist genervt.", deltas: adjust(s, { relationship: -10, mentality: -6, fans: -4 }) }, 45],
          ]),
      },
      {
        id: "family",
        label: "Die Familie übernimmt",
        hint: "Weniger Kontakte, mehr Vertrauen",
        apply: (s) => ({ consequence: "Dein Bruder macht jetzt die Verträge. Nicht glamourös, aber ehrlich.", deltas: adjust(s, { mentality: 6, morale: 3 }) }),
      },
    ],
  },
  {
    id: "national-snub",
    title: "Vom Nationaltrainer übergangen",
    intro: (s) =>
      `Der Kader von ${countryName(nationOf(s))} ist raus – ohne dich. Auf der Pressekonferenz fällt der Satz: „Ihm fehlt die Konstanz.“`,
    weight: 6,
    when: (s) => s.player.ovr >= 70,
    traits: { hothead: 1.8, ambitious: 1.5 },
    options: [
      {
        id: "answer",
        label: "Öffentlich antworten",
        hint: "Ein Satz, der hängen bleibt",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Dein Konter „Konstanz zeige ich jedes Wochenende“ wird zum Slogan. Die Fans fordern deine Nominierung.", deltas: adjust(s, { reputation: 8, morale: 6 }) }, 45],
            [{ consequence: "Der Nationaltrainer ist nachtragend. Die Tür bleibt vorerst zu.", deltas: adjust(s, { reputation: -4, mentality: -6, morale: -6 }) }, 55],
          ]),
      },
      {
        id: "pitch",
        label: "Auf dem Platz antworten",
        hint: "Kein Wort, nur Leistung",
        apply: (s) => ({ consequence: "Du sagst nichts – und machst im nächsten Spiel dein bestes Saisonspiel.", deltas: adjust(s, { form: 6, mentality: 3 }) }),
      },
    ],
  },
  {
    id: "stadium-return",
    title: "Rückkehr ins Stadion des Verrats",
    intro: (s) =>
      `Zum ersten Mal seit deinem Wechsel spielst du wieder bei ${betrayedHere(s)!.name}. Im Gästeblock hängt ein Banner: „VERRÄTER“. Die Polizei hat die Einheiten verdoppelt.`,
    weight: 14,
    when: (s) => Boolean(betrayedHere(s)),
    options: [
      {
        id: "celebrate",
        label: "Wenn du triffst: provokant jubeln",
        hint: "Öl ins Feuer – oder Kultstatus bei den Neuen",
        apply: (s, rng) => {
          const victim = betrayedHere(s)!;
          s.fanRelations[victim.id] = Math.max(0, (s.fanRelations[victim.id] ?? 30) - 15);
          return outcome(rng, [
            [{ consequence: `Du triffst – und legst den Finger an die Lippen. Die neuen Fans lieben dich, bei ${victim.name} bist du jetzt endgültig Staatsfeind Nummer eins.`, deltas: adjust(s, { fans: 16, morale: 10, reputation: 4 }) }, 50],
            [{ consequence: "Du triffst nicht, wirst 90 Minuten ausgepfiffen und von Feuerzeugen getroffen. Ein Abend zum Vergessen.", deltas: adjust(s, { morale: -10, mentality: -8, form: -6 }) }, 50],
          ]);
        },
      },
      {
        id: "respect",
        label: "Nicht jubeln – Respekt zeigen",
        hint: "Eine Geste, die vielleicht Brücken baut",
        apply: (s) => {
          const victim = betrayedHere(s)!;
          s.fanRelations[victim.id] = Math.min(100, (s.fanRelations[victim.id] ?? 20) + 8);
          return { consequence: `Du triffst und hebst entschuldigend die Hände. Ein paar Pfiffe bei ${victim.name} werden leiser.`, deltas: adjust(s, { mentality: 3, morale: -2 }) };
        },
      },
    ],
  },
  {
    id: "heart-club-tv",
    title: "„Er kommt eines Tages zurück“",
    intro: (s) =>
      `Der Präsident deines Herzensvereins ${getClub(s.heartClub!).name} sagt im Fernsehen: „Er kommt eines Tages zurück. Das weiß er auch.“ Bei ${club(s).name} hört man das gar nicht gern.`,
    weight: 7,
    when: (s) => Boolean(s.heartClub) && s.heartClub !== s.player.clubId && s.seasons.length >= 3,
    traits: { loyal: 2.2 },
    options: [
      {
        id: "hint",
        label: "Rückkehr öffentlich andeuten",
        hint: "Ehrlich zum Herzen – riskant beim Arbeitgeber",
        apply: (s, rng) => {
          s.fanRelations[s.heartClub!] = Math.min(100, (s.fanRelations[s.heartClub!] ?? 55) + 12);
          return outcome(rng, [
            [{ consequence: "Beide Fanlager respektieren deine Ehrlichkeit. Die Heimat freut sich schon.", deltas: adjust(s, { morale: 8, mentality: 4 }) }, 50],
            [{ consequence: "Dein aktueller Verein fühlt sich hintergangen. Kapitänsbinde weg, Stimmung kühl.", deltas: adjust(s, { relationship: -12, fans: -10 }) }, 50],
          ]);
        },
      },
      {
        id: "diplomatic",
        label: "Diplomatisch bleiben",
        hint: "„Ich konzentriere mich auf meinen Verein.“",
        apply: (s) => ({ consequence: "Die Standardantwort. Alle wissen, was du denkst – keiner kann es dir vorwerfen.", deltas: adjust(s, { relationship: 3 }) }),
      },
    ],
  },
  {
    id: "luxury-car",
    title: "Der Lamborghini vor dem Trainingsgelände",
    intro: () =>
      "Drei Niederlagen in Folge – und du fährst im neuen, giftgrünen Lamborghini zum Training. Die Fans warten schon am Tor.",
    weight: 6,
    when: (s) => s.player.wage >= 20_000,
    traits: { greedy: 1.8, showman: 1.8, humble: 0.3 },
    options: [
      {
        id: "lambo",
        label: "Weiter mit dem Lambo vorfahren",
        hint: "Du lässt dir nichts vorschreiben",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Ihr gewinnt die nächsten vier Spiele. Plötzlich ist der grüne Wagen ein Glücksbringer.", deltas: adjust(s, { morale: 8, fans: 6 }) }, 40],
            [{ consequence: "Der Wagen wird mit Rasierschaum besprüht. Ein Foto davon ist auf jeder Titelseite.", deltas: adjust(s, { fans: -14, reputation: -4, mentality: -4 }) }, 60],
          ]),
      },
      {
        id: "bike",
        label: "Ab jetzt mit dem Fahrrad",
        hint: "Demut zeigen",
        apply: (s) => ({ consequence: "Ein Fan filmt dich auf dem Rad. Die Stimmung dreht sich.", deltas: adjust(s, { fans: 8, fitness: 2 }) }),
      },
    ],
  },
  {
    id: "teammate-feud",
    title: "Zoff mit dem Star",
    intro: (s) =>
      `Im Abschlusstraining von ${club(s).name} geratet ihr aneinander: du und der teuerste Spieler des Kaders. Ein Handyvideo zeigt das Gerangel.`,
    weight: 7,
    when: (s) => s.seasons.length >= 1,
    traits: { hothead: 2.2, leader: 1.3, humble: 0.5 },
    options: [
      {
        id: "stand",
        label: "Nicht zurückweichen",
        hint: "Wer gewinnt den Machtkampf?",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Der Trainer stellt sich auf deine Seite. Du bist jetzt die Stimme in der Kabine.", deltas: adjust(s, { relationship: 8, morale: 8, playtime: 6 }) }, 45],
            [{ consequence: "Der Star hat den längeren Atem und die besseren Kontakte. Du sitzt zwei Spiele draußen.", deltas: adjust(s, { relationship: -10, playtime: -10, morale: -8 }) }, 55],
          ]),
      },
      {
        id: "talk",
        label: "Aussprache unter vier Augen",
        hint: "Abkühlen und reden",
        apply: (s) => ({ consequence: "Ihr klärt das beim Essen. Kein Freund, aber ein Kollege.", deltas: adjust(s, { relationship: 4, mentality: 2 }) }),
      },
    ],
  },
  {
    id: "salary-leak",
    title: "Die Gehaltsliste ist raus",
    intro: (s) =>
      `Ein Hackerangriff, eine Excel-Tabelle, ganz ${countryName(club(s).country)} liest mit: Du verdienst weniger als der Ersatztorwart.`,
    weight: 6,
    when: (s) => s.player.ovr >= 64 && !s.player.loan,
    traits: { greedy: 2, ambitious: 1.4, loyal: 0.7 },
    options: [
      {
        id: "renegotiate",
        label: "Sofort nachverhandeln",
        hint: "Der Moment ist günstig – oder nicht",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Der Verein lenkt ein. Neuer Vertrag, neues Selbstbewusstsein.", deltas: adjust(s, { morale: 10, relationship: 4 }) }, 50],
            [{ consequence: "Der Sportdirektor lässt durchsickern, du seist „gierig“. Die Fans sind gespalten.", deltas: adjust(s, { fans: -10, relationship: -8 }) }, 50],
          ]),
      },
      {
        id: "shrug",
        label: "„Geld ist nicht alles.“",
        hint: "Gelassen bleiben",
        apply: (s) => ({ consequence: "Die Fans lieben die Antwort. Ein Plakat: „Unbezahlbar“.", deltas: adjust(s, { fans: 8, morale: -2 }) }),
      },
    ],
  },
  {
    id: "fake-news-exotic",
    title: "Fake News: Wechsel nach Übersee?",
    intro: () =>
      "Ein Portal meldet: „Unterschrift in Saudi-Arabien perfekt – 80 Millionen netto!“ Du hast davon aus dem Internet erfahren. Deine Oma ruft an und fragt, ob du jetzt wegziehst.",
    weight: 6,
    when: (s) => s.player.ovr >= 72,
    traits: { greedy: 1.6, showman: 1.3 },
    options: [
      {
        id: "sue",
        label: "Mit Anwalt und Gegendarstellung reagieren",
        hint: "Hart durchgreifen",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Das Portal muss widerrufen. Deine Klarstellung wird mehr gelesen als die Falschmeldung.", deltas: adjust(s, { reputation: 6, fans: 6 }) }, 55],
            [{ consequence: "Der Streit zieht sich über Monate und lenkt dich spürbar ab.", deltas: adjust(s, { mentality: -8, form: -4 }) }, 45],
          ]),
      },
      {
        id: "ignore",
        label: "Ignorieren – und Oma anrufen",
        hint: "Falschmeldungen sterben von allein",
        apply: (s) => ({ consequence: "Nach einer Woche glaubt es keiner mehr. Oma ist beruhigt.", deltas: adjust(s, { mentality: 3 }) }),
      },
    ],
  },
  {
    id: "gala-outfit",
    title: "Die Gala und das Outfit",
    intro: () =>
      "Du bist für den Preis „Talent des Jahres“ nominiert. Dein Stylist schlägt einen pinken Samtanzug mit Federkragen vor.",
    weight: 6,
    when: (s) => s.player.age <= 23 && s.player.ovr >= 66,
    traits: { showman: 2.2, humble: 0.5 },
    options: [
      {
        id: "velvet",
        label: "Pinker Samt – volles Risiko",
        hint: "Ikone oder Lachnummer",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Du bist der Star des Abends. Modemagazine wollen Interviews, Marken stehen Schlange.", deltas: adjust(s, { reputation: 10, morale: 8 }) }, 50],
            [{ consequence: "Die Memes über den „Flamingo“ verfolgen dich die ganze Saison.", deltas: adjust(s, { reputation: -4, mentality: -6 }) }, 50],
          ]),
      },
      {
        id: "classic",
        label: "Klassischer schwarzer Anzug",
        hint: "Seriös und zeitlos",
        apply: (s) => ({ consequence: "Elegant, unauffällig – das Foto bekommt deine Oma eingerahmt.", deltas: adjust(s, { reputation: 2, morale: 2 }) }),
      },
    ],
  },
  {
    id: "hairstyle",
    title: "Die Frisur der Saison",
    intro: () =>
      "Neue Saison, neue Frisur: platinblond mit eingrasiertem Blitz. Das erste Foto vom Trainingsauftakt hat 2 Millionen Likes – und 40.000 Kommentare.",
    weight: 5,
    when: (s) => s.player.age <= 30,
    traits: { showman: 2, humble: 0.4 },
    options: [
      {
        id: "keep",
        label: "Durchziehen – das ist jetzt dein Look",
        hint: "Kultstatus oder Spott",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Die Kinder in der Jugend des Vereins tragen jetzt alle den Blitz. Du bist eine Stilikone.", deltas: adjust(s, { reputation: 6, fans: 6, morale: 6 }) }, 55],
            [{ consequence: "Der Stadionsprecher nennt dich versehentlich „Pikachu“. Es bleibt hängen.", deltas: adjust(s, { morale: -6, mentality: -4 }) }, 45],
          ]),
      },
      {
        id: "cut",
        label: "Nach einer Woche wieder abrasieren",
        hint: "Zurück zur Normalität",
        apply: (s) => ({ consequence: "Ein kurzes Internet-Phänomen, dann ist alles wie vorher.", deltas: adjust(s, { morale: 1 }) }),
      },
    ],
  },
  {
    id: "charity",
    title: "Benefizspiel in der Heimat",
    intro: (s) =>
      `Dein alter Jugendtrainer organisiert ein Benefizspiel für den Sportplatz, auf dem du angefangen hast. Er fragt, ob du kommst – am einzigen freien Tag der Saison.`,
    weight: 6,
    when: (s) => s.seasons.length >= 2,
    traits: { humble: 1.8, loyal: 1.6, leader: 1.3, greedy: 0.6 },
    options: [
      {
        id: "big",
        label: "Hingehen und eine Spendenaktion starten",
        hint: "Großes Herz, aber kein freier Tag",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Der Sportplatz bekommt Flutlicht und Kunstrasen. Ein Schild trägt jetzt deinen Namen.", deltas: adjust(s, { reputation: 8, morale: 10, mentality: 6 }) }, 70],
            [{ consequence: "Wunderbarer Tag – aber die fehlende Pause rächt sich mit müden Beinen.", deltas: adjust(s, { fitness: -6, morale: 6 }) }, 30],
          ]),
      },
      {
        id: "donate",
        label: "Still spenden, Videogruß schicken",
        hint: "Helfen ohne Rampenlicht",
        apply: (s) => ({ consequence: "Der Jugendtrainer liest deinen Gruß vor. Der Platz wird renoviert.", deltas: adjust(s, { mentality: 4, morale: 3 }) }),
      },
    ],
  },
  {
    id: "rival-shirt-photo",
    title: "Das Foto mit dem falschen Trikot",
    intro: (s) =>
      `Ein altes Kinderfoto taucht auf: Du, acht Jahre alt, im Trikot von ${rivalOf(s)!.name}. Die Ultras von ${club(s).name} fordern eine Erklärung.`,
    weight: 6,
    when: (s) => Boolean(rivalOf(s)) && s.seasons.length >= 1,
    traits: { loyal: 1.4, hothead: 1.3 },
    options: [
      {
        id: "joke",
        label: "Mit Humor: „Damals hatte ich noch keinen Geschmack“",
        hint: "Kann die Kurve gewinnen – oder verärgern",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Die Kurve lacht mit. Beim nächsten Heimspiel hängt ein Banner: „Gerettet!“", deltas: adjust(s, { fans: 12, morale: 6 }) }, 55],
            [{ consequence: "Die Ultras finden das gar nicht lustig. Zwei Wochen Funkstille mit dem Fanclub.", deltas: adjust(s, { fans: -12, mentality: -4 }) }, 45],
          ]),
      },
      {
        id: "visit",
        label: "Den Fanclub besuchen und erklären",
        hint: "Persönlich, ehrlich, ohne Show",
        apply: (s) => ({ consequence: "Ein langer Abend im Vereinsheim. Am Ende gibt es ein Bier und einen Schal.", deltas: adjust(s, { fans: 6, mentality: 2 }) }),
      },
    ],
  },
  {
    id: "investor-rumor",
    title: "Der Scheich ruft an – angeblich",
    intro: () =>
      "Eine anonyme Nummer, eine Stimme mit Akzent: „Mein Auftraggeber möchte Sie in seinem Projekt sehen. Geld spielt keine Rolle.“ War das echt?",
    weight: 5,
    when: (s) => s.player.ovr >= 76 && !s.investorOffered,
    traits: { greedy: 2.2, loyal: 0.6 },
    options: [
      {
        id: "leak",
        label: "Das Gerücht bewusst streuen",
        hint: "Verhandlungsmasse – oder Verrat am Verein",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Dein Verein bekommt Panik und bessert dein Gehalt deutlich auf.", deltas: adjust(s, { morale: 10, reputation: 4 }) }, 50],
            [{ consequence: "Es war ein Radio-Comedian. Die Aufnahme läuft in der Morningshow. Das ganze Land lacht.", deltas: adjust(s, { reputation: -6, mentality: -8, fans: -6 }) }, 50],
          ]),
      },
      {
        id: "hangup",
        label: "Auflegen und blockieren",
        hint: "Kein Interesse an Spielchen",
        apply: (s) => ({ consequence: "Du blockierst die Nummer. Wer echtes Interesse hat, meldet sich offiziell.", deltas: adjust(s, { mentality: 3 }) }),
      },
    ],
  },
  {
    id: "captain-speech-leak",
    title: "Die Kabinenpredigt geht viral",
    intro: () =>
      "Nach dem 0:4 hast du in der Kabine eine Brandrede gehalten. Irgendwer hat sie aufgenommen. Jetzt hört sie das ganze Land.",
    weight: 5,
    when: (s) => s.player.age >= 23,
    traits: { leader: 2.4, hothead: 1.5, humble: 0.5 },
    options: [
      {
        id: "own-it",
        label: "Dazu stehen: „Jedes Wort ernst gemeint“",
        hint: "Führungsspieler oder Querulant?",
        apply: (s, rng) =>
          outcome(rng, [
            [{ consequence: "Die Mannschaft gewinnt die nächsten fünf Spiele. Die Rede wird als Wendepunkt der Saison gefeiert.", deltas: adjust(s, { relationship: 10, fans: 10, reputation: 6, form: 4 }) }, 55],
            [{ consequence: "Zwei Mitspieler fühlen sich vorgeführt. Die Kabine spaltet sich.", deltas: adjust(s, { relationship: -12, morale: -6 }) }, 45],
          ]),
      },
      {
        id: "internal",
        label: "„Das war intern und bleibt intern.“",
        hint: "Den Leak verurteilen, nicht die Rede",
        apply: (s) => ({ consequence: "Die Mannschaft schätzt, dass du sie nicht vorführst.", deltas: adjust(s, { relationship: 5 }) }),
      },
    ],
  },
];
