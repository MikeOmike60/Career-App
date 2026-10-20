import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { useEffect, useRef } from "react";
import { getSettings } from "./settings";

export const isNative = Capacitor.isNativePlatform();

/* ---------------------------------------------------------------- Haptik */

function hapticsOn(): boolean {
  return getSettings().haptics;
}

export function tap(): void {
  if (!hapticsOn()) return;
  if (isNative) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  else navigator.vibrate?.(8);
}

export function thud(): void {
  if (!hapticsOn()) return;
  if (isNative) void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
  else navigator.vibrate?.(25);
}

export function celebrate(): void {
  if (!hapticsOn()) return;
  if (isNative) void Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
  else navigator.vibrate?.([30, 60, 30, 60, 60]);
}

export function warn(): void {
  if (!hapticsOn()) return;
  if (isNative) void Haptics.notification({ type: NotificationType.Warning }).catch(() => undefined);
  else navigator.vibrate?.([40, 40, 40]);
}

/* ------------------------------------------------------------ Statusleiste */

export function initNativeChrome(): void {
  if (!isNative) return;
  void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
  if (Capacitor.getPlatform() === "android") {
    // Ältere Android-WebViews melden keine Safe-Area – daher nicht überlagern.
    void StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
    void StatusBar.setBackgroundColor({ color: "#0e1a24" }).catch(() => undefined);
  } else {
    void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
  }
}

/* ----------------------------------------------------------- Zurück-Taste */

type BackHandler = () => void;
const backStack: { id: number; fn: BackHandler }[] = [];
let nextId = 1;
let rootHandler: BackHandler | null = null;

/** Android-Zurück: oberstes offenes Element schließt zuerst. */
export function useBackHandler(active: boolean, handler: BackHandler): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    const id = nextId++;
    backStack.push({ id, fn: () => ref.current() });
    return () => {
      const i = backStack.findIndex((b) => b.id === id);
      if (i >= 0) backStack.splice(i, 1);
    };
  }, [active]);
}

export function setRootBackHandler(fn: BackHandler | null): void {
  rootHandler = fn;
}

if (isNative) {
  void CapApp.addListener("backButton", () => {
    const top = backStack[backStack.length - 1];
    if (top) {
      top.fn();
      return;
    }
    if (rootHandler) {
      rootHandler();
      return;
    }
    void CapApp.minimizeApp().catch(() => CapApp.exitApp());
  });
}

/* --------------------------------------------------------- Bild sichern */

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(blob);
  });
}

/** Native: in den Cache schreiben und über das Teilen-Menü anbieten. */
export async function shareImageNative(blob: Blob, fileName: string, title: string): Promise<void> {
  const data = await blobToBase64(blob);
  const written = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Cache });
  await Share.share({ title, url: written.uri, dialogTitle: "Karriere-Karte teilen oder speichern" });
}
