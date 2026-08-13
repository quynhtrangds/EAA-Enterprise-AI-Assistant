import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const mcpServer = new Server({
  name: 'mcp-server-erpnext',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_inventory_status',
        description: 'Lấy trạng thái tồn kho của các mặt hàng trong hệ thống ERPNext',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: {
              type: 'string',
              description: 'Tên hoặc mã mặt hàng để tìm kiếm (tuỳ chọn)'
            }
          }
        }
      },
      {
        name: 'get_sales_invoices',
        description: 'Lấy danh sách các Hóa đơn bán hàng (Sales Invoice / Doanh thu) từ hệ thống ERPNext (bao gồm mã hóa đơn, tên khách hàng, ngày, tổng tiền, trạng thái Paid/Unpaid/Overdue)',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: {
              type: 'string',
              description: 'Từ khóa tìm kiếm theo tên khách hàng hoặc mã hóa đơn (tuỳ chọn)'
            },
            status: {
              type: 'string',
              description: 'Lọc theo trạng thái: Paid, Unpaid, Overdue, Draft (tuỳ chọn)'
            },
            limit: {
              type: 'number',
              description: 'Số lượng kết quả tối đa (mặc định 20)'
            }
          }
        }
      },
      {
        name: 'get_purchase_invoices',
        description: 'Lấy danh sách các Hóa đơn mua hàng (Purchase Invoice / Chi phí mua hàng) từ hệ thống ERPNext (bao gồm mã hóa đơn, tên nhà cung cấp, ngày, tổng tiền, trạng thái Paid/Unpaid/Overdue)',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: {
              type: 'string',
              description: 'Từ khóa tìm kiếm theo tên nhà cung cấp hoặc mã hóa đơn (tuỳ chọn)'
            },
            status: {
              type: 'string',
              description: 'Lọc theo trạng thái: Paid, Unpaid, Overdue, Draft (tuỳ chọn)'
            },
            limit: {
              type: 'number',
              description: 'Số lượng kết quả tối đa (mặc định 20)'
            }
          }
        }
      }
    ]
  };
});

export function getAuthHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = apiKey.startsWith('token ') ? apiKey : `token ${apiKey}`;
  }
  return headers;
}

function cleanBaseUrl(url: string): string {
  let clean = (url || '').trim().replace(/\/+$/, '');
  clean = clean.replace(/\/api\/resource(\/[^/]+)?$/i, '');
  clean = clean.replace(/\/api$/i, '');
  return clean;
}

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const rawArgs = (request.params.arguments as any) || {};

  const creds = rawArgs._integrationCredentials || {};
  const { apiKey, apiUrl } = creds;

  if (toolName === 'get_inventory_status') {
    const keyword = (rawArgs.keyword as string || '').trim();
    if (!apiUrl) {
      throw new Error("Chưa cấu hình Endpoint URL cho hệ thống ERPNext. Vui lòng vào Cấu hình Tích hợp để nhập URL (ví dụ: https://erp.example.com).");
    }

    const baseUrl = cleanBaseUrl(apiUrl);
    const fields = JSON.stringify(['name', 'item_name', 'item_group', 'stock_uom', 'opening_stock', 'valuation_rate', 'standard_rate']);
    let queryParams = `fields=${encodeURIComponent(fields)}`;

    if (keyword) {
      const orFilters = JSON.stringify([
        ['name', 'like', `%${keyword}%`],
        ['item_name', 'like', `%${keyword}%`]
      ]);
      queryParams += `&or_filters=${encodeURIComponent(orFilters)}`;
    }

    const targetUrl = `${baseUrl}/api/resource/Item?${queryParams}`;
    const headers = getAuthHeaders(apiKey);

    let items: any[] = [];
    try {
      const resp = await fetch(targetUrl, { headers, signal: AbortSignal.timeout(10000) });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`Máy chủ ERPNext trả về HTTP ${resp.status} (${resp.statusText || 'Error'}). ${errText.slice(0, 200)}`);
      }

      const data = (await resp.json()) as { data?: any[] };
      items = data.data || [];

      try {
        const binFields = JSON.stringify(['item_code', 'warehouse', 'actual_qty']);
        const binUrl = `${baseUrl}/api/resource/Bin?fields=${encodeURIComponent(binFields)}`;
        const binResp = await fetch(binUrl, { headers, signal: AbortSignal.timeout(5000) });
        if (binResp.ok) {
          const binData = (await binResp.json()) as { data?: any[] };
          const bins = binData.data || [];
          const stockMap = new Map<string, number>();
          for (const b of bins) {
            const qty = stockMap.get(b.item_code) || 0;
            stockMap.set(b.item_code, qty + (b.actual_qty || 0));
          }

          for (const item of items) {
            item.actual_qty = stockMap.has(item.name) ? stockMap.get(item.name) : (item.opening_stock || 0);
          }
        } else {
          for (const item of items) {
            item.actual_qty = item.opening_stock || 0;
          }
        }
      } catch {
        for (const item of items) {
          item.actual_qty = item.opening_stock || 0;
        }
      }
    } catch (err: any) {
      console.warn(`[MCP ERPNext Warning] Tải tồn kho từ ERPNext [${baseUrl}] thất bại (${err.message}). Chuyển sang dữ liệu mẫu fallback.`);
      const mockItems = [
        { name: 'ITEM-001', item_name: 'Laptop Dell XPS 15', item_group: 'Thiết bị công nghệ', stock_uom: 'Cái', opening_stock: 45, actual_qty: 42, standard_rate: 32000000 },
        { name: 'ITEM-002', item_name: 'Màn hình Dell UltraSharp 27 inch', item_group: 'Thiết bị công nghệ', stock_uom: 'Cái', opening_stock: 120, actual_qty: 115, standard_rate: 8500000 },
        { name: 'ITEM-003', item_name: 'Bàn phím cơ Logitech MX Keys', item_group: 'Phụ kiện máy tính', stock_uom: 'Cái', opening_stock: 80, actual_qty: 78, standard_rate: 2800000 },
        { name: 'ITEM-004', item_name: 'Chuột không dây MX Master 3S', item_group: 'Phụ kiện máy tính', stock_uom: 'Cái', opening_stock: 60, actual_qty: 55, standard_rate: 2400000 }
      ];
      const filtered = keyword ? mockItems.filter(i => i.item_name.toLowerCase().includes(keyword.toLowerCase()) || i.name.toLowerCase().includes(keyword.toLowerCase())) : mockItems;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              total: filtered.length,
              items: filtered,
              note: `Thông báo: Kết nối tới máy chủ ERPNext [${baseUrl}] tạm thời gặp sự cố (${err.message}). Dưới đây là dữ liệu tồn kho hệ thống phục vụ kiểm thử.`
            }, null, 2)
          }
        ]
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ total: items.length, items }, null, 2)
        }
      ]
    };
  }

  if (toolName === 'get_sales_invoices' || toolName === 'get_purchase_invoices') {
    const isSales = toolName === 'get_sales_invoices';
    const docType = isSales ? 'Sales Invoice' : 'Purchase Invoice';
    const keyword = (rawArgs.keyword as string || '').trim();
    const statusFilter = (rawArgs.status as string || '').trim();
    const limit = Math.min(Math.max(Number(rawArgs.limit) || 20, 1), 100);

    if (!apiUrl) {
      throw new Error("Chưa cấu hình Endpoint URL cho hệ thống ERPNext.");
    }

    const baseUrl = cleanBaseUrl(apiUrl);
    const targetFields = isSales
      ? ['name', 'customer', 'customer_name', 'posting_date', 'due_date', 'grand_total', 'status', 'currency']
      : ['name', 'supplier', 'supplier_name', 'posting_date', 'due_date', 'grand_total', 'status', 'currency'];

    let queryParams = `fields=${encodeURIComponent(JSON.stringify(targetFields))}&limit_page_length=${limit}&order_by=posting_date desc`;

    const filters: any[] = [];
    if (statusFilter) {
      filters.push(['status', '=', statusFilter]);
    }
    if (filters.length > 0) {
      queryParams += `&filters=${encodeURIComponent(JSON.stringify(filters))}`;
    }

    if (keyword) {
      const searchField = isSales ? 'customer_name' : 'supplier_name';
      const orFilters = JSON.stringify([
        ['name', 'like', `%${keyword}%`],
        [searchField, 'like', `%${keyword}%`]
      ]);
      queryParams += `&or_filters=${encodeURIComponent(orFilters)}`;
    }

    const targetUrl = `${baseUrl}/api/resource/${encodeURIComponent(docType)}?${queryParams}`;
    const headers = getAuthHeaders(apiKey);

    try {
      const resp = await fetch(targetUrl, { headers, signal: AbortSignal.timeout(10000) });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`ERPNext HTTP Error ${resp.status}: ${errText || resp.statusText}`);
      }

      const data = (await resp.json()) as { data?: any[] };
      const invoices = data.data || [];

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              loaiHoaDon: isSales ? 'Hóa đơn bán hàng' : 'Hóa đơn mua hàng',
              tongSo: invoices.length,
              danhSachHoaDon: invoices.map(inv => ({
                maHoaDon: inv.name,
                doiTac: isSales ? inv.customer_name || inv.customer : inv.supplier_name || inv.supplier,
                ngayGhiSo: inv.posting_date,
                hanThanhToan: inv.due_date,
                tongTien: inv.grand_total,
                donViTien: inv.currency || 'VND',
                trangThai: inv.status === 'Paid' ? 'Đã thanh toán (Paid)' : inv.status === 'Unpaid' ? 'Chưa thanh toán (Unpaid)' : inv.status === 'Overdue' ? 'Quá hạn (Overdue)' : inv.status
              }))
            }, null, 2)
          }
        ]
      };
    } catch (err: any) {
      console.warn(`[MCP ERPNext Warning] Lỗi tải hóa đơn từ ERPNext (${err.message}), dùng dữ liệu mẫu fallback.`);
      const mockInvoices = isSales ? [
        { maHoaDon: 'SINV-2026-001', doiTac: 'Công ty Cổ phần Công nghệ ABC', ngayGhiSo: '2026-08-01', hanThanhToan: '2026-08-15', tongTien: 45000000, donViTien: 'VND', trangThai: 'Đã thanh toán (Paid)' },
        { maHoaDon: 'SINV-2026-002', doiTac: 'Tập đoàn Điện tử XYZ', ngayGhiSo: '2026-08-05', hanThanhToan: '2026-08-20', tongTien: 128000000, donViTien: 'VND', trangThai: 'Chưa thanh toán (Unpaid)' }
      ] : [
        { maHoaDon: 'PINV-2026-001', doiTac: 'Nhà cung cấp Linh kiện Toàn Cầu', ngayGhiSo: '2026-07-28', hanThanhToan: '2026-08-10', tongTien: 89000000, donViTien: 'VND', trangThai: 'Đã thanh toán (Paid)' }
      ];
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              loaiHoaDon: isSales ? 'Hóa đơn bán hàng' : 'Hóa đơn mua hàng',
              tongSo: mockInvoices.length,
              danhSachHoaDon: mockInvoices,
              note: `Thông báo: Máy chủ ERPNext tạm thời gặp sự cố kết nối (${err.message}). Dưới đây là danh sách hóa đơn mẫu phục vụ kiểm thử.`
            }, null, 2)
          }
        ]
      };
    }
  }

  throw new Error(`Tool not found: ${toolName}`);
});

async function run() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.log('ERPNext MCP Server running on stdio');
}

run().catch(console.error);
