import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  cors: {
    allowedOrigins: string[];
  };
  openRouter: {
    apiKey: string | null;
    model: string;
    baseUrl: string;
  };
  weather: {
    baseUrl: string;
  };
  auth: {
    jwtSecret: string;
    jwtTtlSeconds: number;
    dbPath: string;
    trustProxy: boolean;
  };
}

const nodeEnv = process.env.NODE_ENV || 'development';
const rawJwtSecret = process.env.JWT_SECRET?.trim();
const rawCorsOrigin = process.env.CORS_ORIGIN?.trim();

export function parseAllowedOrigins(corsOriginEnv?: string, env = nodeEnv): string[] {
  const defaultDevOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ];

  if (!corsOriginEnv || corsOriginEnv.trim().length === 0) {
    if (env === 'production') {
      throw new Error(
        'Production security requirement: CORS_ORIGIN environment variable is required and must specify allowed origin(s)'
      );
    }
    return defaultDevOrigins;
  }

  const origins = corsOriginEnv
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (env === 'production') {
    if (origins.length === 0 || origins.includes('*')) {
      throw new Error(
        'Production security requirement: Wildcard (*) or empty CORS_ORIGIN is prohibited in production'
      );
    }
  }

  return origins;
}

if (nodeEnv === 'production') {
  if (!rawJwtSecret || rawJwtSecret.length < 32) {
    throw new Error('Production security requirement: JWT_SECRET environment variable of at least 32 characters is required');
  }
  // Validate production CORS
  parseAllowedOrigins(rawCorsOrigin, 'production');
}

// In non-production environments, if JWT_SECRET is unset, use a designated local development fallback
const jwtSecret = rawJwtSecret || 'jatayu-development-local-only-jwt-secret-min-32-chars';
const allowedOrigins = parseAllowedOrigins(rawCorsOrigin, nodeEnv);

const defaultDbPath = path.join(process.cwd(), 'data', 'jatayu_auth.db');
const dbPath = process.env.JATAYU_AUTH_DB?.trim() || defaultDbPath;

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv,
  cors: {
    allowedOrigins,
  },
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY?.trim() || null,
    model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet:beta',
    baseUrl: 'https://openrouter.ai/api/v1',
  },
  weather: {
    baseUrl: process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com/v1',
  },
  auth: {
    jwtSecret,
    jwtTtlSeconds: parseInt(process.env.JWT_TTL_SECONDS || '900', 10),
    dbPath,
    trustProxy: process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1',
  },
};
