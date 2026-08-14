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
    .replace(/cho tôi biết|cho toi biet|cho tôi|cho toi/gi, '')
    .replace(/tra cứu|tra cuu|tìm kiếm|tim kiem|tìm|tim|kiểm tra|kiem tra|xem/gi, '')
    .replace(/thông tin về|thong tin ve|thông tin|thong tin/gi, '')
    .replace(/khách hàng|khach hang|người dùng|nguoi dung/gi, '')
    .replace(/có những đơn hàng nào|co nhung don hang nao|có đơn hàng nào|co don hang nao/gi, '')
    .replace(/địa chỉ|dia chi|số điện thoại|so dien thoai|\bsđt\b|\bsdt\b|\bemail\b/gi, '')
    .replace(/\bcủa\b|\bcua\b|\bvề\b|\bve\b|\blà ai\b|\bla ai\b|\bở đâu\b|\bo dau\b/gi, '')
    .replace(/[?.!,;:]/g, '')
    .replace(/\s+/g, ' ')
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

    if (
      normalized.includes('dia chi') ||
      normalized.includes('so dien thoai') ||
      normalized.includes('sdt') ||
      normalized.includes('email') ||
      normalized.includes('khach hang') ||
      normalized.includes('thong tin')
    ) {
      const keyword = cleanCustomerKeyword(message);
      return { toolName: 'search_customer', arguments: { keyword: keyword || 'Nguyễn', limit: 5 } };
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
        return 'Không tìm thấy khách hàng phù hợp.';
      }
      if (customers.length === 1) {
        const c = customers[0];
        const address = c.address ? ` - Địa chỉ: ${c.address}` : '';
        return `Thông tin khách hàng: ${c.fullName} (${c.customerCode}) | SĐT: ${c.phone || 'N/A'} | Email: ${c.email || 'N/A'}${address} | Trạng thái: ${c.status}.`;
      }
      return `Tìm thấy ${customers.length} khách hàng: ${customers.map((customer: any) => `${customer.fullName} (${customer.phone || 'N/A'}${customer.address ? ', ' + customer.address : ''})`).join('; ')}.`;
    }

    if (toolCall.toolName === 'get_top_customers') {
      const customers = Array.isArray(data.customers) ? data.customers : [];
      if (customers.length === 0) {
        return 'Không có dữ liệu mua hàng trong khoảng thời gian đã chọn.';
      }
      return `Top khách hàng: ${customers.map((customer: any) => `${customer.fullName} (${formatMoney(customer.totalRevenue)})`).join('; ')}.`;
    }

    if (toolCall.toolName === 'get_product_sales_summary') {
      const products = Array.isArray(data.products) ? data.products : [];
      if (products.length === 0) {
        return 'Không có dữ liệu sản phẩm bán ra trong khoảng thời gian đã chọn.';
      }
      return `Sản phẩm bán chạy: ${products.map((product: any) => `${product.productName} (${product.quantitySold} sản phẩm, doanh thu: ${formatMoney(product.revenue)})`).join('; ')}.`;
    }

    return 'Đã lấy dữ liệu từ tool thành công.';
  }
}
