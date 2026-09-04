import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gurushrestha.ludo',
  appName: 'Ludo',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
};

export default config;
