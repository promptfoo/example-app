import crypto from 'crypto';

interface KeyPair {
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
  kid: string;
}

let keyPair: KeyPair | null = null;

/**
 * Generate RSA 2048-bit key pair and store in memory
 */
export function generateRSAKeyPair(): void {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  // Generate a stable key ID based on public key fingerprint
  const publicKeyBuffer = crypto.createPublicKey(publicKey);
  const publicKeyDer = publicKeyBuffer.export({ type: 'spki', format: 'der' });
  const fingerprint = crypto.createHash('sha256').update(publicKeyDer).digest('hex');
  const kid = fingerprint.substring(0, 16); // Use first 16 chars as kid

  keyPair = {
    privateKey: crypto.createPrivateKey(privateKey),
    publicKey: publicKeyBuffer,
    kid,
  };
}

/**
 * Get the private key for signing JWTs
 */
export function getPrivateKey(): crypto.KeyObject {
  if (!keyPair) {
    throw new Error('Key pair not initialized. Call generateRSAKeyPair() first.');
  }
  return keyPair.privateKey;
}

/**
 * Get the public key for verifying JWTs
 */
export function getPublicKey(): crypto.KeyObject {
  if (!keyPair) {
    throw new Error('Key pair not initialized. Call generateRSAKeyPair() first.');
  }
  return keyPair.publicKey;
}

/**
 * Get the public key in JWKS format
 */
export function getPublicKeyJWK(): {
  keys: Array<{
    kty: string;
    use: string;
    kid: string;
    n: string;
    e: string;
  }>;
} {
  if (!keyPair) {
    throw new Error('Key pair not initialized. Call generateRSAKeyPair() first.');
  }

  // Export public key as JWK
  const jwk = keyPair.publicKey.export({ format: 'jwk' }) as crypto.JsonWebKey;

  // Convert base64url to base64url (already in correct format)
  // Ensure n and e are base64url encoded strings
  const n = jwk.n || '';
  const e = jwk.e || '';

  return {
    keys: [
      {
        kty: 'RSA',
        use: 'sig',
        kid: keyPair.kid,
        n,
        e,
      },
    ],
  };
}

