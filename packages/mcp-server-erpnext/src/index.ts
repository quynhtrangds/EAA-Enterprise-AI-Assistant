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
    const filters = JSON.stringify([['disabled', '=', 0]]);
    let queryParams = `fields=${encodeURIComponent(fields)}&filters=${encodeURIComponent(filters)}&limit_page_length=1000`;
    
    if (keyword) {
      const orFilters = JSON.stringify([
        ['name', 'like', `%${keyword}%`],
        ['item_name', 'like', `%${keyword}%`]
      ]);
      queryParams += `&or_filters=${encodeURIComponent(orFilters)}`;
    }

    const targetUrl = `${baseUrl}/api/resource/Item?${queryParams}`;
    const binFields = JSON.stringify(['item_code', 'warehouse', 'actual_qty']);
    const binUrl = `${baseUrl}/api/resource/Bin?fields=${encodeURIComponent(binFields)}&limit_page_length=1000`;
    const headers = getAuthHeaders(apiKey);

    try {
      const [itemResp, binResp] = await Promise.all([
        fetch(targetUrl, { headers, signal: AbortSignal.timeout(30000) }),
        fetch(binUrl, { headers, signal: AbortSignal.timeout(30000) })
      ]);

      if (!itemResp.ok || !binResp.ok) {
        const failedResp = !itemResp.ok ? itemResp : binResp;
        const errText = await failedResp.text().catch(() => '');
        throw new Error(`Máy chủ ERPNext trả về HTTP ${failedResp.status} (${failedResp.statusText || 'Error'}). ${errText.slice(0, 200)}`);
      }

      const [itemData, binData] = await Promise.all([
        itemResp.json() as Promise<{ data?: any[] }>,
        binResp.json() as Promise<{ data?: any[] }>
      ]);
      const items = itemData.data || [];
      const bins = binData.data || [];
      const stockMap = new Map<string, number>();

      for (const bin of bins) {
        stockMap.set(bin.item_code, (stockMap.get(bin.item_code) || 0) + Number(bin.actual_qty || 0));
      }

      for (const item of items) {
        item.actual_qty = stockMap.get(item.name) || 0;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ total: items.length, items }, null, 2)
          }
        ]
      };
    } catch (err: any) {
      throw new Error(`Không thể lấy danh sách sản phẩm từ máy chủ Frappe/ERPNext [${baseUrl}]. Lý do: ${err.message}. Vui lòng kiểm tra lại Endpoint URL và API Key trong Vault/Cấu hình tích hợp.`);
    }
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
      throw new Error(`Không thể lấy ${isSales ? 'hóa đơn bán hàng' : 'hóa đơn mua hàng'} thật từ máy chủ Frappe/ERPNext [${baseUrl}]. Lý do: ${err.message}. Vui lòng kiểm tra Endpoint URL, API Key và quyền truy cập DocType trong Frappe.`);
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
