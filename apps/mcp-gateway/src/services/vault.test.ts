import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VaultService } from './vault.js';

describe('VaultService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-VAULT-01: Ghi secret vào Vault thành công', async () => {
    const mockData = { apiKey: 'test_token', apiUrl: 'http://localhost:8080' };
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { data: mockData } })
    });

    const result = await VaultService.writeSecret('integrations/tenant-1/zammad', mockData);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/secret/data/integrations/tenant-1/zammad'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Vault-Token': 'root',
          'Content-Type': 'application/json'
        })
      })
    );
    expect(result).toBeDefined();
  });

  it('TC-VAULT-02: Đọc secret từ Vault thành công', async () => {
    const mockSecret = { apiKey: 'gitea_token', apiUrl: 'http://localhost:3001' };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          data: mockSecret
        }
      })
    });

    const data = await VaultService.readSecret('integrations/tenant-1/gitea');
    expect(data).toEqual(mockSecret);
  });

  it('TC-VAULT-03: Trả về null khi secret không tồn tại (404)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404
    });

    const data = await VaultService.readSecret('integrations/non-existent');
    expect(data).toBeNull();
  });
});
