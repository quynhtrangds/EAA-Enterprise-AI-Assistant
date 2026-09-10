import { describe, it, expect } from 'vitest';
import {
  sanitizeWebhookPath,
  buildTargetUrl,
  validateAndSanitizeDownloadUrl
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
});
