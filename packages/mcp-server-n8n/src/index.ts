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
  baseUrl: string = 'http://localhost:5678/webhook/download-invoice'
): string {
  const expires = Date.now() + expiresInMs;
  const signature = crypto.createHmac('sha256', secret).update(`${orderId}:${expires}`).digest('hex');
  const url = new URL(baseUrl);
  url.searchParams.set('order_id', orderId);
  if (customerName) {
    url.searchParams.set('customer_name', customerName);
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

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const rawArgs = (request.params.arguments as any) || {};

  if (toolName === 'trigger_n8n_webhook') {
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
    const customerName = (data && ((data as any).customer_name || (data as any).customerName)) || '';

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
    const fallbackDownloadUrl = generateSignedDownloadUrl(orderId, customerName, downloadSecret);
    
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
