import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.campusconnect.app',
  appName: 'Campus Connect',
  webDir: 'dist',
  server: {
    // For dev, point to local backend
    // url: 'http://localhost:5173',
    // cleartext: true,
  },
};

export default config;
