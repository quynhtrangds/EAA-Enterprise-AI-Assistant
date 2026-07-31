import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './passwords.js';

describe('password hashing', () => {
  it('verifies the original password but rejects another password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');

    await expect(verifyPassword('correct-horse-battery-staple', hash)).resolves.toBe(true);
    await expect(verifyPassword('incorrect-password', hash)).resolves.toBe(false);
  });

  it('rejects plaintext and malformed stored values', async () => {
    await expect(verifyPassword('admin123', 'admin123')).resolves.toBe(false);
    await expect(verifyPassword('admin123', 'scrypt$not-a-valid-salt$not-a-valid-key')).resolves.toBe(false);
  });
});
