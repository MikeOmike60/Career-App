import { useId, useState } from "react";
import { hashString } from "@/lib/sim/rng";
import clubLogos from "@/data/club-logos.json";
import remoteLogos from "@/data/club-logos-remote.json";

const LOGOS = clubLogos as Record<string, string>;
const REMOTE = remoteLogos as unknown as Record<string, [string, string, string]>;

/** Logo-CDN des football-logos.cc-Katalogs (nur 512 px verfügbar). */
const REMOTE_BASE = "https://assets.football-logos.cc/logos";

/** Mitgeliefertes Logo (offline verfügbar). Relativ, damit es in Capacitor und auf GitHub Pages funktioniert. */
export function logoFor(name: string): string | undefined {
  const file = LOGOS[name];
  return file ? `crests/${file}` : undefined;
}

/** Logo aus dem Online-Katalog; wird beim ersten Laden zwischengespeichert. */
export function remoteLogoFor(name: string): string | undefined {
  const entry = REMOTE[name];
  return entry ? `${REMOTE_BASE}/${entry[0]}/512x512/${entry[1]}.${entry[2]}.png` : undefined;
}

export const LOGO_COUNTS = { local: Object.keys(LOGOS).length, remote: Object.keys(REMOTE).length };

/** Typische Vereinsfarben-Paare für generierte Wappen. */
const COLORWAYS: [string, string][] = [
  ["#c8102e", "#ffffff"],
  ["#003f8a", "#ffffff"],
  ["#111111", "#f5c400"],
  ["#00843d", "#ffffff"],
  ["#6c1d45", "#8ecae6"],
  ["#1c2c5b", "#d4a017"],
  ["#e35205", "#111111"],
  ["#5b2d8e", "#ffffff"],
  ["#0a7bc1", "#ffd100"],
  ["#111111", "#ffffff"],
  ["#a50044", "#004d98"],
  ["#006a4e", "#f2c200"],
  ["#b30000", "#111111"],
  ["#2a6ebb", "#c8102e"],
  ["#0b3d2e", "#e8e3d3"],
  ["#7a0019", "#ffcc33"],
];

const SHAPES = [
  // klassisches Schild
  "M50 4 L93 15 V56 C93 86 72 104 50 116 C28 104 7 86 7 56 V15 Z",
  // Rundwappen
  "M50 6 A54 54 0 0 1 50 114 A54 54 0 0 1 50 6 Z",
  // gerades Schild
  "M9 6 H91 V58 C91 88 70 106 50 116 C30 106 9 88 9 58 Z",
  // Hexagon
  "M50 4 L94 29 V89 L50 114 L6 89 V29 Z",
  // spitzes Schild
  "M50 4 L94 22 L84 88 L50 116 L16 88 L6 22 Z",
];

const STOP_WORDS =
  /^(FC|SC|SV|CD|AC|AS|US|GD|SK|TSV|CF|UD|SS|TuS|VfB|VfL|SpVgg|TSG|FK|SSC|AFC|BSC|RC|1\.|SD|CA|ASD|SSD|Calcio|Club|de|del|la|le|II|U23)$/i;

function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}. ]/gu, " ")
    .split(" ")
    .filter((w) => w.length > 1 && !STOP_WORDS.test(w) && !/^\d+$/.test(w));
  const source = words.length ? words : name.split(" ").filter(Boolean);
  if (source.length === 1) return source[0]!.slice(0, 3).toUpperCase();
  return source
    .slice(0, 3)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Deterministisches Vereinswappen im Stil eines echten Clubwappens. */
export function GeneratedCrest({ name, size }: { name: string; size: number }) {
  const uid = useId().replace(/:/g, "");
  const h = hashString(name);
  const [c1, c2] = COLORWAYS[h % COLORWAYS.length]!;
  const shape = SHAPES[Math.floor(h / 17) % SHAPES.length]!;
  const pattern = Math.floor(h / 101) % 7;
  const emblem = Math.floor(h / 709) % 4;
  const label = initials(name);
  const bandText = luminance(c1) > 0.6 ? "#111" : "#fff";
  const clip = `cc-${uid}`;
  const gloss = `cg-${uid}`;

  return (
    <svg viewBox="0 0 100 120" width={size} height={size * 1.2} role="img" aria-label={`Wappen ${name}`}>
      <defs>
        <clipPath id={clip}>
          <path d={shape} />
        </clipPath>
        <linearGradient id={gloss} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={shape} fill={c2} />
      <g clipPath={`url(#${clip})`}>
        {pattern === 0 &&
          [0, 1, 2, 3, 4].map((i) => <rect key={i} x={i * 22 - 2} y={0} width={11} height={120} fill={c1} />)}
        {pattern === 1 &&
          [0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={0} y={i * 22} width={100} height={11} fill={c1} />)}
        {pattern === 2 && <path d="M-10 120 L110 -10 L110 30 L20 130 Z" fill={c1} />}
        {pattern === 3 && <rect x={0} y={0} width={50} height={120} fill={c1} />}
        {pattern === 4 && (
          <>
            <rect x={0} y={0} width={50} height={60} fill={c1} />
            <rect x={50} y={60} width={50} height={60} fill={c1} />
          </>
        )}
        {pattern === 5 && <rect x={0} y={0} width={100} height={120} fill={c1} />}
        {pattern === 6 && <path d="M0 40 L50 80 L100 40 V120 H0 Z" fill={c1} />}
        <rect x={0} y={0} width={100} height={60} fill={`url(#${gloss})`} />
      </g>
      {/* Ring + Rand */}
      <path d={shape} fill="none" stroke="#fff" strokeWidth={7} />
      <path d={shape} fill="none" stroke={c1} strokeWidth={3} />
      {/* Emblem */}
      {emblem === 0 && (
        <g transform="translate(50 78)">
          <circle r="13" fill="#fff" stroke="#111" strokeWidth="1.5" />
          <path d="M0 -6 L5.7 -1.9 L3.5 4.9 H-3.5 L-5.7 -1.9 Z" fill="#111" />
        </g>
      )}
      {emblem === 1 && (
        <path d="M50 64 l4 8.5 9.3 1.2 -6.8 6.4 1.7 9.2 -8.2 -4.5 -8.2 4.5 1.7 -9.2 -6.8 -6.4 9.3 -1.2 Z" fill="#f5c400" stroke="#111" strokeWidth="1.2" />
      )}
      {emblem === 2 && <path d="M38 88 L42 68 L50 78 L58 68 L62 88 Z" fill="#f5c400" stroke="#111" strokeWidth="1.2" />}
      {emblem === 3 && (
        <g fill="none" stroke="#fff" strokeWidth="3">
          <circle cx="50" cy="80" r="11" />
          <circle cx="50" cy="80" r="5" fill="#fff" />
        </g>
      )}
      {/* Namensband */}
      <rect x={12} y={30} width={76} height={24} fill={c1} stroke="#fff" strokeWidth={2.5} rx={2} />
      <text
        x="50"
        y="49"
        textAnchor="middle"
        fontSize={label.length > 3 ? 15 : 20}
        fontWeight={800}
        fill={bandText}
        fontFamily="Barlow Condensed, Arial Narrow, sans-serif"
        letterSpacing="1"
      >
        {label}
      </text>
    </svg>
  );
}

/** Vereinswappen: echtes Logo, wenn vorhanden – sonst generiertes Wappen. */
/**
 * Vereinswappen: mitgeliefertes Logo, sonst Logo aus dem Online-Katalog, sonst
 * generiertes Wappen. Online-Logos erscheinen erst nach dem Laden – bis dahin
 * (und offline) steht das generierte Wappen da.
 * `offline` = nur mitgelieferte Logos (z. B. für den PNG-Export, der keine
 * fremden Bilder einbetten darf).
 */
export function Crest({ name, size = 32, className, offline }: { name: string; size?: number; className?: string; offline?: boolean }) {
  const local = logoFor(name);
  const src = local ?? (offline ? undefined : remoteLogoFor(name));
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(Boolean(local));
  const showImage = src && !failed;
  return (
    <span
      className={className}
      style={{ position: "relative", width: size, height: size * 1.2, display: "inline-grid", placeItems: "center", flex: "none" }}
    >
      {(!showImage || !loaded) && <GeneratedCrest name={name} size={size} />}
      {showImage ? (
        <img
          src={src}
          alt={`Logo ${name}`}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{
            position: loaded ? "static" : "absolute",
            opacity: loaded ? 1 : 0,
            width: size,
            height: size,
            objectFit: "contain",
            filter: "drop-shadow(0 2px 3px rgba(0,0,0,.25))",
          }}
        />
      ) : null}
    </span>
  );
}

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];

/** Generisches Liga-Abzeichen: Hexagon mit Ligastufe. */
export function LeagueBadge({ league, division, size = 22 }: { league: string; division?: number | undefined; size?: number }) {
  const h = hashString(`liga:${league}`);
  const [c1] = COLORWAYS[Math.floor(h / 8) % COLORWAYS.length]!;
  const text = (division !== undefined && ROMAN[division]) || league.slice(0, 2).toUpperCase();
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`Liga ${league}`} style={{ flex: "none" }}>
      <path d="M50 3 L93 27 V73 L50 97 L7 73 V27 Z" fill={c1} stroke="#fff" strokeWidth="6" />
      <path d="M50 16 L81 34 V66 L50 84 L19 66 V34 Z" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="3" />
      <text
        x="50"
        y="63"
        textAnchor="middle"
        fontSize={text.length > 2 ? 30 : 38}
        fontWeight={800}
        fill="#fff"
        fontFamily="Barlow Condensed, Arial Narrow, sans-serif"
      >
        {text}
      </text>
    </svg>
  );
}
