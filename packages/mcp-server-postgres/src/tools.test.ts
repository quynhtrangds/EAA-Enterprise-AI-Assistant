import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPostgresTools, assertDateRange } from './tools.js';

vi.mock('./db/pool.js', () => ({
  query: vi.fn()
}));

import { query } from './db/pool.js';

describe('Postgres MCP Server Tools Suite', () => {
  const tools = createPostgresTools();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('assertDateRange helper', () => {
    it('should accept valid date ranges within 1 year', () => {
      expect(() => assertDateRange('2026-01-01', '2026-06-01')).not.toThrow();
    });

    it('should throw error when fromDate is after toDate', () => {
      expect(() => assertDateRange('2026-07-01', '2026-01-01')).toThrow('fromDate phải nhỏ hơn hoặc bằng toDate.');
    });

    it('should throw error when range exceeds 1 year (366 days)', () => {
      expect(() => assertDateRange('2024-01-01', '2025-06-01')).toThrow('Khoảng ngày không được vượt quá 1 năm.');
    });

    it('should throw error on invalid date string format', () => {
      expect(() => assertDateRange('invalid-date', '2026-01-01')).toThrow();
    });
  });

  describe('Tool: search_customer', () => {
    const tool = tools.find(t => t.name === 'search_customer')!;

    it('should exist and have proper metadata', () => {
      expect(tool).toBeDefined();
      expect(tool.title).toBe('Search Customer');
    });

    it('should parse valid input and query database with search parameters', async () => {
      const mockCustomer = {
        id: '10000000-0000-0000-0000-000000000001',
        customer_code: 'KH001',
        full_name: 'Nguyễn Văn A',
        phone: '0901234567',
        email: 'nva@company.com',
        address: 'Hà Nội',
        status: 'active'
      };

      (query as any).mockResolvedValueOnce({ rows: [mockCustomer] });

      const parsed = tool.inputSchema.parse({ keyword: 'Nguyễn', limit: 5 });
      const result = await tool.execute(parsed);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('FROM customers'),
        ['%Nguyễn%', 5]
      );
      expect(result.customers).toHaveLength(1);
      expect(result.customers[0]).toEqual({
        customerId: mockCustomer.id,
        customerCode: 'KH001',
        fullName: 'Nguyễn Văn A',
        phone: '0901234567',
        email: 'nva@company.com',
        address: 'Hà Nội',
        status: 'active'
      });
    });
  });

  describe('Tool: get_customer_orders', () => {
    const tool = tools.find(t => t.name === 'get_customer_orders')!;

    it('should query orders for given customerId and format totalAmount', async () => {
      const mockOrder = {
        id: '20000000-0000-0000-0000-000000000001',
        order_code: 'DH001',
        order_date: new Date('2026-07-01T10:00:00Z'),
        status: 'completed',
        total_amount: '1500000'
      };

      (query as any).mockResolvedValueOnce({ rows: [mockOrder] });

      const customerId = '10000000-0000-0000-0000-000000000001';
      const parsed = tool.inputSchema.parse({ customerId, limit: 10 });
      const result = await tool.execute(parsed);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('FROM orders'),
        [customerId, null, null, 10]
      );
      expect(result.orders).toHaveLength(1);
      expect(result.orders[0]).toEqual({
        orderId: mockOrder.id,
        orderCode: 'DH001',
        orderDate: mockOrder.order_date.toISOString(),
        status: 'completed',
        totalAmount: 1500000
      });
    });
  });

  describe('Tool: get_order_detail', () => {
    const tool = tools.find(t => t.name === 'get_order_detail')!;

    it('should return order details along with items and payment history', async () => {
      const mockOrderHeader = {
        id: '20000000-0000-0000-0000-000000000001',
        order_code: 'DH001',
        order_date: new Date('2026-07-01T10:00:00Z'),
        status: 'completed',
        total_amount: '2000000',
        customer_name: 'Nguyễn Văn A',
        customer_address: 'Hà Nội'
      };

      const mockItems = [
        { product_name: 'Laptop Dell', quantity: 1, unit_price: '2000000', total_price: '2000000' }
      ];

      const mockPayments = [
        { payment_code: 'PAY001', payment_method: 'bank_transfer', amount: '2000000', status: 'success', paid_at: new Date('2026-07-01T10:05:00Z') }
      ];

      (query as any)
        .mockResolvedValueOnce({ rows: [mockOrderHeader] })
        .mockResolvedValueOnce({ rows: mockItems })
        .mockResolvedValueOnce({ rows: mockPayments });

      const parsed = tool.inputSchema.parse({ orderCode: 'DH001' });
      const result = await tool.execute(parsed);

      expect(result.order.orderCode).toBe('DH001');
      expect(result.order.customerName).toBe('Nguyễn Văn A');
      expect(result.order.items).toHaveLength(1);
      expect(result.order.items[0].productName).toBe('Laptop Dell');
      expect(result.order.payments).toHaveLength(1);
      expect(result.order.payments[0].amount).toBe(2000000);
    });

    it('should throw error when order code is not found', async () => {
      (query as any).mockResolvedValueOnce({ rows: [] });

      const parsed = tool.inputSchema.parse({ orderCode: 'DH999' });
      await expect(tool.execute(parsed)).rejects.toThrow('Không tìm thấy đơn hàng DH999');
    });
  });

  describe('Tool: get_revenue_summary', () => {
    const tool = tools.find(t => t.name === 'get_revenue_summary')!;

    it('should calculate revenue summary grouped by day', async () => {
      const mockGroups = [
        { group_key: '2026-07-01', total_orders: '3', total_revenue: '5000000' }
      ];

      (query as any).mockResolvedValueOnce({ rows: mockGroups });

      const parsed = tool.inputSchema.parse({ fromDate: '2026-07-01', toDate: '2026-07-10', groupBy: 'day' });
      const result = await tool.execute(parsed);

      expect(result.totalRevenue).toBe(5000000);
      expect(result.totalOrders).toBe(3);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].key).toBe('2026-07-01');
    });
  });

  describe('Tool: get_top_customers', () => {
    const tool = tools.find(t => t.name === 'get_top_customers')!;

    it('should return top customers by total revenue', async () => {
      const mockTopCustomer = {
        id: '10000000-0000-0000-0000-000000000001',
        customer_code: 'KH001',
        full_name: 'Nguyễn Văn A',
        total_orders: '5',
        total_revenue: '15000000'
      };

      (query as any).mockResolvedValueOnce({ rows: [mockTopCustomer] });

      const parsed = tool.inputSchema.parse({ fromDate: '2026-01-01', toDate: '2026-07-01', limit: 5 });
      const result = (await tool.execute(parsed)) as any;

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0].fullName).toBe('Nguyễn Văn A');
      expect(result.customers[0].totalRevenue).toBe(15000000);
      expect(result.customers[0].orderCount).toBe(5);
    });
  });

  describe('Tool: get_product_sales_summary', () => {
    const tool = tools.find(t => t.name === 'get_product_sales_summary')!;

    it('should return product sales summary', async () => {
      const mockProduct = {
        product_code: 'SP001',
        name: 'Bàn phím cơ',
        total_quantity: '10',
        total_sales: '5000000'
      };

      (query as any).mockResolvedValueOnce({ rows: [mockProduct] });

      const parsed = tool.inputSchema.parse({ fromDate: '2026-06-01', toDate: '2026-07-01', limit: 10 });
      const result = (await tool.execute(parsed)) as any;

      expect(result.products).toHaveLength(1);
      expect(result.products[0].productCode).toBe('SP001');
      expect(result.products[0].quantitySold).toBe(10);
      expect(result.products[0].revenue).toBe(5000000);
    });
  });
});
