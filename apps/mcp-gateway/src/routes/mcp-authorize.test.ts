import { describe, it, expect, vi, beforeEach } from 'vitest';

const { canExecuteTool, checkToolRateLimit, readSecret, query } = vi.hoisted(() => ({
  canExecuteTool: vi.fn(),
  checkToolRateLimit: vi.fn(),
  readSecret: vi.fn(),
  query: vi.fn()
}));

vi.mock('../policies/tool-permissions.js', () => ({ canExecuteTool }));
vi.mock('../policies/rate-limiter.js', () => ({ checkToolRateLimit }));
vi.mock('../services/vault.js', () => ({ VaultService: { readSecret } }));
vi.mock('../db/pool.js', () => ({ query }));
vi.mock('../connectors/mcp-client-manager.js', () => ({
  mcpClientManager: {
    initialize: vi.fn().mockResolvedValue(undefined),
    toolToServerMap: new Map([['erpnext_get_invoice', 'erpnext'], ['search_customer', undefined]])
  }
}));

const { authorizeAndPrepareToolRequest } = await import('./mcp.js');
const { mcpClientManager } = await import('../connectors/mcp-client-manager.js');

const baseUser = {
  id: 'user-1',
  username: 'staff',
  displayName: 'Staff',
  roles: ['staff'],
  tenantId: 'tenant-1'
};

describe('routes/mcp.ts: authorizeAndPrepareToolRequest', () => {
  beforeEach(() => {
    canExecuteTool.mockReset().mockResolvedValue(true);
    checkToolRateLimit.mockReset();
    readSecret.mockReset().mockResolvedValue(null);
    query.mockReset().mockResolvedValue({ rows: [] });
  });

  it('bỏ qua hoàn toàn nếu request không phải tools/call (vd tools/list)', async () => {
    await authorizeAndPrepareToolRequest(baseUser, { method: 'tools/list' });
    expect(canExecuteTool).not.toHaveBeenCalled();
  });

  it('bỏ qua nếu tools/call nhưng thiếu params.name', async () => {
    await authorizeAndPrepareToolRequest(baseUser, { method: 'tools/call', params: {} });
    expect(canExecuteTool).not.toHaveBeenCalled();
  });

  it('ném PERMISSION_DENIED 403 nếu role không được phép gọi tool', async () => {
    canExecuteTool.mockResolvedValue(false);
    await expect(
      authorizeAndPrepareToolRequest(baseUser, { method: 'tools/call', params: { name: 'search_customer' } })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED', statusCode: 403 });
    expect(checkToolRateLimit).not.toHaveBeenCalled();
  });

  it('gọi checkToolRateLimit đúng userId + toolName khi được phép', async () => {
    await authorizeAndPrepareToolRequest(baseUser, { method: 'tools/call', params: { name: 'search_customer' } });
    expect(checkToolRateLimit).toHaveBeenCalledWith('user-1', 'search_customer');
  });

  it('không tra Vault/DB nếu tool không thuộc server tích hợp nào (serverName undefined)', async () => {
    await authorizeAndPrepareToolRequest(baseUser, { method: 'tools/call', params: { name: 'search_customer' } });
    expect(readSecret).not.toHaveBeenCalled();
  });

  it('chuyển sang _mockMode khi tích hợp đang bị TẮT trong DB (không còn chặn cứng)', async () => {
    query.mockResolvedValueOnce({ rows: [{ is_active: false }] });
    const request = { method: 'tools/call', params: { name: 'erpnext_get_invoice', arguments: {} } };
    await authorizeAndPrepareToolRequest(baseUser, request);
    expect(request.params.arguments).toMatchObject({ _mockMode: true });
    expect(readSecret).not.toHaveBeenCalled();
  });

  it('inject _integrationCredentials từ Vault khi tích hợp đang bật', async () => {
    query.mockResolvedValueOnce({ rows: [{ is_active: true }] });
    readSecret.mockResolvedValue({ apiUrl: 'https://erp.example.com', apiKey: 'secret-key' });

    const request = { method: 'tools/call', params: { name: 'erpnext_get_invoice', arguments: { invoiceId: 'INV1' } } };
    await authorizeAndPrepareToolRequest(baseUser, request);

    expect(request.params.arguments).toMatchObject({
      invoiceId: 'INV1',
      _integrationCredentials: { apiUrl: 'https://erp.example.com', apiKey: 'secret-key' }
    });
  });

  it('chuyển sang _mockMode nếu Vault chưa có đủ URL và API key', async () => {
    query.mockResolvedValueOnce({ rows: [{ is_active: true }] });
    readSecret.mockResolvedValue(null);

    const request = { method: 'tools/call', params: { name: 'erpnext_get_invoice', arguments: { a: 1 } } };
    await authorizeAndPrepareToolRequest(baseUser, request);
    expect(request.params.arguments).toMatchObject({ a: 1, _mockMode: true });
  });

  it('không tra cứu tenant integration nếu user không có tenantId', async () => {
    await authorizeAndPrepareToolRequest(
      { ...baseUser, tenantId: '' },
      { method: 'tools/call', params: { name: 'erpnext_get_invoice' } }
    );
    expect(query).not.toHaveBeenCalled();
  });
});
