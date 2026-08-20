import { describe, it, expect } from 'vitest';
import { validateIntegrationUrl } from './url-validator.js';

describe('policies/url-validator.ts: SSRF Protection Unit Tests', () => {
  it('cho phép URL https công khai hợp lệ', () => {
    expect(validateIntegrationUrl('https://mycompany.frappe.cloud')).toBe('https://mycompany.frappe.cloud');
    expect(validateIntegrationUrl('https://crm.hubspot.com/api/v1')).toBe('https://crm.hubspot.com/api/v1');
    expect(validateIntegrationUrl('https://support.zammad.com')).toBe('https://support.zammad.com');
  });

  it('cho phép URL service Docker và cổng thông thường', () => {
    expect(validateIntegrationUrl('http://frontend:8080')).toBe('http://frontend:8080');
    expect(validateIntegrationUrl('http://zammad-app-zammad-nginx-1:8080')).toBe('http://zammad-app-zammad-nginx-1:8080');
    expect(validateIntegrationUrl('http://localhost:3000')).toBe('http://localhost:3000');
    expect(validateIntegrationUrl('http://localhost:3001')).toBe('http://localhost:3001');
    expect(validateIntegrationUrl('http://localhost:8090')).toBe('http://localhost:8090');
    expect(validateIntegrationUrl('http://127.0.0.1:8090')).toBe('http://127.0.0.1:8090');
  });

  it('chặn các giao thức không phải http/https (file://, gopher://, ftp://, ldap://...)', () => {
    expect(() => validateIntegrationUrl('file:///etc/passwd')).toThrowError(/Giao thức/);
    expect(() => validateIntegrationUrl('gopher://127.0.0.1:6379/_flushall')).toThrowError(/Giao thức/);
    expect(() => validateIntegrationUrl('ftp://ftp.example.com')).toThrowError(/Giao thức/);
    expect(() => validateIntegrationUrl('dict://127.0.0.1:11211/stat')).toThrowError(/Giao thức/);
    expect(() => validateIntegrationUrl('javascript:alert(1)')).toThrowError(/Giao thức/);
  });

  it('chặn Cloud Metadata IP 169.254.169.254 (AWS / GCP / Azure IMDS)', () => {
    expect(() => validateIntegrationUrl('http://169.254.169.254/latest/meta-data')).toThrowError(/SSRF/);
    expect(() => validateIntegrationUrl('http://169.254.169.254/computeMetadata/v1/')).toThrowError(/SSRF/);
  });

  it('chặn toàn bộ dải IP Link-Local (169.254.0.0/16)', () => {
    expect(() => validateIntegrationUrl('http://169.254.1.1/secret')).toThrowError(/Link-Local/);
    expect(() => validateIntegrationUrl('http://169.254.100.50:8080')).toThrowError(/Link-Local/);
  });

  it('chặn các hostname metadata đặc thù của Cloud (Google, AWS, Azure)', () => {
    expect(() => validateIntegrationUrl('http://metadata.google.internal/computeMetadata/v1/')).toThrowError(/SSRF/);
    expect(() => validateIntegrationUrl('http://metadata.internal/')).toThrowError(/SSRF/);
    expect(() => validateIntegrationUrl('http://instance-data/latest/meta-data')).toThrowError(/SSRF/);
    expect(() => validateIntegrationUrl('http://0.0.0.0:8080')).toThrowError(/SSRF/);
    expect(() => validateIntegrationUrl('http://[fd00:ec2::254]/')).toThrowError(/SSRF/);
  });

  it('chặn trỏ trực tiếp vào các service hạ tầng nhạy cảm (Vault, Postgres, Gateway)', () => {
    expect(() => validateIntegrationUrl('http://vault:8200')).toThrowError(/SSRF/);
    expect(() => validateIntegrationUrl('http://enterprise_ai_vault:8200')).toThrowError(/SSRF/);
    expect(() => validateIntegrationUrl('http://postgres:5432')).toThrowError(/SSRF/);
    expect(() => validateIntegrationUrl('http://mcp-gateway:8081')).toThrowError(/SSRF/);
    expect(() => validateIntegrationUrl('http://localhost:8200')).toThrowError(/nhạy cảm/);
    expect(() => validateIntegrationUrl('http://localhost:5432')).toThrowError(/nhạy cảm/);
    expect(() => validateIntegrationUrl('http://localhost:8085')).toThrowError(/nhạy cảm/);
  });

  it('chặn thông tin user:pass nhúng trong URL', () => {
    expect(() => validateIntegrationUrl('http://admin:secret123@myerp.com')).toThrowError(/Không nhúng thông tin xác thực/);
  });

  it('ném lỗi khi URL rỗng hoặc sai cú pháp', () => {
    expect(() => validateIntegrationUrl('')).toThrowError(/không được để trống/);
    expect(() => validateIntegrationUrl('not-a-valid-url')).toThrowError(/Định dạng URL không hợp lệ/);
  });
});
