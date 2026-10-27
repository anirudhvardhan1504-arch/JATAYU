import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { config } from '../config.js';

export interface AppError extends Error {
  statusCode?: number;
  status?: number;
  code?: string;
  details?: unknown;
}

export const errorHandler: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // If response headers have already been sent, delegate to standard Express handler
  if (res.headersSent) {
    return next(err);
  }

  // Determine HTTP status code
  let statusCode = err.statusCode || err.status || 500;
  let code = err.code;

  if (err.message && (err.message.includes('CORS policy violation') || err.message.includes('Not allowed by CORS'))) {
    statusCode = 403;
    code = 'CORS_FORBIDDEN';
  } else if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    statusCode = 400;
    code = 'INVALID_JSON';
  }

  // Map fallback error codes if unset
  if (!code) {
    switch (statusCode) {
      case 400:
        code = 'BAD_REQUEST';
        break;
      case 401:
        code = 'AUTH_REQUIRED';
        break;
      case 403:
        code = 'FORBIDDEN';
        break;
      case 404:
        code = 'NOT_FOUND';
        break;
      case 429:
        code = 'RATE_LIMITED';
        break;
      default:
        code = statusCode >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
    }
  }

  // Production vs Non-Production message sanitization
  let message = err.message || 'An unexpected error occurred';
  if (config.nodeEnv === 'production' && statusCode >= 500) {
    message = 'An internal server error occurred. Please contact system support.';
  }

  // Safe server logging: Never log passwords, tokens, or sensitive headers
  if (statusCode >= 500) {
    console.error(
      `[JATAYU Error] ${req.method} ${req.path} - Status ${statusCode} - ${err.name || 'Error'}: ${err.message}`
    );
  }

  res.status(statusCode).json({
    error: message,
    code,
    timestamp: new Date().toISOString(),
  });
};
