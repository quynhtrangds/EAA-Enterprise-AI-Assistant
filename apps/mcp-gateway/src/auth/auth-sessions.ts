import { randomBytes } from 'node:crypto';
import { query } from '../db/pool.js';

const SESSION_TTL_HOURS = 24;

let ensureAuthSessionsTablePromise: Promise<void> | null = null;

export interface AuthenticatedSessionUser {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
}

interface AuthSessionUserRow {
  user_id: string;
  username: string;
  display_name: string;
  roles: string[];
}

export async function ensureAuthSessionsTable(): Promise<void> {
  ensureAuthSessionsTablePromise ??= query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token TEXT NOT NULL UNIQUE,
      user_id UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
      roles TEXT[] NOT NULL DEFAULT '{}',
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
  `).then(() => undefined);

  return ensureAuthSessionsTablePromise;
}

export async function createAuthSession(userId: string, roles: string[]): Promise<{ token: string; expiresAt: string }> {
  await ensureAuthSessionsTable();

  const token = randomBytes(32).toString('hex');
  const result = await query<{ expires_at: string }>(
    `
    INSERT INTO auth_sessions (token, user_id, roles, expires_at)
    VALUES ($1, $2, $3, now() + ($4::int * INTERVAL '1 hour'))
    RETURNING expires_at
    `,
    [token, userId, roles, SESSION_TTL_HOURS]
  );
  const session = result.rows[0];
  if (!session) {
    throw new Error('Failed to create auth session.');
  }

  return {
    token,
    expiresAt: session.expires_at
  };
}

export async function getUserByToken(token: string): Promise<AuthenticatedSessionUser | null> {
  await ensureAuthSessionsTable();

  const result = await query<AuthSessionUserRow>(
    `
    SELECT
      s.user_id,
      u.username,
      u.display_name,
      s.roles
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND u.status = 'active'
    LIMIT 1
    `,
    [token]
  );

  const user = result.rows[0];
  if (!user) {
    return null;
  }

  return {
    id: user.user_id,
    username: user.username,
    displayName: user.display_name,
    roles: user.roles
  };
}
