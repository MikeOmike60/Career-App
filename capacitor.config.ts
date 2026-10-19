import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.profikarriere.app',
  appName: 'Profi Karriere',
  webDir: 'dist',
  backgroundColor: '#0e1a24',
  android: { allowMixedContent: false },
  plugins: {
    StatusBar: { overlaysWebView: true, style: 'DARK', backgroundColor: '#00000000' },
  },
};

export default config;
