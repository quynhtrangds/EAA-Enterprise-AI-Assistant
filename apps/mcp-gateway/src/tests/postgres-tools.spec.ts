import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPostgresTools } from '../connectors/postgres/tools/index.js';
import { query } from '../db/pool.js';
import type { ToolContext } from '../types/tool.js';

vi.mock('../db/pool.js', () => ({
  query: vi.fn()
}));

describe('Postgres Connector Tools', () => {
  const tools = createPostgresTools();
  const getTool = (name: string) => tools.find(t => t.name === name);

  const mockContext: ToolContext = {
    userId: 'test-user',
    username: 'tester',
    roles: ['admin'],
    sessionId: 'session-123',
    requestId: 'req-123'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('search_customer', () => {
    it('executes query and maps results correctly', async () => {
      const tool = getTool('search_customer')!;
      
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            customer_code: 'CUST001',
            full_name: 'John Doe',
            phone: '0123456789',
            email: 'john@example.com',
            address: '123 Main St',
            status: 'active'
          }
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const result = await tool.execute({ keyword: 'John', limit: 10 }, mockContext) as any;

      expect(query).toHaveBeenCalledTimes(1);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, customer_code'),
        ['%John%', 10]
      );

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0]).toEqual({
        customerId: '123e4567-e89b-12d3-a456-426614174000',
        customerCode: 'CUST001',
        fullName: 'John Doe',
        phone: '0123456789',
        email: 'john@example.com',
        address: '123 Main St',
        status: 'active'
      });
    });
  });

  describe('get_customer_orders', () => {
    it('executes query and maps results correctly', async () => {
      const tool = getTool('get_customer_orders')!;
      
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            id: 'ord-1',
            order_code: 'ORD001',
            order_date: new Date('2026-01-01T00:00:00.000Z'),
            status: 'completed',
            total_amount: '100.50'
          }
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const result = await tool.execute({ customerId: 'cust-1', fromDate: '2026-01-01', toDate: '2026-12-31', limit: 5 }, mockContext) as any;

      expect(query).toHaveBeenCalledTimes(1);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, order_code'),
        ['cust-1', '2026-01-01', '2026-12-31', 5]
      );

      expect(result.orders[0].orderCode).toBe('ORD001');
      expect(result.orders[0].totalAmount).toBe(100.50);
    });
  });

  describe('get_order_detail', () => {
    it('executes query and maps results correctly', async () => {
      const tool = getTool('get_order_detail')!;
      
      // First query for order details
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            id: 'ord-1',
            order_code: 'ORD001',
            order_date: new Date('2026-01-01T00:00:00.000Z'),
            status: 'completed',
            total_amount: '500.00',
            customer_name: 'John Doe',
            customer_address: '123 Main St'
          }
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      // Second query: items
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            product_name: 'Laptop',
            quantity: 1,
            unit_price: '500.00',
            total_price: '500.00'
          }
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      // Third query: payments
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            payment_code: 'PAY001',
            payment_method: 'credit_card',
            amount: '500.00',
            status: 'paid',
            paid_at: new Date('2026-01-01T01:00:00.000Z')
          }
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const result = await tool.execute({ orderCode: 'ORD001' }, mockContext) as any;

      expect(query).toHaveBeenCalledTimes(3);
      expect(result.order.orderCode).toBe('ORD001');
      expect(result.order.items).toHaveLength(1);
      expect(result.order.payments).toHaveLength(1);
    });
  });

  describe('get_revenue_summary', () => {
    it('executes query and maps results correctly', async () => {
      const tool = getTool('get_revenue_summary')!;
      
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            group_key: 'credit_card',
            total_orders: 10,
            total_revenue: '5000.00'
          }
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const result = await tool.execute({ fromDate: '2026-01-01', toDate: '2026-12-31', groupBy: 'payment_method' }, mockContext) as any;

      expect(query).toHaveBeenCalledTimes(1);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].key).toBe('credit_card');
      expect(result.totalRevenue).toBe(5000);
      expect(result.totalOrders).toBe(10);
    });
  });

  describe('get_top_customers', () => {
    it('executes query and maps results correctly', async () => {
      const tool = getTool('get_top_customers')!;
      
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            id: 'cust-1',
            customer_code: 'CUST001',
            full_name: 'John Doe',
            phone: '0123456789',
            email: 'john@example.com',
            total_orders: 5,
            total_revenue: '1000.00'
          }
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const result = await tool.execute({ fromDate: '2026-01-01', toDate: '2026-12-31', limit: 10 }, mockContext) as any;

      expect(query).toHaveBeenCalledTimes(1);
      expect(result.customers).toHaveLength(1);
      expect(result.customers[0].totalRevenue).toBe(1000);
    });
  });

  describe('get_product_sales_summary', () => {
    it('executes query and maps results correctly', async () => {
      const tool = getTool('get_product_sales_summary')!;
      
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            id: 'prod-1',
            product_code: 'PROD001',
            name: 'Laptop',
            category: 'Electronics',
            total_quantity: 50,
            total_sales: '25000.00',
            total_orders: 45
          }
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });

      const result = await tool.execute({ fromDate: '2026-01-01', toDate: '2026-12-31', limit: 10 }, mockContext) as any;

      expect(query).toHaveBeenCalledTimes(1);
      expect(result.products).toHaveLength(1);
      expect(result.products[0].productName).toBe('Laptop');
      expect(result.products[0].revenue).toBe(25000);
    });
  });
});
