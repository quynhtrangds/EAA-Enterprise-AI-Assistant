import { query } from '../db/pool.js';
import { VaultService } from './vault.js';

export async function syncVaultWithDatabase(): Promise<void> {
  try {
    const res = await query<{ tenant_id: string; integration_code: string; api_url: string; api_key: string }>(
      `SELECT tenant_id, integration_code, api_url, api_key FROM tenant_integrations WHERE api_key IS NOT NULL AND api_key <> ''`
    );

    await Promise.all(
      res.rows.map(async (row) => {
        const vaultPath = `integrations/${row.tenant_id}/${row.integration_code}`;
        try {
          // Chỉ khởi tạo vào Vault nếu Vault chưa từng có secret
          // Tuyệt đối không ghi đè cấu hình hoặc API Key mà người dùng đã lưu trong Vault
          const existing = await VaultService.readSecret(vaultPath);
          if (existing && (existing.apiKey || existing.apiUrl)) {
            return;
          }

          await VaultService.writeSecret(vaultPath, {
            apiKey: row.api_key,
            apiUrl: row.api_url
          });
          console.log(`[Vault Auto-Sync] Initialized missing secret for ${vaultPath} into Vault.`);
        } catch (e: any) {
          console.warn(`[Vault Auto-Sync Error for ${vaultPath}]:`, e.message);
        }
      })
    );
  } catch (err: any) {
    console.warn(`[Vault Auto-Sync Global Warning]:`, err.message);
  }
}
