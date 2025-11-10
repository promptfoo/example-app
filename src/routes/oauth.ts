import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getPrivateKey, getPublicKeyJWK } from '../utils/jwt-keys';

interface ClientConfig {
  clientId: string;
  clientSecret: string;
  role: 'readonly' | 'readwrite' | 'admin';
}

// Load client configurations from environment variables
const clients: ClientConfig[] = [
  {
    clientId: process.env.OAUTH_CLIENT_ID_READONLY || '',
    clientSecret: process.env.OAUTH_CLIENT_SECRET_READONLY || '',
    role: 'readonly' as const,
  },
  {
    clientId: process.env.OAUTH_CLIENT_ID_READWRITE || '',
    clientSecret: process.env.OAUTH_CLIENT_SECRET_READWRITE || '',
    role: 'readwrite' as const,
  },
  {
    clientId: process.env.OAUTH_CLIENT_ID_ADMIN || '',
    clientSecret: process.env.OAUTH_CLIENT_SECRET_ADMIN || '',
    role: 'admin' as const,
  },
].filter((client) => client.clientId && client.clientSecret) as ClientConfig[]; // Filter out unconfigured clients

const TOKEN_EXPIRES_IN = parseInt(process.env.OAUTH_TOKEN_EXPIRES_IN || '3600', 10);

/**
 * OAuth 2.0 Token endpoint handler
 * Supports client_credentials grant type
 */
export async function tokenHandler(req: Request, res: Response): Promise<void> {
  try {
    // Validate that at least one client is configured
    if (clients.length === 0) {
      res.status(500).json({
        error: 'server_error',
        error_description: 'OAuth server configuration error: No clients configured',
      });
      return;
    }

    // OAuth token endpoint expects application/x-www-form-urlencoded
    const grantType = req.body.grant_type;
    const clientId = req.body.client_id;
    const clientSecret = req.body.client_secret;
    const scope = req.body.scope;

    // Validate grant_type
    if (!grantType) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameter: grant_type',
      });
      return;
    }

    if (grantType !== 'client_credentials') {
      res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Unsupported grant type',
      });
      return;
    }

    // Validate client_id
    if (!clientId) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameter: client_id',
      });
      return;
    }

    // Validate client_secret
    if (!clientSecret) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameter: client_secret',
      });
      return;
    }

    // Look up client in configuration
    const client = clients.find(
      (c) => c.clientId === clientId && c.clientSecret === clientSecret
    );

    // Authenticate client
    if (!client) {
      res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials',
      });
      return;
    }

    // Generate JWT access token
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + TOKEN_EXPIRES_IN;

    const payload: jwt.JwtPayload = {
      iss: 'example-app', // Issuer
      sub: clientId, // Subject (client_id)
      aud: 'example-app', // Audience
      exp: expiresAt, // Expiration time
      iat: now, // Issued at
      role: client.role, // Role based on authenticated client
    };

    // Add scope if provided
    if (scope) {
      payload.scope = scope;
    }

    const privateKey = getPrivateKey();
    const accessToken = jwt.sign(payload, privateKey, {
      algorithm: 'RS256',
    });

    // Return OAuth token response
    const response: {
      access_token: string;
      token_type: string;
      expires_in: number;
      scope?: string;
    } = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: TOKEN_EXPIRES_IN,
    };

    if (scope) {
      response.scope = scope;
    }

    res.json(response);
  } catch (error) {
    console.error('Error in token handler:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * JWKS (JSON Web Key Set) discovery endpoint handler
 * Returns public keys in JWKS format for token verification
 */
export async function jwksHandler(req: Request, res: Response): Promise<void> {
  try {
    const jwks = getPublicKeyJWK();
    res.json(jwks);
  } catch (error) {
    console.error('Error in JWKS handler:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

