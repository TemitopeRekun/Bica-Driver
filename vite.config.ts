import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const devPort = Number(env.VITE_PORT || 5173);
  const backendProxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:3001';
  const frontendHost = (() => {
    try {
      return env.VITE_FRONTEND_URL ? new URL(env.VITE_FRONTEND_URL).hostname : '';
    } catch {
      return '';
    }
  })();
  const extraAllowedHosts = (env.VITE_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);
  const allowedHosts = Array.from(
    new Set([
      'localhost',
      '127.0.0.1',
      'rodney-registrable-poutingly.ngrok-free.dev',
      frontendHost,
      ...extraAllowedHosts,
    ]),
  );
  const proxyConfig = {
    target: backendProxyTarget,
    changeOrigin: true,
    ws: true,
  };

  return {
    server: {
      port: Number.isFinite(devPort) ? devPort : 5173,
      host: '0.0.0.0',
      allowedHosts,
      proxy: {
        '/auth': proxyConfig,
        '/users': proxyConfig,
        '/rides': proxyConfig,
        '/payments': proxyConfig,
        '/locations': proxyConfig,
        '/settings': proxyConfig,
        '/admin': proxyConfig,
        '/socket.io': proxyConfig,
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
