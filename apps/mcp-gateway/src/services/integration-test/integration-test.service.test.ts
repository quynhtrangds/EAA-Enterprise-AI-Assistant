import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  return {
    query: vi.fn(),
    writeAuditLog: vi.fn().mockResolvedValue(undefined),
    VaultService: { readSecret: vi.fn(), writeSecret: vi.fn() },
    mcpClientManager: {
      isConnected: vi.fn().mockReturnValue(true),
      ping: vi.fn().mockResolvedValue(true),
      getConfiguredServerNames: vi.fn().mockReturnValue(['gitea', 'erpnext', 'zammad', 'crm', 'rag', 'postgres'])
    },
    dnsLookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
  };
});

vi.mock('../../db/pool.js', () => ({ query: mocks.query }));
vi.mock('../../audit/audit-log.js', () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock('../../services/vault.js', () => ({ VaultService: mocks.VaultService }));
vi.mock('../../connectors/mcp-client-manager.js', () => ({ mcpClientManager: mocks.mcpClientManager }));
vi.mock('node:dns/promises', () => ({ default: { lookup: mocks.dnsLookup }, lookup: mocks.dnsLookup }));

vi.mock('node:net', async (importOriginal) => {
  const { EventEmitter } = await import('node:events');
  class MockSocket extends EventEmitter {
    setTimeout = vi.fn();
    destroy = vi.fn();
    connect = vi.fn().mockImplementation((_port: any, _host: any) => {
      process.nextTick(() => this.emit('connect'));
      return this;
    });
  }
  return {
    default: { Socket: MockSocket },
    Socket: MockSocket
  };
});

vi.mock('node:tls', async () => {
  const { EventEmitter } = await import('node:events');
  return {
    default: {
      connect: vi.fn().mockImplementation((_opts: any, cb: any) => {
        const emitter = new EventEmitter() as any;
        emitter.destroy = vi.fn();
        emitter.getProtocol = vi.fn().mockReturnValue('TLSv1.3');
        emitter.getCipher = vi.fn().mockReturnValue({ name: 'TLS_AES_256_GCM_SHA384' });
        emitter.getPeerCertificate = vi.fn().mockReturnValue({
          valid_to: new Date(Date.now() + 365 * 86400000).toUTCString(),
          issuer: { O: 'Let\'s Encrypt', CN: 'R3' }
        });
        if (cb) process.nextTick(cb);
        return emitter;
      })
    }
  };
});

import { IntegrationTestService } from './integration-test.service.js';
import { AppError } from '../../errors/app-error.js';

describe('IntegrationTestService', () => {
  const tenantId = 'tenant-uuid-001';
  const userId = 'user-admin-001';

  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.query.mockReset();
    mocks.writeAuditLog.mockReset().mockResolvedValue(undefined);
    mocks.VaultService.readSecret.mockReset();
    mocks.mcpClientManager.isConnected.mockReturnValue(true);
    mocks.mcpClientManager.ping.mockResolvedValue(true);
    mocks.mcpClientManager.getConfiguredServerNames.mockReturnValue(['gitea', 'erpnext', 'zammad', 'crm', 'rag', 'postgres']);
    mocks.dnsLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });

  describe('testSaved', () => {
    it('ném lỗi 404 NOT_FOUND khi integration chưa được lưu trong DB', async () => {
      mocks.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        IntegrationTestService.testSaved(tenantId, 'gitea', userId)
      ).rejects.toThrowError(AppError);
    });

    it('test saved integration thành công toàn bộ các bước (overallStatus = passed)', async () => {
      const dbRow = {
        id: 'int-001',
        tenant_id: tenantId,
        integration_code: 'gitea',
        vault_path: `integrations/${tenantId}/gitea`,
        api_url: 'https://gitea.example.com',
        is_active: true
      };

      mocks.query.mockResolvedValueOnce({ rows: [dbRow] });
      mocks.VaultService.readSecret.mockResolvedValueOnce({
        apiUrl: 'https://gitea.example.com',
        apiKey: 'token_valid_123'
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ login: 'admin_user', id: 1 })
      }));

      try {
        const result = await IntegrationTestService.testSaved(tenantId, 'gitea', userId);

        expect(result.integrationCode).toBe('gitea');
        expect(result.overallStatus).toBe('passed');
        expect(result.steps.length).toBeGreaterThan(0);

        const configStep = result.steps.find((s) => s.step === 'config');
        expect(configStep?.status).toBe('passed');

        const vaultStep = result.steps.find((s) => s.step === 'vault');
        expect(vaultStep?.status).toBe('passed');

        const httpStep = result.steps.find((s) => s.step === 'http');
        expect(httpStep?.status).toBe('passed');

        // Phải cập nhật kết quả vào database
        expect(mocks.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE tenant_integrations'),
          expect.arrayContaining(['passed', expect.any(String), tenantId, 'gitea'])
        );

        // Phải ghi audit log
        expect(mocks.writeAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({
            userId,
            toolName: 'integration:test:gitea',
            status: 'success'
          })
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('báo lỗi 401 với hint tiếng Việt rõ ràng khi API Token sai hoặc hết hạn', async () => {
      const dbRow = {
        id: 'int-001',
        tenant_id: tenantId,
        integration_code: 'gitea',
        vault_path: `integrations/${tenantId}/gitea`,
        api_url: 'https://gitea.example.com',
        is_active: true
      };

      mocks.query.mockResolvedValueOnce({ rows: [dbRow] });
      mocks.VaultService.readSecret.mockResolvedValueOnce({
        apiUrl: 'https://gitea.example.com',
        apiKey: 'token_expired_invalid'
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async () => ({
        ok: false,
        status: 401,
        headers: new Headers(),
        text: async () => 'Unauthorized'
      }));

      try {
        const result = await IntegrationTestService.testSaved(tenantId, 'gitea', userId);

        expect(result.overallStatus).toBe('failed');
        const httpStep = result.steps.find((s) => s.step === 'http');
        expect(httpStep?.status).toBe('failed');
        expect(httpStep?.error?.code).toBe('AUTH_INVALID_CREDENTIALS');
        expect(httpStep?.error?.hint).toContain('Gitea');

        // Các bước sau HTTP phải bị skipped
        const businessStep = result.steps.find((s) => s.step === 'business');
        expect(businessStep?.status).toBe('skipped');
        expect(businessStep?.skipReason).toBe('previous_step_failed');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('testDraft', () => {
    it('báo lỗi ở ConfigProbe khi thiếu apiUrl đối với dịch vụ remote', async () => {
      const result = await IntegrationTestService.testDraft(
        tenantId,
        { integrationCode: 'gitea', apiUrl: '' },
        userId
      );

      expect(result.overallStatus).toBe('failed');
      const configStep = result.steps.find((s) => s.step === 'config');
      expect(configStep?.status).toBe('failed');
      expect(configStep?.error?.code).toBe('INTEGRATION_NOT_CONFIGURED');
    });

    it('chạy draft test thành công khi truyền đủ apiUrl và apiKey hợp lệ', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ message: 'admin' })
      }));

      try {
        const result = await IntegrationTestService.testDraft(
          tenantId,
          {
            integrationCode: 'erpnext',
            apiUrl: 'https://erp.company.com',
            apiKey: 'key123:sec456'
          },
          userId
        );

        expect(result.integrationCode).toBe('erpnext');
        expect(result.overallStatus).toBe('passed');
        expect(mocks.writeAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({
            toolName: 'integration:test-draft:erpnext',
            status: 'success'
          })
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('internal connectors (postgres, crm, rag)', () => {
    it('connector postgres bỏ qua probe mạng và thực thi query test thành công', async () => {
      mocks.query.mockResolvedValueOnce({ rows: [{ ping: 1 }] });

      const result = await IntegrationTestService.testDraft(
        tenantId,
        { integrationCode: 'postgres' },
        userId
      );

      expect(result.overallStatus).toBe('passed');

      const dnsStep = result.steps.find((s) => s.step === 'dns');
      expect(dnsStep?.status).toBe('skipped');

      const businessStep = result.steps.find((s) => s.step === 'business');
      expect(businessStep?.status).toBe('passed');
      expect(businessStep?.detail?.database).toBe('PostgreSQL Core');
    });
  });
});
