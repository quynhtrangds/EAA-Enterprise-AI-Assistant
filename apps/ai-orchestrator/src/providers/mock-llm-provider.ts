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
    .replace(/khách hàng/gi, '')
    .replace(/khach hang/gi, '')
    .replace(/có những đơn hàng nào/gi, '')
    .replace(/co nhung don hang nao/gi, '')
    .replace(/\bcủa\b/gi, '')
    .replace(/\bcua\b/gi, '')
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

    if (normalized.includes('ton kho') || (normalized.includes('san pham') && !normalized.includes('ban chay'))) {
      return { toolName: 'get_inventory_status', arguments: {} };
    }

    if (normalized.includes('ticket') || normalized.includes('zammad')) {
      return { toolName: 'get_open_tickets', arguments: {} };
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
      return `Top kh\u00e1ch h\u00e0ng: ${customers.map((customer: any) => `${customer.fullName} (${formatMoney(customer.totalRevenue)})`).join('; ')}.`;
    }

    if (toolCall.toolName === 'get_inventory_status') {
      const items = Array.isArray(data.items) ? data.items : [];
      if (items.length === 0) {
        return 'Không tìm thấy sản phẩm nào trên Frappe / ERPNext.';
      }
      const itemDetails = items.slice(0, 10).map((i: any) => `- **${i.item_name || i.name}** (Mã: ${i.name}): Tồn kho ${i.opening_stock ?? 0} ${i.stock_uom || 'cái'}`).join('\n');
      return `📦 **Báo cáo tồn kho thực tế lấy từ Frappe Cloud:**\n\n${itemDetails}`;
    }

    if (toolCall.toolName === 'get_open_tickets') {
      const tickets = Array.isArray(data) ? data : (Array.isArray(data.tickets) ? data.tickets : []);
      if (tickets.length === 0) {
        return 'Không có ticket nào đang mở trên Zammad.';
      }
      const ticketList = tickets.map((t: any) => `- **Ticket #${t.number || t.id}**: ${t.title || 'No Title'}`).join('\n');
      return `🎫 **Danh sách Ticket Zammad đang mở thực tế:**\n\n${ticketList}`;
    }

    return 'Đã lấy dữ liệu từ tool thành công.';
  }
}
