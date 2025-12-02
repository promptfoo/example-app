import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getPublicKey } from '../utils/jwt-keys';

/**
 * Express middleware to validate JWT Bearer tokens
 * Extracts token from Authorization header and verifies signature using public key
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  try {
    // Extract Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: 'unauthorized',
        error_description: 'Missing Authorization header',
      });
      return;
    }

    // Check for Bearer scheme
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        error: 'unauthorized',
        error_description: 'Invalid Authorization header format. Expected: Bearer <token>',
      });
      return;
    }

    const token = parts[1];

    if (!token) {
      res.status(401).json({
        error: 'unauthorized',
        error_description: 'Missing access token',
      });
      return;
    }

    // Verify JWT token
    const publicKey = getPublicKey();
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
    }) as jwt.JwtPayload;

    // Attach decoded token to request object for use in handlers
    // @ts-ignore
    req.user = decoded;

    next();
  } catch (error) {
    // Check specific error types first (they are subclasses of JsonWebTokenError)
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'unauthorized',
        error_description: 'Token has expired',
      });
      return;
    }

    if (error instanceof jwt.NotBeforeError) {
      res.status(401).json({
        error: 'unauthorized',
        error_description: 'Token not yet valid',
      });
      return;
    }

    // Catch all other JWT errors (including invalid signature, malformed token, etc.)
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: 'unauthorized',
        error_description: 'Invalid or malformed token',
      });
      return;
    }

    console.error('Error in authentication middleware:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Authentication error',
    });
  }
}

