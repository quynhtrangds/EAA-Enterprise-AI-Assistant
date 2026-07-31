const { randomBytes, scrypt } = require('node:crypto');
const { promisify } = require('node:util');
const pg = require('pg');

const hash = async (password) => {
  const salt = randomBytes(16);
  const derivedKey = await promisify(scrypt)(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
};

const legacyDemoAccounts = [
  { username: 'admin', password: 'admin123' },
  { username: 'manager', password: 'manager123' },
  { username: 'staff', password: 'staff123' },
  { username: 'viewer', password: 'viewer123' }
];

async function migratePasswordHashes() {
  const pool = new pg.Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 55432),
    database: process.env.POSTGRES_DB || 'enterprise_ai_demo',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres'
  });

  try {
    for (const account of legacyDemoAccounts) {
      const passwordHash = await hash(account.password);
      await pool.query(
        `UPDATE users
         SET password_hash = $1
         WHERE username = $2
           AND password_hash = $3`,
        [passwordHash, account.username, account.password]
      );
    }
    console.log('Legacy demo password hashes migrated.');
  } finally {
    await pool.end();
  }
}

migratePasswordHashes().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
