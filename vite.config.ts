import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(async ({ mode }) => {
  const isElectron = mode === 'electron';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugins: any[] = [react()];

  if (isElectron) {
    const { default: electron } = await import('vite-plugin-electron/simple');
    // Native and Node modules must not be bundled into the main process.
    // They are resolved from node_modules at runtime (packed via electron-builder).
    const external = [
      'better-sqlite3',
      'ws',
      'bufferutil',
      'utf-8-validate',
      'express',
      'cors',
    ];
    plugins.push(
      electron({
        main: {
          entry: 'electron/main.ts',
          vite: {
            build: {
              rollupOptions: { external },
            },
          },
        },
        preload: {
          input: 'electron/preload.ts',
          vite: {
            build: {
              rollupOptions: {
                external,
                output: { entryFileNames: '[name].js' },
              },
            },
          },
        },
      }),
    );
  }

  return {
    base: isElectron ? './' : '/',
    plugins,
    server: {
      host: true,
      allowedHosts: ['.ngrok-free.dev', '.ngrok.io', '.ngrok.app'],
      proxy: { '/api': 'http://localhost:3001' },
    },
  };
});
