/**
 * FIFA-11-Kopfbilder aus einem hochgeladenen Foto.
 *
 * Zwei Wege:
 *  - lokal (kostenlos, offline): Gesichtserkennung + Freistellen mit MediaPipe,
 *    Kopf gerade ausrichten, FIFA-Ausschnitt, weißes Shirt, Spiel-Filter.
 *  - KI (optional): OpenAI-Bildbearbeitung mit eigenem API-Schlüssel.
 *
 * Beide liefern ein freigestelltes PNG (transparenter Hintergrund), das auf
 * Weiß genau wie ein FIFA-11-Profilbild wirkt und auf der Spielerkarte ohne
 * Kasten erscheint.
 */
import type { FaceLandmarker, ImageSegmenter, NormalizedLandmark } from "@mediapipe/tasks-vision";

export const HEAD_SIZE = 320;
const BASE = `${import.meta.env.BASE_URL}mediapipe/`;
const CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";

export class NoFaceError extends Error {
  constructor() {
    super("Auf dem Bild wurde kein Gesicht erkannt.");
  }
}

/* --------------------------------------------------------------- Modelle */

let models: Promise<{ landmarker: FaceLandmarker; segmenter: ImageSegmenter }> | null = null;

/** Lädt MediaPipe erst bei Bedarf – die App selbst bleibt schlank. */
function loadModels() {
  if (!models) {
    models = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      // Lokal gebündelt ist nur die SIMD-Variante; sehr alte Geräte laden die andere vom CDN.
      const simd = await vision.FilesetResolver.isSimdSupported();
      const fileset = simd
        ? { wasmLoaderPath: `${BASE}vision_wasm_internal.js`, wasmBinaryPath: `${BASE}vision_wasm_internal.wasm` }
        : { wasmLoaderPath: `${CDN}/vision_wasm_nosimd_internal.js`, wasmBinaryPath: `${CDN}/vision_wasm_nosimd_internal.wasm` };
      const landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${BASE}face_landmarker.task`, delegate: "CPU" },
        runningMode: "IMAGE",
        numFaces: 1,
      });
      const segmenter = await vision.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${BASE}selfie_segmenter.tflite`, delegate: "CPU" },
        runningMode: "IMAGE",
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
      return { landmarker, segmenter };
    })().catch((err) => {
      models = null;
      throw err;
    });
  }
  return models;
}

/* --------------------------------------------------------------- Helfer */

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Das Bild konnte nicht gelesen werden."));
    img.src = src;
  });
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas wird nicht unterstützt.");
  return [c, ctx];
}

/** Bild auf max. 1024 px verkleinern – schneller und speicherschonend. */
function normalize(img: HTMLImageElement): HTMLCanvasElement {
  const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
  const [c, ctx] = canvas(Math.round(img.naturalWidth * scale), Math.round(img.naturalHeight * scale));
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

type Pt = { x: number; y: number };
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

interface FaceGeometry {
  eyeMid: Pt;
  eyeDist: number;
  angle: number;
  chin: Pt;
}

function geometry(lms: NormalizedLandmark[], w: number, h: number): FaceGeometry {
  const p = (i: number): Pt => ({ x: lms[i]!.x * w, y: lms[i]!.y * h });
  // Augenmitten aus inneren/äußeren Lidwinkeln.
  const eyeA = mid(p(33), p(133));
  const eyeB = mid(p(362), p(263));
  const [left, right] = eyeA.x < eyeB.x ? [eyeA, eyeB] : [eyeB, eyeA];
  return {
    eyeMid: mid(left, right),
    eyeDist: dist(left, right),
    angle: Math.atan2(right.y - left.y, right.x - left.x),
    chin: p(152),
  };
}

async function detect(source: HTMLCanvasElement): Promise<{ geo: FaceGeometry; mask: HTMLCanvasElement }> {
  const { landmarker, segmenter } = await loadModels();
  const faces = landmarker.detect(source);
  const lms = faces.faceLandmarks[0];
  if (!lms) throw new NoFaceError();
  const geo = geometry(lms, source.width, source.height);

  // Personenmaske → Alpha-Kanal (weich ausgeblendet).
  const seg = segmenter.segment(source);
  const conf = seg.confidenceMasks?.[0];
  const [mc, mctx] = canvas(conf?.width ?? 1, conf?.height ?? 1);
  if (conf) {
    const values = conf.getAsFloat32Array();
    const data = mctx.createImageData(conf.width, conf.height);
    for (let i = 0; i < values.length; i++) {
      const v = values[i]!;
      const a = Math.min(1, Math.max(0, (v - 0.35) / 0.4));
      data.data[i * 4 + 3] = Math.round(a * 255);
    }
    mctx.putImageData(data, 0, 0);
  } else {
    mctx.fillRect(0, 0, 1, 1);
  }
  seg.close();
  const [mask, ctx] = canvas(source.width, source.height);
  ctx.filter = "blur(1.5px)";
  ctx.drawImage(mc, 0, 0, source.width, source.height);
  return { geo, mask };
}

/** Weißes Rundhals-Shirt im FIFA-11-Stil; überdeckt die Originalkleidung. */
function drawShirt(ctx: CanvasRenderingContext2D, S: number, cx: number, collarY: number) {
  const neckHalf = S * 0.14;
  const shoulderY = collarY + S * 0.055;
  // weicher Halsschatten über dem Kragen
  const shade = ctx.createLinearGradient(0, collarY - S * 0.07, 0, collarY + S * 0.01);
  shade.addColorStop(0, "rgba(60,40,30,0)");
  shade.addColorStop(1, "rgba(60,40,30,0.28)");
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = shade;
  ctx.fillRect(cx - neckHalf * 1.4, collarY - S * 0.07, neckHalf * 2.8, S * 0.08);
  ctx.restore();

  const body = new Path2D();
  // flache, breite Schultern wie im Spiel
  body.moveTo(-10, shoulderY + S * 0.05);
  body.bezierCurveTo(S * 0.12, shoulderY + S * 0.005, cx - neckHalf * 1.5, collarY + S * 0.012, cx - neckHalf, collarY);
  // Halsausschnitt (U-Form)
  body.bezierCurveTo(cx - neckHalf * 0.6, collarY + S * 0.055, cx + neckHalf * 0.6, collarY + S * 0.055, cx + neckHalf, collarY);
  body.bezierCurveTo(cx + neckHalf * 1.5, collarY + S * 0.012, S * 0.88, shoulderY + S * 0.005, S + 10, shoulderY + S * 0.05);
  body.lineTo(S + 10, S + 10);
  body.lineTo(-10, S + 10);
  body.closePath();

  const fill = ctx.createLinearGradient(0, 0, S, 0);
  fill.addColorStop(0, "#d9dfe4");
  fill.addColorStop(0.22, "#f7f8fa");
  fill.addColorStop(0.5, "#ffffff");
  fill.addColorStop(0.78, "#f7f8fa");
  fill.addColorStop(1, "#d9dfe4");
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.12)";
  ctx.shadowBlur = S * 0.02;
  ctx.shadowOffsetY = -S * 0.005;
  ctx.fillStyle = fill;
  ctx.fill(body);
  ctx.restore();

  // Kragenbündchen
  ctx.save();
  ctx.strokeStyle = "rgba(150,160,170,0.55)";
  ctx.lineWidth = S * 0.012;
  ctx.beginPath();
  ctx.moveTo(cx - neckHalf, collarY);
  ctx.bezierCurveTo(cx - neckHalf * 0.6, collarY + S * 0.055, cx + neckHalf * 0.6, collarY + S * 0.055, cx + neckHalf, collarY);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = S * 0.005;
  ctx.stroke();
  ctx.restore();

  // leichte Falten-Schattierung am Oberkörper
  const fold = ctx.createRadialGradient(cx, S * 1.15, S * 0.1, cx, S * 1.15, S * 0.55);
  fold.addColorStop(0, "rgba(0,0,0,0)");
  fold.addColorStop(1, "rgba(0,0,0,0.05)");
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = fold;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
}

/* ------------------------------------------------------ Lokaler Weg */

/**
 * Erzeugt lokal ein FIFA-11-Kopfbild (PNG mit transparentem Hintergrund).
 * Ausrichtung wie im Spiel: Augen waagerecht auf ca. 40 % Höhe, Kopf mittig.
 */
export async function makeFifaHeadLocal(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const src = normalize(img);
  const { geo, mask } = await detect(src);
  const S = HEAD_SIZE;

  // Person freistellen.
  const [person, pctx] = canvas(src.width, src.height);
  pctx.drawImage(src, 0, 0);
  pctx.globalCompositeOperation = "destination-in";
  pctx.drawImage(mask, 0, 0);

  // Kalibriert am FIFA-11-Original: Augen auf 42 % Höhe, Augen→Kinn = 31 % der Bildhöhe.
  const EYE_Y = 0.42;
  const EYE_CHIN = 0.31;
  const rel = { x: geo.chin.x - geo.eyeMid.x, y: geo.chin.y - geo.eyeMid.y };
  const cos = Math.cos(-geo.angle);
  const sin = Math.sin(-geo.angle);
  const eyeChin = rel.x * sin + rel.y * cos;
  const k = eyeChin > geo.eyeDist * 0.8 ? (S * EYE_CHIN) / eyeChin : (S * 0.2) / Math.max(1, geo.eyeDist);
  const [out, ctx] = canvas(S, S);
  ctx.save();
  ctx.translate(S * 0.5, S * EYE_Y);
  ctx.rotate(-geo.angle);
  ctx.scale(k, k);
  ctx.translate(-geo.eyeMid.x, -geo.eyeMid.y);
  // Spielgrafik-Look: kontrastreicher, minimal entsättigt und heller.
  ctx.filter = "saturate(0.92) contrast(1.12) brightness(1.03)";
  ctx.drawImage(person, 0, 0);
  ctx.restore();

  // Weiche „Render“-Haut: weichgezeichnete Kopie über die Person legen.
  const [soft, sctx] = canvas(S, S);
  sctx.filter = `blur(${(S / 320) * 1.6}px)`;
  sctx.drawImage(out, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.globalAlpha = 0.6;
  ctx.drawImage(soft, 0, 0);
  ctx.restore();

  // Kinnposition im Ausgabebild → Kragenhöhe (kurzer Hals wie im Spiel).
  const chinY = S * EYE_Y + eyeChin * k;
  const collarY = Math.min(S * 0.93, chinY + (chinY - S * EYE_Y) * 0.24);

  // Unterhalb des Kinns bleibt nur ein weich auslaufender Hals – die alte
  // Kleidung verschwindet, das weiße Shirt kommt darüber.
  const [keep, kctx] = canvas(S, S);
  const cx = S * 0.5;
  const fadeTop = chinY + S * 0.005;
  kctx.fillStyle = "#000";
  kctx.fillRect(0, 0, S, fadeTop);
  kctx.beginPath();
  kctx.moveTo(cx - S * 0.115, fadeTop - S * 0.02);
  kctx.lineTo(cx + S * 0.115, fadeTop - S * 0.02);
  kctx.lineTo(cx + S * 0.13, collarY + S * 0.04);
  kctx.lineTo(cx - S * 0.13, collarY + S * 0.04);
  kctx.closePath();
  kctx.fill();
  const [soft2, s2ctx] = canvas(S, S);
  s2ctx.filter = `blur(${(S / 320) * 2.5}px)`;
  s2ctx.drawImage(keep, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(soft2, 0, 0);
  ctx.restore();

  drawShirt(ctx, S, S * 0.5, collarY);
  return out.toDataURL("image/png");
}

/* ------------------------------------------------------------ KI-Weg */

export type AiQuality = "low" | "medium" | "high";

export interface AiSettings {
  apiKey: string;
  quality: AiQuality;
  model: string;
}

const AI_KEY = "legendenweg:openai:v1";

/** Der Schlüssel bleibt ausschließlich auf diesem Gerät – nie im Spielstand oder Export. */
export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(AI_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AiSettings>;
      return {
        apiKey: typeof p.apiKey === "string" ? p.apiKey : "",
        quality: p.quality === "low" || p.quality === "high" ? p.quality : "medium",
        model: typeof p.model === "string" && p.model.trim() ? p.model.trim() : "gpt-image-1",
      };
    }
  } catch {
    /* defekte Einstellungen ignorieren */
  }
  return { apiKey: "", quality: "medium", model: "gpt-image-1" };
}

export function saveAiSettings(s: AiSettings): void {
  try {
    localStorage.setItem(AI_KEY, JSON.stringify(s));
  } catch {
    /* Speicher gesperrt */
  }
}

export const AI_PROMPT =
  "Turn this photo into an in-game player headshot from the 2010 video game FIFA 11 by EA Sports: " +
  "a 3D video-game render of the exact same person. Preserve the facial identity, face shape, hairstyle, " +
  "hair color, facial hair and skin tone exactly. Head facing straight into the camera, head level, " +
  "completely neutral expressionless face, mouth closed, eyes open looking forward. " +
  "He or she wears a plain white crew-neck shirt; show head, neck and the top of the shoulders, centered, " +
  "with the head filling the upper two thirds of the frame. Soft even studio lighting, slightly smooth and " +
  "glossy skin typical of 2010 console game graphics. Plain transparent background. No text, no logos, no badges.";

/** Quadratischer Ausschnitt um das Gesicht (falls erkennbar) als PNG-Blob für die KI. */
async function aiInput(dataUrl: string): Promise<Blob> {
  const img = await loadImage(dataUrl);
  const src = normalize(img);
  let cx = src.width / 2;
  let cy = src.height / 2;
  let side = Math.min(src.width, src.height);
  try {
    const { landmarker } = await loadModels();
    const lms = landmarker.detect(src).faceLandmarks[0];
    if (lms) {
      const geo = geometry(lms, src.width, src.height);
      cx = geo.eyeMid.x;
      cy = geo.eyeMid.y + geo.eyeDist * 0.6;
      side = Math.min(Math.max(src.width, src.height), geo.eyeDist * 5.2);
    }
  } catch {
    /* ohne Erkennung: mittiger Ausschnitt */
  }
  const [c, ctx] = canvas(1024, 1024);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.drawImage(src, cx - side / 2, cy - side / 2, side, side, 0, 0, 1024, 1024);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Bild konnte nicht vorbereitet werden."))), "image/png"));
}

function aiError(status: number, message: string): Error {
  if (status === 401) return new Error("Der API-Schlüssel ist ungültig.");
  if (status === 429) return new Error("Limit erreicht oder kein Guthaben auf dem OpenAI-Konto.");
  if (status === 400 && /safety|moderation|policy/i.test(message))
    return new Error("Die KI hat das Bild aus Sicherheitsgründen abgelehnt. Versuche ein anderes Foto.");
  return new Error(message || `Die KI-Anfrage ist fehlgeschlagen (Fehler ${status}).`);
}

/** Erzeugt das Kopfbild mit der OpenAI-Bildbearbeitung (eigener API-Schlüssel). */
export async function makeFifaHeadAI(dataUrl: string, settings: AiSettings, signal?: AbortSignal): Promise<string> {
  if (!settings.apiKey.trim()) throw new Error("Kein API-Schlüssel hinterlegt.");
  const input = await aiInput(dataUrl);

  const send = async (withFidelity: boolean) => {
    const form = new FormData();
    form.append("model", settings.model);
    form.append("image", input, "foto.png");
    form.append("prompt", AI_PROMPT);
    form.append("size", "1024x1024");
    form.append("quality", settings.quality);
    form.append("background", "transparent");
    form.append("output_format", "png");
    if (withFidelity) form.append("input_fidelity", "high");
    const init: RequestInit = { method: "POST", headers: { Authorization: `Bearer ${settings.apiKey.trim()}` }, body: form };
    if (signal) init.signal = signal;
    return fetch("https://api.openai.com/v1/images/edits", init);
  };

  let res = await send(true);
  let body = (await res.json().catch(() => ({}))) as { data?: { b64_json?: string }[]; error?: { message?: string } };
  // Ältere/andere Modelle kennen input_fidelity nicht – dann ohne erneut versuchen.
  if (!res.ok && res.status === 400 && /input_fidelity/i.test(body.error?.message ?? "")) {
    res = await send(false);
    body = (await res.json().catch(() => ({}))) as typeof body;
  }
  if (!res.ok) throw aiError(res.status, body.error?.message ?? "");
  const b64 = body.data?.[0]?.b64_json;
  if (!b64) throw new Error("Die KI hat kein Bild zurückgegeben.");

  const img = await loadImage(`data:image/png;base64,${b64}`);
  const [c, ctx] = canvas(HEAD_SIZE, HEAD_SIZE);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, HEAD_SIZE, HEAD_SIZE);
  return c.toDataURL("image/png");
}

/** true = freigestelltes FIFA-Kopfbild (PNG), false = normales Foto. */
export function isHeadCutout(avatar: string): boolean {
  return avatar.startsWith("data:image/png");
}
