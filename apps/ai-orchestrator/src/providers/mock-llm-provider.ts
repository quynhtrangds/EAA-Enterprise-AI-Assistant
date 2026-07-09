import type { LLMProvider } from './llm-provider.js';
import type { PlannedToolCall } from '../types/chat.js';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function formatMoney(value: unknown): string {
  return `${Number(value ?? 0).toLocaleString('vi-VN')} VND`;
}

function normalizeVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toLowerCase();
}

function cleanCustomerKeyword(message: string): string {
  return message
    .replace(/kh\u00e1ch h\u00e0ng/gi, '')
    .replace(/khach hang/gi, '')
    .replace(/c\u00f3 nh\u1eefng \u0111\u01a1n h\u00e0ng n\u00e0o/gi, '')
    .replace(/co nhung don hang nao/gi, '')
    .replace(/[?.!]/g, '')
    .trim();
}

export class MockLLMProvider implements LLMProvider {
  planToolCall(message: string): PlannedToolCall | null {
    const normalized = normalizeVietnamese(message);
    const orderCode = message.match(/ORD-\d+/i)?.[0]?.toUpperCase();

    if (orderCode) {
      return { toolName: 'get_order_detail', arguments: { orderCode } };
    }

    if (normalized.includes('doanh thu')) {
      const date = normalized.includes('thang') ? monthStart() : today();
      return {
        toolName: 'get_revenue_summary',
        arguments: { fromDate: date, toDate: today(), groupBy: 'day' }
      };
    }

    if (normalized.includes('top') && normalized.includes('khach hang')) {
      return {
        toolName: 'get_top_customers',
        arguments: { fromDate: monthStart(), toDate: today(), limit: 5 }
      };
    }

    if (normalized.includes('san pham') && normalized.includes('ban chay')) {
      return {
        toolName: 'get_product_sales_summary',
        arguments: { fromDate: monthStart(), toDate: today(), limit: 10 }
      };
    }

    if (normalized.includes('khach hang')) {
      const keyword = cleanCustomerKeyword(message);
      return { toolName: 'search_customer', arguments: { keyword: keyword || 'Nguy\u1ec5n', limit: 5 } };
    }

    return null;
  }

  buildAnswer(_message: string, toolCall: PlannedToolCall | null, toolResult: unknown): string {
    if (!toolCall) {
      return 'MVP hi\u1ec7n t\u1ea1i h\u1ed7 tr\u1ee3 c\u00e1c c\u00e2u h\u1ecfi v\u1ec1 doanh thu, \u0111\u01a1n h\u00e0ng, kh\u00e1ch h\u00e0ng v\u00e0 s\u1ea3n ph\u1ea9m b\u00e1n ch\u1ea1y.';
    }

    const data = toolResult as Record<string, any>;

    if (toolCall.toolName === 'get_revenue_summary') {
      return `T\u1ed5ng doanh thu trong kho\u1ea3ng \u0111\u00e3 ch\u1ecdn l\u00e0 ${formatMoney(data.totalRevenue)} v\u1edbi ${data.totalOrders ?? 0} \u0111\u01a1n h\u00e0ng \u0111\u00e3 thanh to\u00e1n.`;
    }

    if (toolCall.toolName === 'get_order_detail') {
      const order = data.order;
      return `\u0110\u01a1n h\u00e0ng ${order?.orderCode} \u0111ang \u1edf tr\u1ea1ng th\u00e1i ${order?.status}, t\u1ed5ng gi\u00e1 tr\u1ecb ${formatMoney(order?.totalAmount)}.`;
    }

    if (toolCall.toolName === 'search_customer') {
      const customers = Array.isArray(data.customers) ? data.customers : [];
      if (customers.length === 0) {
        return 'Kh\u00f4ng t\u00ecm th\u1ea5y kh\u00e1ch h\u00e0ng ph\u00f9 h\u1ee3p.';
      }
      return `T\u00ecm th\u1ea5y ${customers.length} kh\u00e1ch h\u00e0ng: ${customers.map((customer: any) => customer.fullName).join(', ')}.`;
    }

    if (toolCall.toolName === 'get_top_customers') {
      const customers = Array.isArray(data.customers) ? data.customers : [];
      return `Top kh\u00e1ch h\u00e0ng: ${customers.map((customer: any) => `${customer.fullName} (${formatMoney(customer.totalRevenue)})`).join('; ')}.`;
    }

    if (toolCall.toolName === 'get_product_sales_summary') {
      const products = Array.isArray(data.products) ? data.products : [];
      return `S\u1ea3n ph\u1ea9m b\u00e1n ch\u1ea1y: ${products.map((product: any) => `${product.productName} (${product.quantitySold})`).join('; ')}.`;
    }

    return '\u0110\u00e3 l\u1ea5y d\u1eef li\u1ec7u t\u1eeb tool th\u00e0nh c\u00f4ng.';
  }
}
