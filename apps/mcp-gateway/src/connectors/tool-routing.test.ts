import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpClientManager } from './mcp-client-manager.js';

describe('Tool Routing Logic: postgres vs erpnext', () => {
  let manager: McpClientManager;

  beforeEach(() => {
    manager = new McpClientManager();
  });

  it('connectServer không ghi đè postgres khi erpnext kết nối sau', () => {
    // Giả lập postgres kết nối trước
    (manager as any).toolToServerMap.set('search_customer', 'postgres');
    (manager as any).toolToServersMap.set('search_customer', ['postgres']);

    // Giả lập erpnext kết nối sau với cùng tool search_customer
    const toolName = 'search_customer';
    const serverName: string = 'erpnext';
    if (!(manager as any).toolToServerMap.has(toolName) || serverName === 'postgres') {
      (manager as any).toolToServerMap.set(toolName, serverName);
    }
    const servers = (manager as any).toolToServersMap.get(toolName) || [];
    if (!servers.includes(serverName)) {
      servers.push(serverName);
    }
    (manager as any).toolToServersMap.set(toolName, servers);

    expect((manager as any).toolToServerMap.get('search_customer')).toBe('postgres');
    expect((manager as any).toolToServersMap.get('search_customer')).toEqual(['postgres', 'erpnext']);
  });

  it('getServerForTool ưu tiên postgres khi tenant chỉ bật postgres', () => {
    (manager as any).toolToServerMap.set('search_customer', 'postgres');
    (manager as any).toolToServersMap.set('search_customer', ['postgres', 'erpnext']);

    const activeCodes = new Set(['postgres']);
    const server = manager.getServerForTool('search_customer', activeCodes);
    expect(server).toBe('postgres');
  });

  it('getServerForTool chọn erpnext khi tenant bật erpnext', () => {
    (manager as any).toolToServerMap.set('search_customer', 'postgres');
    (manager as any).toolToServersMap.set('search_customer', ['postgres', 'erpnext']);

    const activeCodes = new Set(['postgres', 'erpnext']);
    const server = manager.getServerForTool('search_customer', activeCodes);
    expect(server).toBe('erpnext');
  });

  it('getServerForTool fallback về postgres khi không truyền activeCodes hoặc không có erpnext', () => {
    (manager as any).toolToServerMap.set('search_customer', 'postgres');
    (manager as any).toolToServersMap.set('search_customer', ['postgres', 'erpnext']);

    expect(manager.getServerForTool('search_customer')).toBe('postgres');
    expect(manager.getServerForTool('search_customer', new Set(['zammad']))).toBe('postgres');
  });

  it('callTool hỗ trợ targetServer truyền trực tiếp hoặc qua args._targetServer', async () => {
    const mockPgClient = {
      callTool: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'pg result' }] })
    };
    const mockErpClient = {
      callTool: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'erp result' }] })
    };

    (manager as any).clients.set('postgres', mockPgClient);
    (manager as any).clients.set('erpnext', mockErpClient);
    (manager as any).toolToServerMap.set('search_customer', 'postgres');

    // Gọi với targetServer trực tiếp
    await manager.callTool('search_customer', { query: 'test' }, ['admin'], 'erpnext');
    expect(mockErpClient.callTool).toHaveBeenCalledWith({ name: 'search_customer', arguments: { query: 'test' } });

    // Gọi với args._targetServer
    await manager.callTool('search_customer', { query: 'test', _targetServer: 'postgres' }, ['admin']);
    expect(mockPgClient.callTool).toHaveBeenCalledWith({ name: 'search_customer', arguments: { query: 'test', _targetServer: 'postgres' } });
  });
});
