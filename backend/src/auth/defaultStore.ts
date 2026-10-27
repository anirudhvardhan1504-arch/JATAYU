import { createPersistentUserStore, UserStore } from './userStore.js';
import { config } from '../config.js';

let sharedStore: UserStore | null = null;

export function getSharedUserStore(): UserStore {
  if (!sharedStore) {
    sharedStore = createPersistentUserStore({ dbPath: config.auth.dbPath });
  }
  return sharedStore;
}

export function closeSharedUserStore(): void {
  if (sharedStore) {
    try {
      sharedStore.close();
    } catch {
      // Ignore if already closed
    }
    sharedStore = null;
  }
}

/**
 * Reset shared store instance (used primarily in test suites).
 */
export function resetSharedUserStoreForTesting(): void {
  sharedStore = null;
}
