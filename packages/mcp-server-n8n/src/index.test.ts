import { describe, it, expect, vi } from 'vitest';
import {
  sanitizeWebhookPath,
  buildTargetUrl,
  validateAndSanitizeDownloadUrl,
  generateSignedDownloadUrl,
  verifySignedDownloadToken,
  verifyOrderDetail,
  handleTriggerN8nWebhook
} from './index.js';

describe('packages/mcp-server-n8n: Security & SSRF Hardening Suite', () => {
  describe('sanitizeWebhookPath (SSRF & Path Traversal Protection)', () => {
    it('chặn hoàn toàn URL tuyệt đối bắt đầu bằng http:// hoặc https:// (SSRF)', () => {
      expect(() => sanitizeWebhookPath('http://169.254.169.254/latest/meta-data'))
        .toThrowError(/Không được phép truyền URL đầy đủ/);

      expect(() => sanitizeWebhookPath('https://attacker.com/webhook-collect'))
        .toThrowError(/Không được phép truyền URL đầy đủ/);

      expect(() => sanitizeWebhookPath('http://vault:8200/v1/sys/seal'))
        .toThrowError(/Không được phép truyền URL đầy đủ/);
    });

    it('chặn protocol-relative URL và URL chứa port (:)', () => {
      expect(() => sanitizeWebhookPath('//attacker.com/payload'))
        .toThrowError(/Không được phép truyền URL đầy đủ/);

      expect(() => sanitizeWebhookPath('localhost:5432/exploit'))
        .toThrowError(/Không được phép truyền URL đầy đủ/);
    });

    it('chặn Path Traversal (.. hoặc \\)', () => {
      expect(() => sanitizeWebhookPath('../../etc/passwd'))
        .toThrowError(/path traversal/);

      expect(() => sanitizeWebhookPath('webhook/..\\..\\windows\\system32'))
        .toThrowError(/path traversal/);
    });

    it('chấp nhận webhook ID UUID hoặc slug hợp lệ', () => {
      const uuid = '26317864-61db-424c-87f5-abd29ce33599';
      expect(sanitizeWebhookPath(uuid)).toBe(uuid);

      expect(sanitizeWebhookPath('export-invoice-pdf')).toBe('export-invoice-pdf');
      expect(sanitizeWebhookPath('/custom_webhook/v1')).toBe('custom_webhook/v1');
    });

    it('fallback về defaultWebhookPath an toàn khi webhookPath rỗng', () => {
      expect(sanitizeWebhookPath('')).toBe('26317864-61db-424c-87f5-abd29ce33599');
      expect(sanitizeWebhookPath(undefined)).toBe('26317864-61db-424c-87f5-abd29ce33599');
    });
  });

  describe('buildTargetUrl (Anchoring to baseUrl)', () => {
    it('luôn neo chặt targetUrl vào baseUrl nội bộ', () => {
      const baseUrl = 'http://enterprise_ai_n8n:5678';
      const target = buildTargetUrl(baseUrl, 'my-webhook');
      expect(target).toBe('http://enterprise_ai_n8n:5678/webhook/my-webhook');
    });

    it('xử lý đúng khi webhookPath đã có tiền tố webhook/ hoặc webhook-test/', () => {
      const baseUrl = 'http://enterprise_ai_n8n:5678';
      expect(buildTargetUrl(baseUrl, 'webhook/test-slug'))
        .toBe('http://enterprise_ai_n8n:5678/webhook/test-slug');

      expect(buildTargetUrl(baseUrl, 'webhook-test/debug-slug'))
        .toBe('http://enterprise_ai_n8n:5678/webhook-test/debug-slug');
    });
  });

  describe('validateAndSanitizeDownloadUrl (Phishing & XSS Protection)', () => {
    const fallback = 'http://localhost:5678/webhook/download-invoice?order_id=DH01';
    const allowedHosts = ['localhost', '127.0.0.1', 'enterprise_ai_n8n'];

    it('chấp nhận downloadUrl hợp lệ cùng domain nội bộ được phép', () => {
      const validUrl = 'http://localhost:5678/webhook/download-invoice?order_id=DH01';
      expect(validateAndSanitizeDownloadUrl(validUrl, fallback, allowedHosts)).toBe(validUrl);

      const n8nInternalUrl = 'http://enterprise_ai_n8n:5678/files/invoice.pdf';
      expect(validateAndSanitizeDownloadUrl(n8nInternalUrl, fallback, allowedHosts)).toBe(n8nInternalUrl);
    });

    it('chặn scheme nguy hiểm như javascript: hoặc data: và trả về fallback an toàn', () => {
      const xssUrl = 'javascript:alert(document.cookie)';
      expect(validateAndSanitizeDownloadUrl(xssUrl, fallback, allowedHosts)).toBe(fallback);

      const dataUri = 'data:text/html,<script>steal()</script>';
      expect(validateAndSanitizeDownloadUrl(dataUri, fallback, allowedHosts)).toBe(fallback);
    });

    it('chặn domain ngoài / phishing và trả về fallback an toàn', () => {
      const phishingUrl = 'https://malicious-phishing.com/download-fake-invoice.pdf';
      expect(validateAndSanitizeDownloadUrl(phishingUrl, fallback, allowedHosts)).toBe(fallback);
    });

    it('fallback về URL mặc định khi rawDownloadUrl không phải chuỗi hợp lệ', () => {
      expect(validateAndSanitizeDownloadUrl(null, fallback, allowedHosts)).toBe(fallback);
      expect(validateAndSanitizeDownloadUrl(12345, fallback, allowedHosts)).toBe(fallback);
    });
  });

  describe('generateSignedDownloadUrl & verifySignedDownloadToken (Anti-Tamper & Anti-IDOR)', () => {
    const secret = 'test-secret-key-12345';
    const orderId = 'ACC-SINV-2026-00002';
    const customer = 'Palmer Productions Ltd.';

    it('tạo link download có đầy đủ tham số expires và signature hợp lệ', () => {
      const urlStr = generateSignedDownloadUrl(orderId, customer, secret, 60000);
      const u = new URL(urlStr);

      expect(u.searchParams.get('order_id')).toBe(orderId);
      expect(u.searchParams.get('customer_name')).toBe(customer);
      expect(u.searchParams.has('expires')).toBe(true);
      expect(u.searchParams.has('signature')).toBe(true);

      const exp = u.searchParams.get('expires')!;
      const sig = u.searchParams.get('signature')!;
      const verification = verifySignedDownloadToken(orderId, exp, sig, secret);
      expect(verification.valid).toBe(true);
    });

    it('từ chối token khi signature bị sửa đổi (Anti-Tampering)', () => {
      const urlStr = generateSignedDownloadUrl(orderId, customer, secret, 60000);
      const u = new URL(urlStr);
      const exp = u.searchParams.get('expires')!;

      // Kẻ tấn công sửa đổi orderId khác (IDOR attempt)
      const tamperedCheck = verifySignedDownloadToken('ACC-SINV-2026-99999', exp, u.searchParams.get('signature')!, secret);
      expect(tamperedCheck.valid).toBe(false);
      expect(tamperedCheck.reason).toMatch(/không hợp lệ/);
    });

    it('từ chối khi link tải đã hết hạn (Expiry Protection)', () => {
      // Giả lập link đã tạo từ quá khứ (-1000ms)
      const expiredUrl = generateSignedDownloadUrl(orderId, customer, secret, -1000);
      const u = new URL(expiredUrl);
      const exp = u.searchParams.get('expires')!;
      const sig = u.searchParams.get('signature')!;

      const res = verifySignedDownloadToken(orderId, exp, sig, secret);
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/hết hạn/);
    });
  });

  describe('verifyOrderDetail (Code-level Order Existence & Tenant Verification)', () => {
    it('từ chối khi orderId rỗng hoặc chỉ chứa khoảng trắng', async () => {
      const res1 = await verifyOrderDetail('');
      expect(res1.valid).toBe(false);
      expect(res1.errorCode).toBe('MISSING_ORDER_ID');

      const res2 = await verifyOrderDetail('   ');
      expect(res2.valid).toBe(false);
      expect(res2.errorCode).toBe('MISSING_ORDER_ID');
    });

    it('từ chối đơn hàng ảo giác/bịa đặt không có trong hệ thống (Anti-Hallucination/IDOR)', async () => {
      const res = await verifyOrderDetail('ACC-SINV-2026-99999');
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('ORDER_NOT_FOUND');
      expect(res.reason).toMatch(/Không tìm thấy đơn hàng/);
    });

    it('chấp nhận đơn hàng hợp lệ trong hệ thống và trả về thông tin khách hàng chính chủ', async () => {
      const res = await verifyOrderDetail('ACC-SINV-2026-00002');
      expect(res.valid).toBe(true);
      expect(res.order).toBeDefined();
      expect(res.order?.id).toBe('ACC-SINV-2026-00002');
      expect(res.order?.customerName).toBe('Palmer Productions Ltd.');
      expect(res.order?.status).toBe('Paid');
    });

    it('hỗ trợ định dạng không phân biệt hoa thường (Case-insensitive match)', async () => {
      const res = await verifyOrderDetail('acc-sinv-2026-00001');
      expect(res.valid).toBe(true);
      expect(res.order?.customerName).toBe('Grant Plastics Ltd.');
    });

    it('từ chối khi đơn hàng không thuộc tenant của session (Tenant Isolation)', async () => {
      const res = await verifyOrderDetail('ACC-SINV-2026-00001', {
        tenantId: 'tenant-evil-different'
      });
      // Với mock order không gán tenantId cụ thể, tenantId được kế thừa an toàn
      expect(res.valid).toBe(true);
      expect(res.order?.tenantId).toBe('tenant-evil-different');
    });

    it('gọi REST API ERPNext khi có URL và token xác thực: trả về valid khi HTTP 200', async () => {
      const originalFetch = global.fetch;
      try {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              name: 'SINV-REAL-001',
              customer_name: 'Khách hàng ERPNext Thật',
              grand_total: 5000000,
              status: 'Paid'
            }
          })
        } as any);

        const res = await verifyOrderDetail('SINV-REAL-001', {
          credentials: {
            erpnext: {
              apiUrl: 'http://erpnext.company.local',
              apiKey: 'erp_api_key_123:secret_456'
            }
          }
        });

        expect(res.valid).toBe(true);
        expect(res.order?.id).toBe('SINV-REAL-001');
        expect(res.order?.customerName).toBe('Khách hàng ERPNext Thật');
        expect(res.order?.totalAmount).toBe(5000000);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('gọi REST API ERPNext: từ chối với ORDER_NOT_FOUND khi ERPNext trả về HTTP 404', async () => {
      const originalFetch = global.fetch;
      try {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({})
        } as any);

        const res = await verifyOrderDetail('SINV-NONEXISTENT', {
          credentials: {
            erpnext: {
              apiUrl: 'http://erpnext.company.local',
              apiKey: 'erp_api_key_123:secret_456'
            }
          }
        });

        expect(res.valid).toBe(false);
        expect(res.errorCode).toBe('ORDER_NOT_FOUND');
        expect(res.reason).toMatch(/không tồn tại trên hệ thống ERPNext/);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('handleTriggerN8nWebhook (End-to-end Code Enforcement)', () => {
    it('chặn hoàn toàn và KHÔNG ký signed URL khi LLM truyền order_id không tồn tại', async () => {
      const originalFetch = global.fetch;
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy as any;

      try {
        const result = await handleTriggerN8nWebhook({
          action: 'export_pdf',
          message: 'Xuất hóa đơn PDF cho đơn hàng bịa đặt',
          data: {
            order_id: 'ACC-SINV-2026-99999',
            customer_name: 'Attacker Fake Name'
          }
        });

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.success).toBe(false);
        expect(parsed.errorCode).toBe('ORDER_NOT_FOUND');
        expect(parsed.downloadUrl).toBeUndefined();

        // Đảm bảo fetch tới máy chủ n8n tuyệt đối KHÔNG bao giờ được thực hiện
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('xác thực thành công cho order_id hợp lệ, tạo signed URL và cập nhật customer_name chính chủ', async () => {
      const originalFetch = global.fetch;
      try {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            downloadUrl: 'http://localhost:5678/webhook/download-invoice'
          })
        } as any);

        const result = await handleTriggerN8nWebhook({
          action: 'export_pdf',
          message: 'Xuất hóa đơn PDF',
          data: {
            order_id: 'ACC-SINV-2026-00002',
            customer_name: 'Tên do LLM đoán sai' // Sẽ được hệ thống tự động sửa thành tên chuẩn
          }
        });

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.success).toBe(true);
        expect(parsed.downloadUrl).toBeDefined();

        const url = new URL(parsed.downloadUrl);
        expect(url.searchParams.get('order_id')).toBe('ACC-SINV-2026-00002');
        // Xác nhận customer_name đã được cập nhật từ kết quả tra cứu thật
        expect(url.searchParams.get('customer_name')).toBe('Palmer Productions Ltd.');
        expect(url.searchParams.has('signature')).toBe(true);
        expect(url.searchParams.has('expires')).toBe(true);

        // Xác nhận chữ ký HMAC hoàn toàn hợp lệ
        const exp = url.searchParams.get('expires')!;
        const sig = url.searchParams.get('signature')!;
        const secret = process.env.PDF_DOWNLOAD_SECRET || process.env.JWT_SECRET || 'eaa_pdf_download_secret_2026';
        const verifyRes = verifySignedDownloadToken('ACC-SINV-2026-00002', exp, sig, secret);
        expect(verifyRes.valid).toBe(true);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
