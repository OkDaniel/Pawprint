import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '');

  return {
    base: env.APP_BASE_PATH || '/',
    envDir: '..',
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: `http://localhost:${env.APP_PORT || '3001'}`,
          changeOrigin: true,
        },
      },
    },
  };
});

