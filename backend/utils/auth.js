import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Retrieves and validates the cryptographic session secret from environment variables.
 * Fails safely with a clear configuration error if the secret is missing or insecure,
 * ensuring no predictable or hardcoded fallback is ever used.
 */
function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim().length < 32) {
    throw new Error(
      'CONFIG_ERROR: SESSION_SECRET is missing or insufficiently secure. ' +
      'Please configure a strong SESSION_SECRET (at least 32 characters) in backend/.env.'
    );
  }
  return secret.trim();
}

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Creates a cryptographically signed session token (standard HMAC-SHA256 JWT).
 * Payload contains user id, email, role, and name.
 */
export function signSessionToken(payload, expiresInSeconds = 7 * 24 * 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const secret = getSessionSecret();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${dataToSign}.${signature}`;
}

/**
 * Verifies a cryptographically signed session token.
 * Returns decoded payload if valid and unexpired; otherwise throws an Error.
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token is missing or invalid');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed token');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const secret = getSessionSecret();
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  // Constant-time comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedSigBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)) {
    throw new Error('Invalid token signature');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    throw new Error('Session token has expired');
  }

  return payload;
}

/**
 * Express middleware to authenticate requests via Bearer token.
 * Sets req.user = { id, email, role, name } upon success.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in to continue.',
    });
  }

  const token = authHeader.slice(7).trim();
  try {
    const decoded = verifySessionToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: `Invalid or expired session: ${err.message}`,
    });
  }
}
