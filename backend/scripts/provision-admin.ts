#!/usr/bin/env node
/**
 * JATAYU Administrative User Provisioning CLI.
 * Securely provisions the initial system administrator in the persistent SQLite store.
 * Requires PROVISIONING_KEY environment variable.
 *
 * Usage:
 *   npx tsx scripts/provision-admin.ts --username admin [--displayName "Lead Director"]
 */

import path from 'node:path';
import readline from 'node:readline';
import { createPersistentUserStore } from '../src/auth/userStore.js';
import { config } from '../src/config.js';

function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      result[key] = val;
      if (val !== true) i++;
    }
  }
  return result;
}

function promptPassword(promptText: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const username = typeof args.username === 'string' ? args.username : undefined;
  const displayName = typeof args.displayName === 'string' ? args.displayName : 'System Administrator';
  const dbPath = config.auth.dbPath;
  const provisioningKey = process.env.PROVISIONING_KEY || (typeof args.provisioningKey === 'string' ? args.provisioningKey : undefined);

  if (!username) {
    console.error('Error: Argument --username is required.');
    console.error('Usage: npx tsx scripts/provision-admin.ts --username <user> [--displayName <name>]');
    process.exit(1);
  }

  if (!provisioningKey || provisioningKey.length < 32) {
    console.error('Error: Valid PROVISIONING_KEY of at least 32 characters is required via environment variable.');
    process.exit(1);
  }

  let password = process.env.ADMIN_PASSWORD || (typeof args.password === 'string' ? args.password : undefined);
  if (!password) {
    password = await promptPassword('Enter administrative password (min 8 chars): ');
  }

  if (!password || password.length < 8) {
    console.error('Error: Password must be at least 8 characters long.');
    process.exit(1);
  }

  const store = createPersistentUserStore({ dbPath });

  try {
    const admin = await store.provisionInitialAdmin({
      username,
      password,
      displayName,
      provisioningSecret: provisioningKey,
      expectedSecret: provisioningKey,
    });

    console.log('[JATAYU Security] Administrator successfully provisioned.');
    console.log(`[JATAYU Security] ID: ${admin.id}`);
    console.log(`[JATAYU Security] Username: ${admin.username}`);
    console.log(`[JATAYU Security] Role: ${admin.role}`);
    console.log(`[JATAYU Security] Database: ${dbPath}`);
  } catch (err: any) {
    console.error(`[JATAYU Security Error] Provisioning failed: ${err.message}`);
    process.exit(1);
  } finally {
    store.close();
  }
}

main().catch((err) => {
  console.error('[JATAYU Security Error]', err);
  process.exit(1);
});
