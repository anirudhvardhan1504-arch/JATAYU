import { Server } from 'node:http';
import { closeSharedUserStore } from './auth/defaultStore.js';
import { UserStore } from './auth/userStore.js';

export interface ShutdownOptions {
  timeoutMs?: number;
  exitProcess?: boolean;
  onExit?: (code: number) => void;
  userStore?: UserStore;
}

export function createShutdownHandler(
  server: Server,
  options: ShutdownOptions = {}
): (signal: string) => Promise<void> {
  const timeoutMs = options.timeoutMs ?? 10000;
  const exitProcess = options.exitProcess ?? true;
  const onExit = options.onExit || ((code: number) => process.exit(code));
  let isShuttingDown = false;

  return async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      console.warn(`[JATAYU] Shutdown already in progress. Ignoring duplicate signal: ${signal}`);
      return;
    }
    isShuttingDown = true;
    console.log(`[JATAYU] Received ${signal}. Initiating graceful shutdown...`);

    // Bounded fallback force exit timer
    const forceTimer = setTimeout(() => {
      console.error(`[JATAYU] Graceful shutdown timed out after ${timeoutMs}ms. Forcing process exit.`);
      if (exitProcess) {
        onExit(1);
      }
    }, timeoutMs);

    if (forceTimer.unref) {
      forceTimer.unref();
    }

    try {
      // 1. Stop accepting new connections and drain in-flight HTTP requests
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) return reject(err);
          console.log('[JATAYU] HTTP server closed to new connections.');
          resolve();
        });
      });

      // 2. Close SQLite database connection after in-flight requests have drained
      const store = options.userStore;
      if (store) {
        store.close();
      } else {
        closeSharedUserStore();
      }
      console.log('[JATAYU] SQLite database connection closed.');

      clearTimeout(forceTimer);
      console.log('[JATAYU] Graceful shutdown completed cleanly.');

      if (exitProcess) {
        onExit(0);
      }
    } catch (err: any) {
      clearTimeout(forceTimer);
      console.error('[JATAYU] Error during graceful shutdown:', err.message);
      if (exitProcess) {
        onExit(1);
      }
    }
  };
}
