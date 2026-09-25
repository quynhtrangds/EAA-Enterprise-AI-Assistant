import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import crypto from 'node:crypto';

export const mcpServer = new Server({
  name: 'mcp-server-n8n',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

export function sanitizeWebhookPath(rawPath?: string, defaultPath: string = '26317864-61db-424c-87f5-abd29ce33599'): string {
  const path = (rawPath && typeof rawPath === 'string') ? rawPath.trim() : '';
  if (!path) {
    return defaultPath;
  }

  // Chống SSRF: Tuyệt đối không nhận URL đầy đủ hoặc protocol scheme
  if (/^https?:\/\//i.test(path) || path.startsWith('//') || path.includes(':')) {
    throw new Error('Tên hoặc mã webhook không hợp lệ: Không được phép truyền URL đầy đủ (chống SSRF). Chỉ truyền mã ID webhook (ví dụ: 26317864-61db-424c-87f5-abd29ce33599).');
  }

  // Chống Path Traversal: Không cho phép '..' hoặc ký tự nguy hiểm
  if (path.includes('..') || path.includes('\\')) {
    throw new Error('Mã webhook không hợp lệ: Không được chứa ký tự path traversal (.. hoặc \\).');
  }

  const clean = path.replace(/^\/+/, '');
  // Chỉ chấp nhận ký tự an toàn: chữ cái, số, gạch dưới, gạch ngang, hoặc slug tương đối
  if (!/^[a-zA-Z0-9_\-]+(\/[a-zA-Z0-9_\-]+)*$/.test(clean)) {
    throw new Error('Mã webhook không hợp lệ. Chỉ chấp nhận chữ cái, số, gạch ngang, gạch dưới hoặc slug đường dẫn tương đối.');
  }

  return clean;
}

export function buildTargetUrl(baseUrl: string, cleanWebhookPath: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  if (cleanWebhookPath.startsWith('webhook/') || cleanWebhookPath.startsWith('webhook-test/')) {
    return `${normalizedBase}/${cleanWebhookPath}`;
  }
  return `${normalizedBase}/webhook/${cleanWebhookPath}`;
}

export function validateAndSanitizeDownloadUrl(
  rawDownloadUrl: unknown,
  fallbackUrl: string,
  allowedHostnames: string[] = ['localhost', '127.0.0.1', 'enterprise_ai_n8n']
): string {
  if (!rawDownloadUrl || typeof rawDownloadUrl !== 'string') {
    return fallbackUrl;
  }

  try {
    const parsed = new URL(rawDownloadUrl);
    // Chỉ chấp nhận http: hoặc https: (ngăn chặn javascript:, data:, file:)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return fallbackUrl;
    }

    const host = parsed.hostname.toLowerCase();
    const isAllowed = allowedHostnames.some(allowed => 
      host === allowed.toLowerCase() || host.endsWith(`.${allowed.toLowerCase()}`)
    );

    if (!isAllowed) {
      return fallbackUrl;
    }

    return parsed.toString();
  } catch {
    return fallbackUrl;
  }
}

export function generateSignedDownloadUrl(
  orderId: string,
  customerName: string = '',
  secret: string = process.env.PDF_DOWNLOAD_SECRET || process.env.JWT_SECRET || 'eaa_pdf_download_secret_2026',
  expiresInMs: number = 15 * 60 * 1000,
  baseUrl: string = 'http://localhost:5678/webhook/download-invoice',
  extraParams: Record<string, any> = {}
): string {
  const expires = Date.now() + expiresInMs;
  const signature = crypto.createHmac('sha256', secret).update(`${orderId}:${expires}`).digest('hex');
  const url = new URL(baseUrl);
  url.searchParams.set('order_id', orderId);
  if (customerName) {
    url.searchParams.set('customer_name', customerName);
  }
  if (extraParams.total !== undefined && extraParams.total !== null) {
    url.searchParams.set('total', extraParams.total.toString());
  }
  if (extraParams.status) {
    url.searchParams.set('status', extraParams.status.toString());
  }
  if (extraParams.currency) {
    url.searchParams.set('currency', extraParams.currency.toString());
  }
  if (extraParams.posting_date || extraParams.postingDate) {
    url.searchParams.set('posting_date', (extraParams.posting_date || extraParams.postingDate).toString());
  }
  if (extraParams.items && Array.isArray(extraParams.items) && extraParams.items.length > 0) {
    url.searchParams.set('items', JSON.stringify(extraParams.items));
  }
  url.searchParams.set('expires', expires.toString());
  url.searchParams.set('signature', signature);
  return url.toString();
}

export function verifySignedDownloadToken(
  orderId: string,
  expires: number | string,
  signature: string,
  secret: string = process.env.PDF_DOWNLOAD_SECRET || process.env.JWT_SECRET || 'eaa_pdf_download_secret_2026'
): { valid: boolean; reason?: string } {
  if (!orderId) {
    return { valid: false, reason: 'Thiếu mã đơn hàng' };
  }
  const expNum = Number(expires);
  if (!expires || isNaN(expNum)) {
    return { valid: false, reason: 'Thiếu thời hạn hợp lệ' };
  }
  if (Date.now() > expNum) {
    return { valid: false, reason: 'Liên kết tải file đã hết hạn (chỉ có hiệu lực 15 phút)' };
  }
  const expectedSignature = crypto.createHmac('sha256', secret).update(`${orderId}:${expNum}`).digest('hex');
  if (signature !== expectedSignature) {
    return { valid: false, reason: 'Chữ ký bảo mật không hợp lệ (Tampered/Invalid Signature)' };
  }
  return { valid: true };
}

export interface VerifyOrderDetailOptions {
  credentials?: any;
  tenantId?: string;
  mockMode?: boolean;
}

export interface VerifyOrderDetailResult {
  valid: boolean;
  order?: {
    id: string;
    orderCode: string;
    customerName?: string;
    totalAmount?: number;
    status?: string;
    tenantId?: string;
    [key: string]: any;
  };
  reason?: string;
  errorCode?: string;
}

export const KNOWN_MOCK_ORDERS: Record<string, { id: string; customerName: string; totalAmount: number; status: string; tenantId?: string; items?: any[] }> = {
  'ACC-SINV-2026-00001': {
    id: 'ACC-SINV-2026-00001',
    customerName: 'Grant Plastics Ltd.',
    totalAmount: 67000,
    status: 'Overdue',
    items: [
      { name: 'Backpack', item_code: 'SKU008', qty: 20, price: 500, total: 10000 },
      { name: 'Headphones', item_code: 'SKU009', qty: 40, price: 300, total: 12000 },
      { name: 'Camera', item_code: 'SKU010', qty: 50, price: 900, total: 45000 }
    ]
  },
  'ACC-SINV-2026-00002': {
    id: 'ACC-SINV-2026-00002',
    customerName: 'Palmer Productions Ltd.',
    totalAmount: 15000,
    status: 'Paid',
    items: [
      { name: 'Desk Chair', item_code: 'SKU001', qty: 1, price: 15000, total: 15000 }
    ]
  },
  'SINV-2026-001': {
    id: 'SINV-2026-001',
    customerName: 'Công ty Cổ phần Công nghệ ABC',
    totalAmount: 45000000,
    status: 'Paid'
  },
  'SINV-2026-002': {
    id: 'SINV-2026-002',
    customerName: 'Tập đoàn Điện tử XYZ',
    totalAmount: 128000000,
    status: 'Unpaid'
  },
  'ORD-001': { id: 'ORD-001', customerName: 'Nguyễn Văn A', totalAmount: 26800000, status: 'paid' },
  'ORD-002': { id: 'ORD-002', customerName: 'Trần Thị B', totalAmount: 18750000, status: 'completed' },
  'ORD-003': { id: 'ORD-003', customerName: 'Công ty Minh Long', totalAmount: 51200000, status: 'paid' },
  'ORD-004': { id: 'ORD-004', customerName: 'Lê Văn C', totalAmount: 15400000, status: 'shipping' },
  'ORD-005': { id: 'ORD-005', customerName: 'Phạm Thị D', totalAmount: 10700000, status: 'paid' },
  'ORD-006': { id: 'ORD-006', customerName: 'Nguyễn Văn A', totalAmount: 33900000, status: 'completed' },
  'ORD-007': { id: 'ORD-007', customerName: 'Hoàng Gia Retail', totalAmount: 42800000, status: 'paid' },
  'ORD-008': { id: 'ORD-008', customerName: 'Nguyễn Thị Hoa', totalAmount: 6500000, status: 'cancelled' },
  'ORD-009': { id: 'ORD-009', customerName: 'An Phát Trading', totalAmount: 31400000, status: 'paid' },
  'ORD-010': { id: 'ORD-010', customerName: 'Công ty Minh Long', totalAmount: 69600000, status: 'completed' },
  'ORD-011': { id: 'ORD-011', customerName: 'Trần Thị B', totalAmount: 28600000, status: 'paid' },
  'ORD-012': { id: 'ORD-012', customerName: 'Lê Văn C', totalAmount: 9700000, status: 'paid' },
};

/**
 * Xác thực đơn hàng/hóa đơn thực sự tồn tại và thuộc đúng tenant
 * trước khi tạo chữ ký HMAC signed URL cho file PDF.
 */
export async function verifyOrderDetail(
  orderId: string,
  options: VerifyOrderDetailOptions = {}
): Promise<VerifyOrderDetailResult> {
  const cleanOrderId = (orderId || '').trim();
  if (!cleanOrderId) {
    return {
      valid: false,
      errorCode: 'MISSING_ORDER_ID',
      reason: 'Thiếu mã đơn hàng hợp lệ để xuất hóa đơn.'
    };
  }

  const { credentials = {}, tenantId, mockMode } = options;
  const erpCreds = credentials.erpnext || (credentials.apiUrl && !credentials.apiUrl.includes(':5678') ? credentials : null);
  const erpApiUrl = erpCreds?.apiUrl || process.env.ERPNEXT_API_URL;
  const erpApiKey = erpCreds?.apiKey || process.env.ERPNEXT_API_KEY;

  // 1. Nếu có cấu hình ERPNext thật và không phải mockMode ép buộc
  if (erpApiUrl && mockMode !== true) {
    try {
      let baseUrl = erpApiUrl.trim().replace(/\/+$/, '');
      baseUrl = baseUrl.replace(/\/api\/resource(\/[^/]+)?$/i, '').replace(/\/api$/i, '');
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (erpApiKey) {
        headers['Authorization'] = erpApiKey.startsWith('token ') ? erpApiKey : `token ${erpApiKey}`;
      }

      const targetUrl = `${baseUrl}/api/resource/Sales%20Invoice/${encodeURIComponent(cleanOrderId)}`;
      const resp = await fetch(targetUrl, {
        headers,
        signal: AbortSignal.timeout(10000)
      });

      if (resp.status === 404) {
        return {
          valid: false,
          errorCode: 'ORDER_NOT_FOUND',
          reason: `Đơn hàng/hóa đơn "${cleanOrderId}" không tồn tại trên hệ thống ERPNext của doanh nghiệp.`
        };
      }

      if (!resp.ok) {
        return {
          valid: false,
          errorCode: 'ERPNEXT_FETCH_FAILED',
          reason: `Không thể kết nối xác thực đơn hàng qua ERPNext (HTTP ${resp.status}).`
        };
      }

      const json: any = await resp.json();
      const inv = json?.data;
      if (!inv || !inv.name) {
        return {
          valid: false,
          errorCode: 'ORDER_NOT_FOUND',
          reason: `Hóa đơn "${cleanOrderId}" không có dữ liệu hợp lệ trên ERPNext.`
        };
      }

      // Kiểm tra tenant isolation (nếu có custom_tenant_id hoặc metadata tenant trong invoice)
      if (tenantId && inv.custom_tenant_id && inv.custom_tenant_id !== tenantId) {
        return {
          valid: false,
          errorCode: 'TENANT_ORDER_MISMATCH',
          reason: `Đơn hàng "${cleanOrderId}" không thuộc quyền sở hữu của tenant hiện tại.`
        };
      }

      return {
        valid: true,
        order: {
          id: inv.name,
          orderCode: inv.name,
          customerName: inv.customer_name || inv.customer || '',
          totalAmount: inv.grand_total,
          status: inv.status,
          tenantId,
          items: inv.items,
          currency: inv.currency || inv.party_account_currency,
          postingDate: inv.posting_date
        }
      };
    } catch (err: any) {
      return {
        valid: false,
        errorCode: 'ERPNEXT_CONNECTION_ERROR',
        reason: `Lỗi kết nối tới ERPNext để xác thực đơn hàng: ${err.message}`
      };
    }
  }

  // 2. Chế độ Mock Mode hoặc ERPNext chưa liên kết:
  // Xác thực nghiêm ngặt với danh mục đơn hàng hợp lệ đã ghi nhận trong hệ thống
  const upperId = cleanOrderId.toUpperCase();
  const matchedKey = Object.keys(KNOWN_MOCK_ORDERS).find(k => k.toUpperCase() === upperId);

  if (!matchedKey) {
    return {
      valid: false,
      errorCode: 'ORDER_NOT_FOUND',
      reason: `Không tìm thấy đơn hàng "${cleanOrderId}" trong hệ thống doanh nghiệp (đơn hàng không tồn tại). Tuyệt đối không tạo liên kết tải file cho đơn hàng không hợp lệ.`
    };
  }

  const foundOrder = KNOWN_MOCK_ORDERS[matchedKey];
  if (tenantId && foundOrder.tenantId && foundOrder.tenantId !== tenantId) {
    return {
      valid: false,
      errorCode: 'TENANT_ORDER_MISMATCH',
      reason: `Đơn hàng "${cleanOrderId}" không thuộc về tenant của bạn.`
    };
  }

  return {
    valid: true,
    order: {
      ...foundOrder,
      orderCode: foundOrder.id,
      tenantId: tenantId || foundOrder.tenantId
    }
  };
}

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'trigger_n8n_webhook',
        description: 'Kích hoạt quy trình tự động hóa trên n8n qua Webhook để xuất HÓA ĐƠN BÁN HÀNG dạng PDF (action: "export_pdf") hoặc gửi tin nhắn Telegram (action: "telegram"). LƯU Ý QUAN TRỌNG: Tính năng export_pdf CHỈ hỗ trợ duy nhất Hóa đơn bán hàng từ ERPNext (bắt buộc phải có mã đơn hàng order_id). TUYỆT ĐỐI KHÔNG gọi công cụ này để xuất phiếu hỗ trợ/ticket Helpdesk (Zammad) hay báo cáo khác vì n8n chưa hỗ trợ mẫu cho các tài liệu này. Khi xuất hóa đơn PDF thành công và có downloadUrl, BẮT BUỘC hiển thị link: [📥 Tải về file PDF hóa đơn](downloadUrl).',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description: 'Loại tác vụ tự động hóa: "export_pdf" (CHỈ DÙNG khi xuất hóa đơn bán hàng ERPNext, yêu cầu có order_id); "telegram" khi gửi tin nhắn Telegram.'
            },
            webhookPath: {
              type: 'string',
              description: 'Mã ID webhook trên n8n (ví dụ: "26317864-61db-424c-87f5-abd29ce33599" hoặc để trống để tự động dùng webhook mặc định). Không được truyền URL đầy đủ.'
            },
            message: {
              type: 'string',
              description: 'Nội dung thông báo hoặc thông tin chính cần gửi qua quy trình tự động'
            },
            data: {
              type: 'object',
              description: 'Dữ liệu bổ sung tùy chọn (ví dụ: { order_id: "ACC-SINV-2026-00001", customer_name: "Nguyễn Văn A", total: 1500000 }). Với export_pdf, order_id là bắt buộc.'
            }
          },
          required: ['message']
        }
      }
    ]
  };
});

export async function handleTriggerN8nWebhook(rawArgs: any) {
  const { webhookPath, message, data, action } = rawArgs;
    const creds = rawArgs._integrationCredentials || {};
    let baseUrl = creds.apiUrl || process.env.N8N_BASE_URL || 'http://enterprise_ai_n8n:5678';
    const apiKey = creds.apiKey;
    const defaultWebhookPath = creds.defaultWebhookPath || '26317864-61db-424c-87f5-abd29ce33599';

    baseUrl = baseUrl.replace(/\/+$/, '');

    // Tự động nhận diện action nếu LLM không truyền rõ ràng
    let resolvedAction = action || (data && (data as any).action);
    if (!resolvedAction) {
      if (
        (data && ((data as any).orderCode || (data as any).order_id || (data as any).orderId)) ||
        (message && /(hóa đơn|invoice|pdf|phiếu bán|xuất hóa đơn)/i.test(message))
      ) {
        resolvedAction = 'export_pdf';
      } else {
        resolvedAction = 'telegram';
      }
    }

    const orderId = (data && ((data as any).order_id || (data as any).orderCode || (data as any).orderId)) || '';
    let customerName = (data && ((data as any).customer_name || (data as any).customerName)) || '';

    // Chặn gọi nhầm export_pdf cho ticket Zammad khi thiếu order_id
    if (resolvedAction === 'export_pdf' && !orderId && (Boolean(data?.tickets) || /(ticket|phiếu hỗ trợ)/i.test(message || ''))) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              errorCode: 'UNSUPPORTED_DOCUMENT_TYPE',
              message: 'Quy trình n8n hiện tại CHỈ hỗ trợ xuất file PDF cho Hóa đơn bán hàng từ ERPNext (yêu cầu mã đơn hàng order_id). Hệ thống chưa hỗ trợ xuất file PDF cho phiếu hỗ trợ/ticket Zammad. Vui lòng thông báo cho người dùng biết giới hạn này và trình bày thông tin ticket dưới dạng bảng Markdown trực quan ngay trong câu trả lời.'
            }, null, 2)
          }
        ]
      };
    }

    // Enforcement ở tầng code: Trước khi ký signature hay kích hoạt webhook n8n, tự gọi lại get_order_detail
    // (qua context _integrationCredentials / tenant) để xác nhận orderId thật sự tồn tại và thuộc đúng tenant!
    let orderVerification: VerifyOrderDetailResult | null = null;
    if (resolvedAction === 'export_pdf') {
      orderVerification = await verifyOrderDetail(orderId, {
        credentials: creds,
        tenantId: rawArgs._tenantId,
        mockMode: rawArgs._mockMode
      });

      if (!orderVerification.valid) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                errorCode: orderVerification.errorCode || 'ORDER_NOT_FOUND',
                message: orderVerification.reason || `Không tìm thấy đơn hàng "${orderId}" trong hệ thống doanh nghiệp.`
              }, null, 2)
            }
          ]
        };
      }

      // Ghi đè customerName bằng dữ liệu xác thực chính chủ từ hệ thống thay vì tin tưởng dữ liệu do LLM bịa ra
      if (orderVerification.order?.customerName) {
        customerName = orderVerification.order.customerName;
      }
    }

    // Sanitize webhookPath (chặn SSRF & Path Traversal)
    const cleanPath = sanitizeWebhookPath(webhookPath, defaultWebhookPath);
    let targetUrl = buildTargetUrl(baseUrl, cleanPath);

    const payload = {
      sender: 'Enterprise AI Assistant',
      action: resolvedAction,
      order_id: orderId,
      orderCode: orderId,
      customer_name: customerName,
      customerName: customerName,
      message: message || '',
      ...(data && typeof data === 'object' ? data : {}),
      timestamp: new Date().toISOString()
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Chỉ gửi X-N8N-API-KEY khi targetUrl hướng tới baseUrl đã cấu hình
    if (apiKey && targetUrl.startsWith(baseUrl)) {
      headers['X-N8N-API-KEY'] = apiKey;
    }

    let response: Response;
    try {
      response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      // Nếu URL trả về 404 (chưa đăng ký đường dẫn này), thử fallback về defaultWebhookPath hoặc webhook-test
      if (response.status === 404) {
        // 1. Thử fallback sang defaultWebhookPath nếu trước đó dùng path khác
        if (cleanPath !== defaultWebhookPath) {
          const defaultUrl = buildTargetUrl(baseUrl, defaultWebhookPath);
          const defaultResp = await fetch(defaultUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });
          if (defaultResp.ok) {
            response = defaultResp;
            targetUrl = defaultUrl;
          }
        }

        // 2. Nếu vẫn 404 và có chứa /webhook/, thử webhook-test
        if (!response.ok && targetUrl.includes('/webhook/')) {
          const testUrl = targetUrl.replace('/webhook/', '/webhook-test/');
          const testResp = await fetch(testUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });
          if (testResp.ok) {
            response = testResp;
            targetUrl = testUrl;
          }
        }
      }
    } catch (err: any) {
      throw new Error(`Không thể kết nối đến máy chủ n8n tại ${targetUrl}: ${err.message}`);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`n8n phản hồi lỗi [HTTP ${response.status}]: ${errText || response.statusText}`);
    }

    let responseData: unknown;
    try {
      responseData = await response.json();
    } catch {
      responseData = await response.text();
    }

    const downloadSecret = process.env.PDF_DOWNLOAD_SECRET || process.env.JWT_SECRET || 'eaa_pdf_download_secret_2026';
    
    // Thu thập chi tiết đơn hàng (items, total, status) để gắn vào downloadUrl
    const rawItems = orderVerification?.order?.items || (data && Array.isArray(data.items) ? data.items : []);
    const normalizedItems = rawItems.map((i: any) => ({
      name: i.name || i.item_name || i.productName || i.item_code || i.productCode || 'Sản phẩm',
      qty: Number(i.qty || i.quantity) || 1,
      price: Number(i.price || i.rate || i.unitPrice) || 0,
      total: Number(i.total || i.amount || i.totalPrice) || ((Number(i.qty || i.quantity) || 1) * (Number(i.price || i.rate || i.unitPrice) || 0))
    }));

    const orderTotal = orderVerification?.order?.totalAmount ?? (data && (data.total ?? data.grand_total)) ?? (normalizedItems.length > 0 ? normalizedItems.reduce((acc: number, it: any) => acc + it.total, 0) : undefined);
    const orderStatus = orderVerification?.order?.status || (data && data.status) || undefined;
    const orderCurrency = orderVerification?.order?.currency || (data && data.currency) || 'VNĐ';
    const postingDate = orderVerification?.order?.postingDate || (data && (data.posting_date || data.postingDate)) || undefined;

    const extraParams: Record<string, any> = {};
    if (normalizedItems.length > 0) extraParams.items = normalizedItems;
    if (orderTotal !== undefined && orderTotal !== null) extraParams.total = orderTotal;
    if (orderStatus) extraParams.status = orderStatus;
    if (orderCurrency) extraParams.currency = orderCurrency;
    if (postingDate) extraParams.posting_date = postingDate;

    const fallbackDownloadUrl = generateSignedDownloadUrl(orderId, customerName, downloadSecret, 15 * 60 * 1000, 'http://localhost:5678/webhook/download-invoice', extraParams);
    
    let baseHost = 'enterprise_ai_n8n';
    try {
      baseHost = new URL(baseUrl).hostname;
    } catch {}

    const allowedHosts = ['localhost', '127.0.0.1', 'enterprise_ai_n8n', baseHost];
    let signedDownloadUrl = fallbackDownloadUrl;

    if (responseData && typeof responseData === 'object' && (responseData as any).downloadUrl) {
      const sanitized = validateAndSanitizeDownloadUrl((responseData as any).downloadUrl, fallbackDownloadUrl, allowedHosts);
      try {
        const u = new URL(sanitized);
        if (!u.searchParams.has('order_id') && orderId) {
          u.searchParams.set('order_id', orderId);
        }
        if (!u.searchParams.has('customer_name') && customerName) {
          u.searchParams.set('customer_name', customerName);
        }
        if (extraParams.total !== undefined && !u.searchParams.has('total')) {
          u.searchParams.set('total', extraParams.total.toString());
        }
        if (extraParams.items && !u.searchParams.has('items')) {
          u.searchParams.set('items', JSON.stringify(extraParams.items));
        }
        if (extraParams.status && !u.searchParams.has('status')) {
          u.searchParams.set('status', extraParams.status);
        }
        if (extraParams.currency && !u.searchParams.has('currency')) {
          u.searchParams.set('currency', extraParams.currency);
        }
        if (extraParams.posting_date && !u.searchParams.has('posting_date')) {
          u.searchParams.set('posting_date', extraParams.posting_date);
        }
        if (!u.searchParams.has('signature') || !u.searchParams.has('expires')) {
          const expires = Date.now() + 15 * 60 * 1000;
          const signature = crypto.createHmac('sha256', downloadSecret).update(`${orderId}:${expires}`).digest('hex');
          u.searchParams.set('expires', expires.toString());
          u.searchParams.set('signature', signature);
        }
        signedDownloadUrl = u.toString();
      } catch {
        signedDownloadUrl = sanitized;
      }
    }

    const downloadUrl = signedDownloadUrl;

    const resultPayload: any = {
      success: true,
      status: 'Triggered successfully',
      targetUrl,
      deliveredMessage: message,
      n8nResponse: responseData
    };

    if (resolvedAction === 'export_pdf') {
      resultPayload.downloadUrl = downloadUrl;
      resultPayload.instruction = `File PDF hóa đơn đã được khởi tạo thành công! Hãy gửi cho người dùng đường link markdown để họ nhấp vào tải về ngay: [📥 Tải về file PDF hóa đơn](${downloadUrl})`;
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(resultPayload, null, 2)
        }
      ]
    };
}

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const rawArgs = (request.params.arguments as any) || {};

  if (toolName === 'trigger_n8n_webhook') {
    return await handleTriggerN8nWebhook(rawArgs);
  }

  throw new Error(`Tool not found: ${toolName}`);
});

async function run() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.log('n8n MCP Server running on stdio');
}

if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
  run().catch(console.error);
}
