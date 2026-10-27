import dns from 'node:dns';
// Enforce IPv4-first resolution for reliable outbound connectivity in containerized bridge networks
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (err) {
  console.warn('[JATAYU] Could not set DNS default result order to ipv4first:', err);
}

import { app } from './app.js';
import { config } from './config.js';
import { createShutdownHandler } from './shutdown.js';

export function startServer(port = config.port) {
  const server = app.listen(port, () => {
    console.log(`[JATAYU] Backend service running on http://localhost:${port}`);
    console.log(`[JATAYU] Health check: http://localhost:${port}/api/health`);
    console.log(`[JATAYU] Weather endpoint: http://localhost:${port}/api/weather/current`);
    console.log(`[JATAYU] AI status: http://localhost:${port}/api/ai/status`);
    console.log(`[JATAYU] Allowed CORS origins: ${config.cors.allowedOrigins.join(', ')}`);
  });

  const handleShutdown = createShutdownHandler(server);

  const sigtermHandler = () => handleShutdown('SIGTERM');
  const sigintHandler = () => handleShutdown('SIGINT');

  process.on('SIGTERM', sigtermHandler);
  process.on('SIGINT', sigintHandler);

  return { server, handleShutdown, sigtermHandler, sigintHandler };
}

// Only start the server if executed directly as entrypoint
if (process.env.NODE_ENV !== 'test') {
  startServer();
}
