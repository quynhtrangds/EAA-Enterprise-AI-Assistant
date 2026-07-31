import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const HASH_PREFIX = 'scrypt';

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  return `${HASH_PREFIX}$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
}

export async function verifyPassword(password: string, storedHash: string | null): Promise<boolean> {
  if (!storedHash) {
    return false;
  }

  const [prefix, encodedSalt, encodedKey] = storedHash.split('$');
  if (prefix !== HASH_PREFIX || !encodedSalt || !encodedKey) {
    return false;
  }

  try {
    const salt = Buffer.from(encodedSalt, 'base64url');
    const expectedKey = Buffer.from(encodedKey, 'base64url');
    if (salt.length === 0 || expectedKey.length !== KEY_LENGTH) {
      return false;
    }

    const derivedKey = await scrypt(password, salt, KEY_LENGTH) as Buffer;
    return timingSafeEqual(derivedKey, expectedKey);
  } catch {
    return false;
  }
}
