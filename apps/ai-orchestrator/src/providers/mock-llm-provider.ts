import type { LLMCompletionResult, LLMMessage, LLMProvider, LLMToolDefinition } from './llm-provider.js';
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
      return 'MVP hiện tại hỗ trợ các câu hỏi về doanh thu, đơn hàng, khách hàng và sản phẩm bán chạy.';
    }

    const data = (toolResult ?? {}) as Record<string, any>;

    if (toolCall.toolName === 'get_revenue_summary') {
      return `Tổng doanh thu trong khoảng đã chọn là ${formatMoney(data.totalRevenue)} với ${data.totalOrders ?? 0} đơn hàng đã thanh toán.`;
    }

    if (toolCall.toolName === 'get_order_detail') {
      const order = data.order;
      return `Đơn hàng ${order?.orderCode} đang ở trạng thái ${order?.status}, tổng giá trị ${formatMoney(order?.totalAmount)}.`;
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

  async generateCompletion(
    messages: LLMMessage[],
    _tools: LLMToolDefinition[]
  ): Promise<LLMCompletionResult> {
    const lastMsg = messages[messages.length - 1];
    const userMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

    // If last message is a tool response, synthesize final answer
    if (lastMsg && lastMsg.role === 'tool') {
      let toolData: unknown = {};
      try {
        const parsed = JSON.parse(lastMsg.content || '{}');
        toolData = parsed.data ?? parsed;
      } catch {
        toolData = lastMsg.content;
      }
      const planned = this.planToolCall(userMsg);
      const answer = this.buildAnswer(userMsg, planned, toolData);
      return {
        content: answer,
        toolCalls: []
      };
    }

    // Otherwise, plan a tool call for the user message
    const planned = this.planToolCall(userMsg);
    if (planned) {
      return {
        content: null,
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            name: planned.toolName,
            arguments: planned.arguments
          }
        ]
      };
    }

    return {
      content: this.buildAnswer(userMsg, null, null),
      toolCalls: []
    };
  }
}
