/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Mounts the BFF on the Vite dev server so `npm run dev` gives you the
 * frontend AND the `/api/*` endpoints in one process. The handler is the same
 * one used by the production Node server.
 */
function bffDevServer(): Plugin {
  return {
    name: 'tripsense-bff',
    apply: 'serve',
    async configureServer(server) {
      const { loadConfig } = await import('./server/config');
      const { createApiHandler } = await import('./server/app');
      const handleApi = createApiHandler(loadConfig());
      server.middlewares.use((req, res, next) => {
        handleApi(req, res)
          .then((handled) => {
            if (!handled) next();
          })
          .catch(next);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), bffDevServer()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173 },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts', 'tests/component/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
  },
});
