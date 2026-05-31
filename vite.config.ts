import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(async ({ mode }) => {
  const isElectron = mode === 'electron';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugins: any[] = [react()];

  if (isElectron) {
    const { default: electron } = await import('vite-plugin-electron/simple');
    plugins.push(
      electron({
        main: { entry: 'electron/main.ts' },
        preload: {
          input: 'electron/preload.ts',
          vite: {
            build: {
              rollupOptions: {
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
      proxy: { '/api': 'http://localhost:3001' },
    },
  };
});
