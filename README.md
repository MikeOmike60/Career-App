# LEGENDENWEG – Fußball-Karriere als Handy-App

Handy-Version von **Legendenweg** (ursprünglich mit Lovable gebaut, Repo `legendenweg-karriere`) mit neuer Oberfläche im Stil von FIFA 13: helle Bühne mit weißen Hexagons, dunkle Kopfleiste, kursive Condensed-Schrift, Kachelmenüs und viele Animationen.

Die komplette Spiellogik (`src/lib/sim`) ist **unverändert** aus dem Lovable-Projekt übernommen, inklusive aller Tests. Neu ist nur die Oberfläche.

## Was neu ist

- **FIFA-13-Look**: Titelbildschirm „Tippe zum Starten“, schwebende Hexagons, Kacheln mit Glanzeffekt, FIFA-Tabs (wischen zum Wechseln)
- **Vereinslogos**: 235 echte Logos (u. a. alle Erstligisten aus DE, ENG, ES, IT, FR, PT, AT, CH, SCO) aus der Sammlung [luukhopman/football-logos](https://github.com/luukhopman/football-logos); alle anderen Vereine bekommen ein generiertes Wappen in Vereinsoptik
- **Animationen**: Walkout-Enthüllung der Spielerkarte, Anpfiff-Sequenz mit Spielfeld und Monaten, Saisonrückblick mit hochzählenden Zahlen, Auf-/Abstieg, Pokaljubel mit Konfetti, Gamble-Nadel, „Willkommen bei …“
- **FUT-artige Spielerkarte**, Farbe nach OVR-Dekade
- **Handy-Funktionen**: Vibration, Android-Zurück-Taste, Hochformat, Safe-Areas (Notch), Teilen der Hall-of-Fame-Karte

## Auf dem Handy installieren

### Android (APK)
Bei jedem Push baut GitHub automatisch eine APK:
1. Im Repo auf **Actions → „Android-APK bauen“** gehen und den neuesten grünen Lauf öffnen.
2. Unten unter **Artifacts** `legendenweg-android` herunterladen und entpacken.
3. `app-debug.apk` aufs Handy kopieren und öffnen (Installation aus unbekannten Quellen erlauben).

### iPhone
Eine native iOS-App braucht einen Mac mit Xcode (`npm run ios`). Ohne Mac: Web-Version als App nutzen (siehe unten → in Safari „Zum Home-Bildschirm“).

### Web-App (alle Handys)
`npm run build` erzeugt in `dist/` eine installierbare Web-App (PWA, funktioniert offline). Der Workflow „Web-App auf GitHub Pages“ kann sie veröffentlichen. Er startet **nur manuell**, weil die Seite dann öffentlich wäre.

## Entwicklung

```sh
npm install
npm run dev        # Entwicklungsserver (auch im WLAN mit dem Handy aufrufbar)
npm run build      # Typecheck + Produktions-Build
npm test           # Tests der Spiel-Engine
npm run android    # Build + Android Studio öffnen
npm run ios        # Build + Xcode öffnen (nur macOS)
```

## Struktur

- `src/lib/sim/` – Spiel-Engine aus dem Lovable-Projekt (unverändert)
- `src/screens/` – Bildschirme (Titel, Setup, Akademien, Karriere-Hub, Entscheidungen, Saisonablauf, Hall of Fame)
- `src/ui/` – Designbausteine (Wappen, Spielerkarte, Hexagon-Hintergrund, Haptik)
- `src/data/club-logos.json` + `public/crests/` – Zuordnung Verein → Logo
- `android/`, `ios/` – native Capacitor-Projekte

## Hinweis

Privates, inoffizielles Fanprojekt ohne Verbindung zu Vereinen, Ligen oder Verbänden. Die Vereinslogos sind Marken der jeweiligen Vereine. Für eine Veröffentlichung (z. B. im Play Store) müssten sie entfernt werden. Dann einfach `src/data/club-logos.json` leeren, und alle Vereine nutzen generierte Wappen.
