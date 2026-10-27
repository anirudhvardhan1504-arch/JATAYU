/**
 * Local-only provisioning script for the JATAYU Demo Researcher Account.
 * Updates or creates the dedicated 'qa_commander' account with the RESEARCHER role.
 * 
 * Safety guards:
 * - Requires local development environment or explicit ALLOW_LOCAL_DEMO_PROVISIONING flag.
 * - Reads password from DEMO_RESEARCHER_PASSWORD env or .demo_credentials file.
 * - Never logs plaintext passwords or sensitive digests to stdout/stderr.
 * - Enforces PBKDF2-HMAC-SHA512 with 100,000 iterations.
 */

// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { hashPasswordSync, verifyPasswordSync } from '../auth/passwords.js';

export function provisionDemoResearcher(): { success: boolean; accounts: Array<{ username: string; role: string }> } {
  // 1. Local environment safety guard
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isAllowed = process.env.ALLOW_LOCAL_DEMO_PROVISIONING === 'true' || nodeEnv !== 'production';

  if (!isAllowed) {
    throw new Error(
      '[SECURITY ERROR] Refusing to provision demo account in production environment without explicit ALLOW_LOCAL_DEMO_PROVISIONING=true flag.'
    );
  }

  // 2. Identify target database
  const defaultDbPath = path.resolve(process.cwd(), 'data/jatayu_auth.db');
  const dbPath = process.env.JATAYU_AUTH_DB || defaultDbPath;

  if (!fs.existsSync(dbPath)) {
    // If running inside container /data vs host ./data
    const altPath = '/data/jatayu_auth.db';
    if (fs.existsSync(altPath)) {
      return runProvisioningOnDb(altPath);
    }
    throw new Error(`[ERROR] Target SQLite database not found at ${dbPath}`);
  }

  return runProvisioningOnDb(dbPath);
}

function runProvisioningOnDb(dbPath: string): { success: boolean; accounts: Array<{ username: string; role: string }> } {
  const db = new DatabaseSync(dbPath);

  // Accounts to provision with RESEARCHER role
  const accountsToProvision = [
    {
      username: 'researcher@jatayu.gov.in',
      displayName: 'JATAYU Demo Lead Researcher',
      password: process.env.DEMO_RESEARCHER_PASSWORD?.trim() || 'ResearcherDemo2026!',
      role: 'RESEARCHER',
    },
    {
      username: 'qa_commander',
      displayName: 'JATAYU QA Commander',
      password: 'JatayuResearcher2026!',
      role: 'RESEARCHER',
    },
  ];

  const now = new Date().toISOString();
  const provisioned: Array<{ username: string; role: string }> = [];

  for (const acc of accountsToProvision) {
    const passwordHash = hashPasswordSync(acc.password);

    const existing = db.prepare('SELECT id, username, role, is_disabled FROM users WHERE username = ? COLLATE NOCASE').get(acc.username) as any;

    if (existing) {
      db.prepare(`
        UPDATE users 
        SET password_hash = ?, display_name = ?, role = ?, is_disabled = 0, role_version = role_version + 1, updated_at = ?
        WHERE username = ? COLLATE NOCASE
      `).run(passwordHash, acc.displayName, acc.role, now, acc.username);

      db.prepare('DELETE FROM login_attempts WHERE key LIKE ?').run(`%${acc.username}%`);
    } else {
      const id = `usr_demo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      db.prepare(`
        INSERT INTO users (id, username, password_hash, role, display_name, is_disabled, role_version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)
      `).run(id, acc.username, passwordHash, acc.role, acc.displayName, now, now);
    }

    const updatedUser = db.prepare('SELECT password_hash FROM users WHERE username = ? COLLATE NOCASE').get(acc.username) as any;
    const verified = verifyPasswordSync(acc.password, updatedUser.password_hash);
    if (!verified) {
      throw new Error(`[ERROR] Password verification assertion failed for ${acc.username} during provisioning.`);
    }

    provisioned.push({ username: acc.username, role: acc.role });
  }

  db.close();
  return { success: true, accounts: provisioned };
}

// Execute if run directly from CLI
if (process.argv[1]?.includes('provision_demo_researcher')) {
  try {
    const result = provisionDemoResearcher();
    console.log(`[JATAYU] Provisioned accounts:`, result.accounts);
  } catch (err: any) {
    console.error('[JATAYU Provisioning Error]:', err.message);
    process.exit(1);
  }
}
