import { createApp } from './app.js';
import { env } from './config/env.js';
import { syncVaultWithDatabase } from './services/vault-sync.js';

const app = createApp();

app.listen(env.PORT, async () => {
  console.log(`MCP Gateway listening on port ${env.PORT}`);
  await syncVaultWithDatabase();
});
