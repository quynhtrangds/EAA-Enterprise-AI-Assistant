import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncVaultWithDatabase } from './vault-sync.js';
import { VaultService } from './vault.js';
import { query } from '../db/pool.js';

vi.mock('../db/pool.js', () => ({
  query: vi.fn()
}));

vi.mock('./vault.js', () => ({
  VaultService: {
    readSecret: vi.fn(),
    writeSecret: vi.fn()
  }
}));

describe('syncVaultWithDatabase', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('không ghi đè secret nếu Vault đã có apiKey của người dùng', async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          tenant_id: 'tenant-1',
          integration_code: 'erpnext',
          api_url: 'http://frontend:8080',
          api_key: 'stale_old_key_from_db'
        }
      ]
    } as any);

    // Vault đã có key do user lưu
    vi.mocked(VaultService.readSecret).mockResolvedValueOnce({
      apiKey: 'fresh_user_saved_key',
      apiUrl: 'http://frontend:8080'
    });

    await syncVaultWithDatabase();

    // Tuyệt đối không được gọi writeSecret
    expect(VaultService.writeSecret).not.toHaveBeenCalled();
  });

  it('khởi tạo secret vào Vault nếu Vault chưa từng có secret (fresh boot)', async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          tenant_id: 'tenant-1',
          integration_code: 'gitea',
          api_url: 'http://gitea:3000',
          api_key: 'initial_gitea_token'
        }
      ]
    } as any);

    // Vault trả về null (chưa có secret)
    vi.mocked(VaultService.readSecret).mockResolvedValueOnce(null);
    vi.mocked(VaultService.writeSecret).mockResolvedValueOnce({} as any);

    await syncVaultWithDatabase();

    expect(VaultService.writeSecret).toHaveBeenCalledWith(
      'integrations/tenant-1/gitea',
      {
        apiKey: 'initial_gitea_token',
        apiUrl: 'http://gitea:3000'
      }
    );
  });
});
