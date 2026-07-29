import { describe, it, expect, beforeEach } from 'vitest';
import { McpClientManager } from './mcp-client-manager.js';

// Không cần spin lên MCP server thật (stdio) — chỉ cần verify logic
// bypass-masking-theo-role trong callTool(), nên inject 1 fake client
// giả lập response trả về từ tool 'get_order_detail'.
function buildManagerWithFakeClient(rawText: object) {
  const manager = new McpClientManager();
  const fakeClient = {
    callTool: async () => ({
      content: [{ type: 'text', text: JSON.stringify(rawText) }]
    })
  };
  (manager as any).clients.set('postgres', fakeClient);
  manager.toolToServerMap.set('get_order_detail', 'postgres');
  return manager;
}

describe('McpClientManager.callTool - role-based PII masking', () => {
  const orderDetail = {
    customer_name: 'Nguyen Van A',
    customer_address: '123 Le Loi Street, District 1, HCMC',
    customer_email: 'a@example.com'
  };

  it('masks PII for roles without bypass (staff, viewer, or no role)', async () => {
    const manager = buildManagerWithFakeClient(orderDetail);

    for (const roles of [['staff'], ['viewer'], []]) {
      const result = await manager.callTool('get_order_detail', {}, roles);
      const parsed = JSON.parse(((result as any).content[0]).text);
      expect(parsed.customer_address).toBe('***');
      expect(parsed.customer_name).not.toBe('Nguyen Van A');
    }
  });

  it('does NOT mask PII for admin or manager roles', async () => {
    const manager = buildManagerWithFakeClient(orderDetail);

    for (const roles of [['admin'], ['manager'], ['staff', 'manager']]) {
      const result = await manager.callTool('get_order_detail', {}, roles);
      const parsed = JSON.parse(((result as any).content[0]).text);
      expect(parsed.customer_address).toBe('123 Le Loi Street, District 1, HCMC');
      expect(parsed.customer_name).toBe('Nguyen Van A');
    }
  });

  it('defaults to masking when no roles are provided (fail-safe)', async () => {
    const manager = buildManagerWithFakeClient(orderDetail);
    const result = await manager.callTool('get_order_detail', {});
    const parsed = JSON.parse(((result as any).content[0]).text);
    expect(parsed.customer_address).toBe('***');
  });
});
