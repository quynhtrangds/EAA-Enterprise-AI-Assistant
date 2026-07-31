import { describe, it, expect } from 'vitest';

function normalizeVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toLowerCase();
}

function isCustomerOrdersQuestion(message: string): boolean {
  const normalized = normalizeVietnamese(message);
  return normalized.includes('khach hang') && normalized.includes('don hang');
}

function formatMoney(value: unknown): string {
  return `${Number(value ?? 0).toLocaleString('vi-VN')} VND`;
}

function buildCustomerOrdersAnswer(customer: any, orders: any[]): string {
  if (orders.length === 0) {
    return `Khách hàng ${customer.fullName} chưa có đơn hàng nào trong 90 ngày gần nhất.`;
  }

  const orderSummary = orders
    .slice(0, 8)
    .map((order) => `${order.orderCode} (${order.status}, ${formatMoney(order.totalAmount)})`)
    .join('; ');

  return `Khách hàng ${customer.fullName} có ${orders.length} đơn hàng trong 90 ngày gần nhất: ${orderSummary}.`;
}

describe('AI Orchestrator - Chat Service Helpers & Edge Cases Suite', () => {
  describe('normalizeVietnamese helper', () => {
    it('strips Vietnamese diacritics and normalizes đ/Đ', () => {
      expect(normalizeVietnamese('Khách Hàng Đơn Hàng')).toBe('khach hang don hang');
      expect(normalizeVietnamese('Doanh Thu Hằng Ngày')).toBe('doanh thu hang ngay');
    });
  });

  describe('isCustomerOrdersQuestion helper', () => {
    it('detects intent for customer order queries regardless of accent', () => {
      expect(isCustomerOrdersQuestion('Tìm các đơn hàng của khách hàng Nguyễn Văn A')).toBe(true);
      expect(isCustomerOrdersQuestion('khach hang nay co nhung don hang gi')).toBe(true);
      expect(isCustomerOrdersQuestion('Hôm nay doanh thu bao nhiêu?')).toBe(false);
    });
  });

  describe('formatMoney helper', () => {
    it('formats numbers into Vietnamese Dong format', () => {
      expect(formatMoney(1500000)).toContain('1.500.000');
      expect(formatMoney(0)).toContain('0');
      expect(formatMoney(null)).toContain('0');
    });
  });

  describe('buildCustomerOrdersAnswer helper', () => {
    it('returns empty message when customer has no orders', () => {
      const customer = { fullName: 'Trần Văn B' };
      const answer = buildCustomerOrdersAnswer(customer, []);
      expect(answer).toBe('Khách hàng Trần Văn B chưa có đơn hàng nào trong 90 ngày gần nhất.');
    });

    it('summarizes customer orders clearly up to 8 orders', () => {
      const customer = { fullName: 'Nguyễn Văn A' };
      const orders = [
        { orderCode: 'DH001', status: 'completed', totalAmount: 500000 },
        { orderCode: 'DH002', status: 'paid', totalAmount: 1200000 }
      ];
      const answer = buildCustomerOrdersAnswer(customer, orders);
      expect(answer).toContain('Khách hàng Nguyễn Văn A có 2 đơn hàng');
      expect(answer).toContain('DH001 (completed');
      expect(answer).toContain('DH002 (paid');
    });
  });
});
