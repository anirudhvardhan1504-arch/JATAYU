/**
 * Secure password hashing and verification using asynchronous PBKDF2 with SHA-512.
 * Enforces Unicode NFKC normalization, constant-time verification, and format validation.
 */

import { pbkdf2, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2Async = promisify(pbkdf2);

export const DEFAULT_ITERATIONS = 100000;
export const MIN_ITERATIONS = 50000;
export const KEY_LEN = 64; // 64 bytes = 512 bits
export const DIGEST = 'sha512';
export const SALT_LEN_BYTES = 16;
export const MIN_PASSWORD_LENGTH = 8;

export interface HashValidationResult {
  valid: boolean;
  iterations?: number;
  salt?: string;
  hash?: string;
}

/**
 * Normalizes a password string using Unicode NFKC.
 * Prevents visually identical Unicode representations from hashing to different digests.
 */
export function normalizePassword(password: string): string {
  if (typeof password !== 'string') {
    throw new TypeError('Password must be a string');
  }
  return password.normalize('NFKC');
}

/**
 * Asynchronously hash a plaintext password with PBKDF2-HMAC-SHA512.
 * @returns format: iterations$salt$hash
 */
export async function hashPassword(password: string, iterations = DEFAULT_ITERATIONS): Promise<string> {
  if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  const normalized = normalizePassword(password);
  const salt = randomBytes(SALT_LEN_BYTES).toString('hex');
  const derivedKey = await pbkdf2Async(normalized, salt, iterations, KEY_LEN, DIGEST);
  const hash = derivedKey.toString('hex');

  return `${iterations}$${salt}$${hash}`;
}

/**
 * Synchronous variant of hashPassword for contexts where async is unavailable.
 */
export function hashPasswordSync(password: string, iterations = DEFAULT_ITERATIONS): string {
  if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  const normalized = normalizePassword(password);
  const salt = randomBytes(SALT_LEN_BYTES).toString('hex');
  const derived = pbkdf2Sync(normalized, salt, iterations, KEY_LEN, DIGEST).toString('hex');

  return `${iterations}$${salt}$${derived}`;
}

/**
 * Validates whether a stored hash conforms to the required secure format.
 * Format: <iterations>$<16-byte-hex-salt>$<64-byte-hex-hash>
 */
export function validateHashFormat(storedHash: string): HashValidationResult {
  if (typeof storedHash !== 'string' || !storedHash) {
    return { valid: false };
  }

  const parts = storedHash.split('$');
  if (parts.length !== 3) {
    return { valid: false };
  }

  const [iterStr, salt, hash] = parts;
  const iterations = parseInt(iterStr, 10);

  if (isNaN(iterations) || iterations < MIN_ITERATIONS) {
    return { valid: false };
  }

  // Salt must be exactly 32 hex chars (16 bytes)
  if (!/^[0-9a-fA-F]{32}$/.test(salt)) {
    return { valid: false };
  }

  // Hash must be exactly 128 hex chars (64 bytes for SHA-512)
  if (!/^[0-9a-fA-F]{128}$/.test(hash)) {
    return { valid: false };
  }

  return { valid: true, iterations, salt, hash };
}

/**
 * Asynchronously verify a plaintext password against a stored hash.
 * Fails safely on malformed or invalid inputs without throwing.
 * Uses timingSafeEqual for constant-time comparison.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || typeof password !== 'string') {
    return false;
  }

  const parsed = validateHashFormat(storedHash);
  if (!parsed.valid || !parsed.salt || !parsed.hash || !parsed.iterations) {
    return false;
  }

  try {
    const normalized = normalizePassword(password);
    const derivedKey = await pbkdf2Async(
      normalized,
      parsed.salt,
      parsed.iterations,
      KEY_LEN,
      DIGEST
    );

    const derivedBuf = Buffer.from(derivedKey.toString('hex'), 'hex');
    const hashBuf = Buffer.from(parsed.hash, 'hex');

    if (derivedBuf.length !== hashBuf.length) {
      return false;
    }

    return timingSafeEqual(derivedBuf, hashBuf);
  } catch {
    return false;
  }
}

/**
 * Synchronous variant of verifyPassword.
 */
export function verifyPasswordSync(password: string, storedHash: string): boolean {
  if (!password || typeof password !== 'string') {
    return false;
  }

  const parsed = validateHashFormat(storedHash);
  if (!parsed.valid || !parsed.salt || !parsed.hash || !parsed.iterations) {
    return false;
  }

  try {
    const normalized = normalizePassword(password);
    const derived = pbkdf2Sync(
      normalized,
      parsed.salt,
      parsed.iterations,
      KEY_LEN,
      DIGEST
    ).toString('hex');

    const derivedBuf = Buffer.from(derived, 'hex');
    const hashBuf = Buffer.from(parsed.hash, 'hex');

    if (derivedBuf.length !== hashBuf.length) {
      return false;
    }

    return timingSafeEqual(derivedBuf, hashBuf);
  } catch {
    return false;
  }
}

/**
 * Determines whether a stored hash was created with outdated parameters and requires rehashing.
 */
export function needsRehash(storedHash: string, targetIterations = DEFAULT_ITERATIONS): boolean {
  const parsed = validateHashFormat(storedHash);
  if (!parsed.valid || !parsed.iterations) return true;
  return parsed.iterations < targetIterations;
}
