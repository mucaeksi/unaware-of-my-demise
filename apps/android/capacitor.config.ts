import type { CapacitorConfig } from '@capacitor/cli';

/** appId is the Play Console package name (fixed once the first AAB is uploaded). The web layer is the Phaser client build. */
const config: CapacitorConfig = {
  appId: 'io.github.mucaeksi.unawareofmydemise',
  appName: 'Unaware of My Demise',
  webDir: '../game/dist',
  android: { allowMixedContent: false },
  server: { androidScheme: 'https' }
};

export default config;
