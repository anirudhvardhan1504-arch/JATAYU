import { Request, Response, NextFunction } from 'express';

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipInTest?: boolean;
}

interface ClientRecord {
  timestamps: number[];
}

export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests. Please slow down.',
    skipInTest = true,
  } = options;

  const clients = new Map<string, ClientRecord>();

  // Periodically clean up expired entries every 5 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of clients.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < windowMs);
      if (record.timestamps.length === 0) {
        clients.delete(ip);
      }
    }
  }, 5 * 60 * 1000);

  // Unref interval so it doesn't block node process exit
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    if (skipInTest && process.env.NODE_ENV === 'test') {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let record = clients.get(ip);
    if (!record) {
      record = { timestamps: [] };
      clients.set(ip, record);
    }

    // Filter out timestamps outside window
    record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

    if (record.timestamps.length >= maxRequests) {
      const oldest = record.timestamps[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));

      res.setHeader('Retry-After', retryAfterSeconds.toString());
      res.status(429).json({
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterSeconds,
      });
      return;
    }

    record.timestamps.push(now);
    next();
  };
}

// Preconfigured limiters
export const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 180, // 180 requests / min
  message: 'API rate limit exceeded. Please wait a moment before sending more requests.',
});

export const authApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30, // 30 requests / min
  message: 'Authentication rate limit exceeded. Too many login attempts.',
  skipInTest: false, // active in test so brute-force protection can be verified
});

export const heavyComputeLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60, // 60 routing / AI calls / min
  message: 'Heavy compute rate limit exceeded. Please try again shortly.',
});
