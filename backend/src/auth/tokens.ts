/**
 * Standard HMAC-SHA256 Token Provider.
 * Implements cryptographic signing, verification, algorithm pinning,
 * claim typing, and clock-skew tolerant expiration checks.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { isValidRole, JatayuRole } from './roles.js';

export const SUPPORTED_ALGORITHM = 'HS256';
export const DEFAULT_CLOCK_SKEW_SECONDS = 60;
export const MIN_SECRET_LENGTH = 32;

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  if (typeof str !== 'string' || !str) {
    throw new Error('Invalid base64url string');
  }
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64').toString('utf8');
}

function isValidBase64Url(str: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(str);
}

export interface TokenPayload {
  sub: string;
  role: JatayuRole;
  username?: string;
  rv?: number;
  [key: string]: unknown;
}

export interface VerifiedClaims extends TokenPayload {
  iss?: string;
  aud?: string;
  iat: number;
  exp: number;
}

export interface TokenServiceOptions {
  secret?: string;
  defaultTtlSeconds?: number;
  clockSkewSeconds?: number;
  issuer?: string;
  audience?: string;
  revocationChecker?: ((token: string, payload: VerifiedClaims) => boolean) | null;
}

export interface TokenService {
  sign(payload: TokenPayload, ttlSeconds?: number): string;
  verify(token: string, nowEpochSeconds?: number): VerifiedClaims;
}

export function createTokenService({
  secret = process.env.JWT_SECRET,
  defaultTtlSeconds = 900, // 15 minutes recommended access token TTL
  clockSkewSeconds = DEFAULT_CLOCK_SKEW_SECONDS,
  issuer = 'jatayu-backend',
  audience = 'jatayu-client',
  revocationChecker = null,
}: TokenServiceOptions = {}): TokenService {
  if (!secret || typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`Production security requirement: signing secret must be at least ${MIN_SECRET_LENGTH} characters`);
  }

  return {
    sign(payload: TokenPayload, ttlSeconds = defaultTtlSeconds): string {
      if (!payload || typeof payload !== 'object') {
        throw new TypeError('Token payload must be an object');
      }

      if (!payload.sub || typeof payload.sub !== 'string') {
        throw new Error('Token payload requires a valid "sub" (subject string)');
      }

      if (!payload.role || !isValidRole(payload.role)) {
        throw new Error(`Token payload requires a valid JATAYU role; received: ${String(payload.role)}`);
      }

      const header = {
        alg: SUPPORTED_ALGORITHM,
        typ: 'JWT',
      };

      const now = Math.floor(Date.now() / 1000);
      const claims: VerifiedClaims = {
        iss: issuer,
        aud: audience,
        ...payload,
        iat: now,
        exp: now + ttlSeconds,
      };

      const encodedHeader = base64UrlEncode(JSON.stringify(header));
      const encodedPayload = base64UrlEncode(JSON.stringify(claims));
      const message = `${encodedHeader}.${encodedPayload}`;

      const signature = createHmac('sha256', secret)
        .update(message)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

      return `${message}.${signature}`;
    },

    verify(token: string, nowEpochSeconds = Math.floor(Date.now() / 1000)): VerifiedClaims {
      if (!token || typeof token !== 'string') {
        throw new Error('Token must be a non-empty string');
      }

      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Malformed token format: exactly 3 segments required');
      }

      const [encodedHeader, encodedPayload, signature] = parts;

      if (!isValidBase64Url(encodedHeader) || !isValidBase64Url(encodedPayload)) {
        throw new Error('Malformed token format: invalid base64url segment encoding');
      }

      // 1. Enforce Algorithm HS256 before signature calculation
      let parsedHeader: { alg?: string; typ?: string };
      try {
        parsedHeader = JSON.parse(base64UrlDecode(encodedHeader));
      } catch {
        throw new Error('Malformed token header: invalid JSON');
      }

      if (!parsedHeader || typeof parsedHeader !== 'object') {
        throw new Error('Invalid token header structure');
      }

      if (parsedHeader.alg !== SUPPORTED_ALGORITHM) {
        throw new Error(`Invalid token algorithm: '${String(parsedHeader.alg)}'. Only '${SUPPORTED_ALGORITHM}' is permitted.`);
      }

      if (!signature || !isValidBase64Url(signature)) {
        throw new Error('Malformed token format: invalid base64url segment encoding');
      }

      // 2. Verify signature using constant-time comparison BEFORE trusting payload
      const message = `${encodedHeader}.${encodedPayload}`;
      const expectedSignature = createHmac('sha256', secret)
        .update(message)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expectedSignature);

      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        throw new Error('Invalid token signature');
      }

      // 3. Decode and validate claims
      let payload: VerifiedClaims;
      try {
        payload = JSON.parse(base64UrlDecode(encodedPayload));
      } catch {
        throw new Error('Malformed token payload: invalid JSON');
      }

      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid token payload structure');
      }

      // Validate required claims
      if (!payload.sub || typeof payload.sub !== 'string') {
        throw new Error('Missing or invalid "sub" claim in token');
      }

      if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
        throw new Error('Missing or invalid "exp" claim in token');
      }

      if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat)) {
        throw new Error('Missing or invalid "iat" claim in token');
      }

      // Check future issuance beyond clock-skew tolerance
      if (payload.iat > nowEpochSeconds + clockSkewSeconds) {
        throw new Error(`Token issued in future: iat ${payload.iat} exceeds current time ${nowEpochSeconds} + clock skew ${clockSkewSeconds}s`);
      }

      // Check expiration with clock-skew tolerance
      if (payload.exp < nowEpochSeconds - clockSkewSeconds) {
        throw new Error(`Token has expired at epoch ${payload.exp} (current epoch: ${nowEpochSeconds})`);
      }

      // Optional issuer and audience verification
      if (issuer && payload.iss && payload.iss !== issuer) {
        throw new Error(`Token issuer mismatch: expected '${issuer}', received '${payload.iss}'`);
      }

      if (audience && payload.aud && payload.aud !== audience) {
        throw new Error(`Token audience mismatch: expected '${audience}', received '${payload.aud}'`);
      }

      // Check revocation if checker is supplied
      if (typeof revocationChecker === 'function' && revocationChecker(token, payload)) {
        throw new Error('Token has been revoked');
      }

      return payload;
    },
  };
}
