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
      },
      {
        name: 'get_revenue_summary',
        description: 'Tổng hợp doanh thu từ các hóa đơn bán hàng trên hệ thống ERPNext (theo ngày, tháng hoặc tổng thể)',
        inputSchema: {
          type: 'object',
          properties: {
            fromDate: {
              type: 'string',
              description: 'Ngày bắt đầu (YYYY-MM-DD)'
            },
            toDate: {
              type: 'string',
              description: 'Ngày kết thúc (YYYY-MM-DD)'
            },
            groupBy: {
              type: 'string',
              enum: ['day', 'month', 'payment_method'],
              description: 'Nhóm doanh thu theo ngày (day) hoặc tháng (month)'
            }
          }
        }
      },
      {
        name: 'get_product_sales_summary',
        description: 'Xếp hạng các sản phẩm bán chạy nhất từ các hóa đơn bán hàng trên hệ thống ERPNext',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Số lượng sản phẩm tối đa cần lấy (mặc định 5)'
            },
            fromDate: {
              type: 'string',
              description: 'Ngày bắt đầu lọc hóa đơn (YYYY-MM-DD)'
            },
            toDate: {
              type: 'string',
              description: 'Ngày kết thúc lọc hóa đơn (YYYY-MM-DD)'
            }
          }
        }
      },
      {
        name: 'search_customer',
        description: 'Tìm kiếm khách hàng theo tên hoặc mã trên hệ thống ERPNext',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Từ khóa tìm kiếm theo tên hoặc mã khách hàng'
            },
            keyword: {
              type: 'string',
              description: 'Từ khóa tìm kiếm (tùy chọn)'
            }
          }
        }
      },
      {
        name: 'get_customer_orders',
        description: 'Lấy danh sách các đơn hàng / hóa đơn bán hàng của một khách hàng từ hệ thống ERPNext',
        inputSchema: {
          type: 'object',
          properties: {
            customerId: {
              type: 'string',
              description: 'Tên hoặc mã định danh của khách hàng'
            },
            customerCode: {
              type: 'string',
              description: 'Mã khách hàng'
            },
            keyword: {
              type: 'string',
              description: 'Tên khách hàng'
            }
          }
        }
      },
      {
        name: 'get_order_detail',
        description: 'Xem thông tin chi tiết một đơn hàng / hóa đơn bán hàng từ hệ thống ERPNext (bao gồm danh sách sản phẩm, số lượng, đơn giá)',
        inputSchema: {
          type: 'object',
          properties: {
            orderId: {
              type: 'string',
              description: 'Mã số hóa đơn / đơn hàng (ví dụ ACC-SINV-2026-00001)'
            },
            orderCode: {
              type: 'string',
              description: 'Mã số hóa đơn / đơn hàng'
            }
          }
        }
      },
      {
        name: 'get_top_customers',
        description: 'Xếp hạng các khách hàng có tổng giá trị mua hàng cao nhất từ hệ thống ERPNext',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Số lượng khách hàng tối đa (mặc định 5)'
            },
            fromDate: {
              type: 'string',
              description: 'Ngày bắt đầu (YYYY-MM-DD)'
            },
            toDate: {
              type: 'string',
              description: 'Ngày kết thúc (YYYY-MM-DD)'
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

// Mock fallback data
const MOCK_ITEMS = [
  { name: 'ITEM-001', item_name: 'Laptop Dell XPS 15', item_group: 'Thiết bị công nghệ', stock_uom: 'Cái', opening_stock: 45, actual_qty: 42, standard_rate: 32000000 },
  { name: 'ITEM-002', item_name: 'Màn hình Dell UltraSharp 27 inch', item_group: 'Thiết bị công nghệ', stock_uom: 'Cái', opening_stock: 120, actual_qty: 115, standard_rate: 8500000 },
  { name: 'ITEM-003', item_name: 'Bàn phím cơ Logitech MX Keys', item_group: 'Phụ kiện máy tính', stock_uom: 'Cái', opening_stock: 80, actual_qty: 78, standard_rate: 2800000 },
  { name: 'ITEM-004', item_name: 'Chuột không dây MX Master 3S', item_group: 'Phụ kiện máy tính', stock_uom: 'Cái', opening_stock: 60, actual_qty: 55, standard_rate: 2400000 }
];

const MOCK_SALES_INVOICES = [
  { name: 'SINV-2026-001', maHoaDon: 'SINV-2026-001', customer: 'Công ty Cổ phần Công nghệ ABC', customer_name: 'Công ty Cổ phần Công nghệ ABC', doiTac: 'Công ty Cổ phần Công nghệ ABC', posting_date: '2026-08-01', ngayGhiSo: '2026-08-01', hanThanhToan: '2026-08-15', grand_total: 45000000, tongTien: 45000000, donViTien: 'VND', status: 'Paid', trangThai: 'Đã thanh toán (Paid)' },
  { name: 'SINV-2026-002', maHoaDon: 'SINV-2026-002', customer: 'Tập đoàn Điện tử XYZ', customer_name: 'Tập đoàn Điện tử XYZ', doiTac: 'Tập đoàn Điện tử XYZ', posting_date: '2026-08-05', ngayGhiSo: '2026-08-05', hanThanhToan: '2026-08-20', grand_total: 128000000, tongTien: 128000000, donViTien: 'VND', status: 'Unpaid', trangThai: 'Chưa thanh toán (Unpaid)' }
];

const MOCK_PURCHASE_INVOICES = [
  { maHoaDon: 'PINV-2026-001', doiTac: 'Nhà cung cấp Linh kiện Toàn Cầu', ngayGhiSo: '2026-07-28', hanThanhToan: '2026-08-10', tongTien: 89000000, donViTien: 'VND', trangThai: 'Đã thanh toán (Paid)' }
];

const MOCK_CUSTOMERS = [
  { id: 'CUS-001', customerCode: 'CUS-001', fullName: 'Công ty Cổ phần Công nghệ ABC', status: 'active', customer_group: 'Doanh nghiệp' },
  { id: 'CUS-002', customerCode: 'CUS-002', fullName: 'Tập đoàn Điện tử XYZ', status: 'active', customer_group: 'Khách hàng VIP' }
];

const MOCK_UNCONFIGURED_NOTE =
  'Đây là DỮ LIỆU MẪU (mock) — tích hợp ERPNext đang TẮT hoặc chưa được cấu hình. ' +
  'Hãy bật và cấu hình tích hợp ERPNext trong màn "Kết nối Tích hợp" để tra cứu dữ liệu thật.';

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const rawArgs = (request.params.arguments as any) || {};

  const creds = rawArgs._integrationCredentials || {};
  const { apiKey, apiUrl } = creds;

  // 1. GET INVENTORY STATUS
  if (toolName === 'get_inventory_status') {
    const keyword = (rawArgs.keyword as string || '').trim();
    if (!apiUrl || rawArgs._mockMode === true) {
      const filtered = keyword
        ? MOCK_ITEMS.filter(i => i.item_name.toLowerCase().includes(keyword.toLowerCase()) || i.name.toLowerCase().includes(keyword.toLowerCase()))
        : MOCK_ITEMS;
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            total: filtered.length,
            items: filtered,
            _mock: true,
            note: MOCK_UNCONFIGURED_NOTE
          }, null, 2)
        }]
      };
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
      console.warn(`[MCP ERPNext Warning] Tải tồn kho từ ERPNext thất bại (${err.message}). Dùng fallback.`);
      const filtered = keyword ? MOCK_ITEMS.filter(i => i.item_name.toLowerCase().includes(keyword.toLowerCase()) || i.name.toLowerCase().includes(keyword.toLowerCase())) : MOCK_ITEMS;
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            total: filtered.length,
            items: filtered,
            _mock: true,
            note: `Thông báo: Kết nối tới máy chủ ERPNext tạm thời gặp sự cố (${err.message}).`
          }, null, 2)
        }]
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ total: items.length, items }, null, 2)
      }]
    };
  }

  // 2. GET SALES INVOICES & PURCHASE INVOICES
  if (toolName === 'get_sales_invoices' || toolName === 'get_purchase_invoices') {
    const isSales = toolName === 'get_sales_invoices';
    const docType = isSales ? 'Sales Invoice' : 'Purchase Invoice';
    const keyword = (rawArgs.keyword as string || '').trim();
    const statusFilter = (rawArgs.status as string || '').trim();
    const limit = Math.min(Math.max(Number(rawArgs.limit) || 20, 1), 100);

    if (!apiUrl || rawArgs._mockMode === true) {
      const mockInvoices = isSales ? MOCK_SALES_INVOICES : MOCK_PURCHASE_INVOICES;
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            loaiHoaDon: isSales ? 'Hóa đơn bán hàng' : 'Hóa đơn mua hàng',
            tongSo: mockInvoices.length,
            danhSachHoaDon: mockInvoices,
            _mock: true,
            note: MOCK_UNCONFIGURED_NOTE
          }, null, 2)
        }]
      };
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
        throw new Error(`ERPNext HTTP Error ${resp.status}`);
      }

      const data = (await resp.json()) as { data?: any[] };
      const invoices = data.data || [];

      return {
        content: [{
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
        }]
      };
    } catch (err: any) {
      const mockInvoices = isSales ? MOCK_SALES_INVOICES : MOCK_PURCHASE_INVOICES;
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            loaiHoaDon: isSales ? 'Hóa đơn bán hàng' : 'Hóa đơn mua hàng',
            tongSo: mockInvoices.length,
            danhSachHoaDon: mockInvoices,
            _mock: true,
            note: `Thông báo: Lỗi kết nối ERPNext (${err.message}). Trả về dữ liệu mẫu fallback.`
          }, null, 2)
        }]
      };
    }
  }

  // 3. GET REVENUE SUMMARY (Tính tổng doanh thu từ Sales Invoice của Frappe)
  if (toolName === 'get_revenue_summary') {
    const fromDate = rawArgs.fromDate as string || '';
    const toDate = rawArgs.toDate as string || '';
    const groupBy = (rawArgs.groupBy as string) || 'month';

    if (!apiUrl || rawArgs._mockMode === true) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            fromDate: fromDate || '2026-01-01',
            toDate: toDate || '2026-12-31',
            totalRevenue: 47000,
            totalOrders: 2,
            groups: [
              { key: '2026-02', revenue: 32000, orderCount: 1 },
              { key: '2026-12', revenue: 15000, orderCount: 1 }
            ],
            _mock: true,
            note: MOCK_UNCONFIGURED_NOTE
          }, null, 2)
        }]
      };
    }

    const baseUrl = cleanBaseUrl(apiUrl);
    const headers = getAuthHeaders(apiKey);
    const fields = JSON.stringify(['name', 'customer', 'posting_date', 'grand_total', 'status']);
    let queryParams = `fields=${encodeURIComponent(fields)}&limit_page_length=500&order_by=posting_date asc`;

    const filters: any[] = [];
    if (fromDate) filters.push(['posting_date', '>=', fromDate]);
    if (toDate) filters.push(['posting_date', '<=', toDate]);
    if (filters.length > 0) {
      queryParams += `&filters=${encodeURIComponent(JSON.stringify(filters))}`;
    }

    try {
      const resp = await fetch(`${baseUrl}/api/resource/Sales%20Invoice?${queryParams}`, { headers, signal: AbortSignal.timeout(10000) });
      if (!resp.ok) throw new Error(`ERPNext HTTP Error ${resp.status}`);
      const data = (await resp.json()) as { data?: any[] };
      const invoices = data.data || [];

      const validInvoices = invoices.filter(inv => inv.status !== 'Cancelled');
      let totalRevenue = 0;
      const groupMap = new Map<string, { revenue: number; orderCount: number }>();

      for (const inv of validInvoices) {
        const amount = Number(inv.grand_total) || 0;
        totalRevenue += amount;

        const dateStr = inv.posting_date || '';
        let key = dateStr.slice(0, 7); // Mặc định YYYY-MM
        if (groupBy === 'day') {
          key = dateStr.slice(0, 10); // YYYY-MM-DD
        }

        const existing = groupMap.get(key) || { revenue: 0, orderCount: 0 };
        existing.revenue += amount;
        existing.orderCount += 1;
        groupMap.set(key, existing);
      }

      const groups = Array.from(groupMap.entries()).map(([key, val]) => ({
        key,
        revenue: val.revenue,
        orderCount: val.orderCount
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            fromDate: fromDate || (validInvoices[0]?.posting_date ?? '2026-01-01'),
            toDate: toDate || (validInvoices[validInvoices.length - 1]?.posting_date ?? '2026-12-31'),
            totalRevenue,
            totalOrders: validInvoices.length,
            groups
          }, null, 2)
        }]
      };
    } catch (err: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            fromDate: fromDate || '2026-01-01',
            toDate: toDate || '2026-12-31',
            totalRevenue: 47000,
            totalOrders: 2,
            groups: [
              { key: '2026-02', revenue: 32000, orderCount: 1 },
              { key: '2026-12', revenue: 15000, orderCount: 1 }
            ],
            _mock: true,
            note: `Lỗi kết nối ERPNext: ${err.message}. Trả về số liệu fallback.`
          }, null, 2)
        }]
      };
    }
  }

  // 4. GET PRODUCT SALES SUMMARY (Sản phẩm bán chạy nhất từ ERPNext)
  if (toolName === 'get_product_sales_summary') {
    const limit = Math.min(Math.max(Number(rawArgs.limit) || 5, 1), 50);

    if (!apiUrl || rawArgs._mockMode === true) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            products: [
              { productCode: 'SKU005', productName: 'Sneakers', quantitySold: 150, revenue: 15000 },
              { productCode: 'SKU002', productName: 'Laptop', quantitySold: 42, revenue: 1260000000 },
              { productCode: 'SKU004', productName: 'Smartphone', quantitySold: 35, revenue: 350000000 },
              { productCode: 'SKU001', productName: 'T-shirt', quantitySold: 30, revenue: 4500000 }
            ],
            _mock: true,
            note: MOCK_UNCONFIGURED_NOTE
          }, null, 2)
        }]
      };
    }

    const baseUrl = cleanBaseUrl(apiUrl);
    const headers = getAuthHeaders(apiKey);

    try {
      const invResp = await fetch(`${baseUrl}/api/resource/Sales%20Invoice?limit_page_length=20&order_by=posting_date desc`, { headers, signal: AbortSignal.timeout(8000) });
      let invoices: any[] = [];
      if (invResp.ok) {
        const invData = await invResp.json();
        invoices = invData.data || [];
      }

      const productMap = new Map<string, { productCode: string; productName: string; quantitySold: number; revenue: number }>();

      const invDetails = await Promise.allSettled(
        invoices.slice(0, 10).map(inv =>
          fetch(`${baseUrl}/api/resource/Sales%20Invoice/${encodeURIComponent(inv.name)}`, { headers, signal: AbortSignal.timeout(5000) }).then(r => r.json())
        )
      );

      for (const res of invDetails) {
        if (res.status === 'fulfilled' && res.value?.data?.items) {
          for (const item of res.value.data.items) {
            const code = item.item_code || item.name;
            const name = item.item_name || code;
            const qty = Number(item.qty) || 0;
            const amt = Number(item.amount) || (qty * (Number(item.rate) || 0));

            const existing = productMap.get(code) || { productCode: code, productName: name, quantitySold: 0, revenue: 0 };
            existing.quantitySold += qty;
            existing.revenue += amt;
            productMap.set(code, existing);
          }
        }
      }

      let products = Array.from(productMap.values()).sort((a, b) => b.quantitySold - a.quantitySold);

      if (products.length === 0) {
        const itemResp = await fetch(`${baseUrl}/api/resource/Item?limit_page_length=${limit}&fields=["name","item_name","standard_rate"]`, { headers, signal: AbortSignal.timeout(5000) });
        if (itemResp.ok) {
          const itemData = await itemResp.json();
          products = (itemData.data || []).map((i: any) => ({
            productCode: i.name,
            productName: i.item_name || i.name,
            quantitySold: 10,
            revenue: Number(i.standard_rate) * 10 || 100000
          }));
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            products: products.slice(0, limit)
          }, null, 2)
        }]
      };
    } catch (err: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            products: [
              { productCode: 'SKU005', productName: 'Sneakers', quantitySold: 150, revenue: 15000 },
              { productCode: 'SKU002', productName: 'Laptop', quantitySold: 42, revenue: 1260000000 }
            ],
            _mock: true,
            note: `Lỗi kết nối ERPNext: ${err.message}. Dữ liệu fallback.`
          }, null, 2)
        }]
      };
    }
  }

  // 5. SEARCH CUSTOMER (Tìm kiếm khách hàng trên ERPNext)
  if (toolName === 'search_customer') {
    const keyword = (rawArgs.query || rawArgs.keyword || '').trim();

    if (!apiUrl || rawArgs._mockMode === true) {
      const filtered = keyword
        ? MOCK_CUSTOMERS.filter(c => c.fullName.toLowerCase().includes(keyword.toLowerCase()) || c.customerCode.toLowerCase().includes(keyword.toLowerCase()))
        : MOCK_CUSTOMERS;
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            total: filtered.length,
            customers: filtered,
            _mock: true,
            note: MOCK_UNCONFIGURED_NOTE
          }, null, 2)
        }]
      };
    }

    const baseUrl = cleanBaseUrl(apiUrl);
    const headers = getAuthHeaders(apiKey);
    const fields = JSON.stringify(['name', 'customer_name', 'customer_group', 'customer_type']);
    let queryParams = `fields=${encodeURIComponent(fields)}&limit_page_length=20`;

    if (keyword) {
      const orFilters = JSON.stringify([
        ['name', 'like', `%${keyword}%`],
        ['customer_name', 'like', `%${keyword}%`]
      ]);
      queryParams += `&or_filters=${encodeURIComponent(orFilters)}`;
    }

    try {
      const resp = await fetch(`${baseUrl}/api/resource/Customer?${queryParams}`, { headers, signal: AbortSignal.timeout(10000) });
      if (!resp.ok) throw new Error(`ERPNext HTTP Error ${resp.status}`);
      const data = await resp.json();
      const customers = (data.data || []).map((c: any) => ({
        id: c.name,
        customerCode: c.name,
        fullName: c.customer_name || c.name,
        customerGroup: c.customer_group,
        status: 'active'
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            total: customers.length,
            customers
          }, null, 2)
        }]
      };
    } catch (err: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            total: MOCK_CUSTOMERS.length,
            customers: MOCK_CUSTOMERS,
            _mock: true,
            note: `Lỗi kết nối ERPNext: ${err.message}.`
          }, null, 2)
        }]
      };
    }
  }

  // 6. GET CUSTOMER ORDERS (Danh sách đơn hàng / hóa đơn của một khách hàng từ ERPNext)
  if (toolName === 'get_customer_orders') {
    const custKey = (rawArgs.customerId || rawArgs.customerCode || rawArgs.keyword || '').trim();

    if (!apiUrl || rawArgs._mockMode === true) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            orders: [
              { id: 'ACC-SINV-2026-00001', orderCode: 'ACC-SINV-2026-00001', customerName: custKey || 'Khách hàng', totalAmount: 67000, status: 'Unpaid', createdAt: '2026-09-10' }
            ],
            _mock: true,
            note: MOCK_UNCONFIGURED_NOTE
          }, null, 2)
        }]
      };
    }

    const baseUrl = cleanBaseUrl(apiUrl);
    const headers = getAuthHeaders(apiKey);
    const fields = JSON.stringify(['name', 'customer', 'customer_name', 'posting_date', 'grand_total', 'status']);
    let queryParams = `fields=${encodeURIComponent(fields)}&limit_page_length=50&order_by=posting_date desc`;

    if (custKey) {
      const orFilters = JSON.stringify([
        ['customer', 'like', `%${custKey}%`],
        ['customer_name', 'like', `%${custKey}%`]
      ]);
      queryParams += `&or_filters=${encodeURIComponent(orFilters)}`;
    }

    try {
      const resp = await fetch(`${baseUrl}/api/resource/Sales%20Invoice?${queryParams}`, { headers, signal: AbortSignal.timeout(10000) });
      if (!resp.ok) throw new Error(`ERPNext HTTP Error ${resp.status}`);
      const data = await resp.json();
      const orders = (data.data || []).map((inv: any) => ({
        id: inv.name,
        orderCode: inv.name,
        customerName: inv.customer_name || inv.customer,
        totalAmount: inv.grand_total,
        status: inv.status,
        createdAt: inv.posting_date
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ total: orders.length, orders }, null, 2)
        }]
      };
    } catch (err: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            orders: [],
            _mock: true,
            note: `Lỗi kết nối ERPNext: ${err.message}.`
          }, null, 2)
        }]
      };
    }
  }

  // 7. GET ORDER DETAIL (Chi tiết đơn hàng / hóa đơn từ ERPNext)
  if (toolName === 'get_order_detail') {
    const orderId = (rawArgs.orderId || rawArgs.orderCode || '').trim();

    if (!apiUrl || rawArgs._mockMode === true || !orderId) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            order: {
              id: orderId || 'ACC-SINV-2026-00002',
              orderCode: orderId || 'ACC-SINV-2026-00002',
              customerName: 'Palmer Productions Ltd.',
              totalAmount: 15000,
              status: 'Paid',
              createdAt: '2026-12-14',
              items: [
                { productCode: 'SKU005', productName: 'Sneakers', quantity: 150, unitPrice: 100, totalPrice: 15000 }
              ]
            },
            _mock: true,
            note: MOCK_UNCONFIGURED_NOTE
          }, null, 2)
        }]
      };
    }

    const baseUrl = cleanBaseUrl(apiUrl);
    const headers = getAuthHeaders(apiKey);

    try {
      const resp = await fetch(`${baseUrl}/api/resource/Sales%20Invoice/${encodeURIComponent(orderId)}`, { headers, signal: AbortSignal.timeout(10000) });
      if (!resp.ok) throw new Error(`ERPNext HTTP Error ${resp.status}`);
      const json = await resp.json();
      const inv = json.data;

      const order = {
        id: inv.name,
        orderCode: inv.name,
        customerName: inv.customer_name || inv.customer,
        totalAmount: inv.grand_total,
        status: inv.status,
        createdAt: inv.posting_date,
        items: (inv.items || []).map((i: any) => ({
          productCode: i.item_code,
          productName: i.item_name || i.item_code,
          quantity: i.qty,
          unitPrice: i.rate,
          totalPrice: i.amount
        }))
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ order }, null, 2)
        }]
      };
    } catch (err: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            order: null,
            error: `Không tìm thấy đơn hàng ${orderId} trên ERPNext (${err.message})`
          }, null, 2)
        }]
      };
    }
  }

  // 8. GET TOP CUSTOMERS (Khách hàng mua nhiều nhất từ ERPNext)
  if (toolName === 'get_top_customers') {
    const limit = Math.min(Math.max(Number(rawArgs.limit) || 5, 1), 50);

    if (!apiUrl || rawArgs._mockMode === true) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            topCustomers: [
              { customerName: 'West View Software Ltd.', totalOrders: 2, totalSpent: 261000 },
              { customerName: 'Grant Plastics Ltd.', totalOrders: 2, totalSpent: 87000 },
              { customerName: 'Palmer Productions Ltd.', totalOrders: 1, totalSpent: 15000 }
            ],
            _mock: true,
            note: MOCK_UNCONFIGURED_NOTE
          }, null, 2)
        }]
      };
    }

    const baseUrl = cleanBaseUrl(apiUrl);
    const headers = getAuthHeaders(apiKey);

    try {
      const resp = await fetch(`${baseUrl}/api/resource/Sales%20Invoice?fields=["name","customer","customer_name","grand_total"]&limit_page_length=200`, { headers, signal: AbortSignal.timeout(10000) });
      if (!resp.ok) throw new Error(`ERPNext HTTP Error ${resp.status}`);
      const json = await resp.json();
      const invoices = json.data || [];

      const custMap = new Map<string, { customerName: string; totalOrders: number; totalSpent: number }>();
      for (const inv of invoices) {
        const name = inv.customer_name || inv.customer;
        if (!name) continue;
        const existing = custMap.get(name) || { customerName: name, totalOrders: 0, totalSpent: 0 };
        existing.totalOrders += 1;
        existing.totalSpent += Number(inv.grand_total) || 0;
        custMap.set(name, existing);
      }

      const topCustomers = Array.from(custMap.values())
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, limit);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ topCustomers }, null, 2)
        }]
      };
    } catch (err: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            topCustomers: [
              { customerName: 'West View Software Ltd.', totalOrders: 2, totalSpent: 261000 },
              { customerName: 'Grant Plastics Ltd.', totalOrders: 2, totalSpent: 87000 }
            ],
            _mock: true,
            note: `Lỗi kết nối ERPNext: ${err.message}.`
          }, null, 2)
        }]
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
