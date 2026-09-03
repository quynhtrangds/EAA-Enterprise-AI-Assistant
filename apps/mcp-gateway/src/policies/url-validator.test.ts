import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isPrivateIPv4,
  isPrivateIPv6,
  isPrivateOrRestrictedIP,
  isRestrictedHostname,
  isAllowedPrivateHost,
  validateIntegrationUrl,
  validateIntegrationUrlAsync
} from './url-validator.js';

describe('policies/url-validator.ts: Comprehensive SSRF & CIDR Protection Suite', () => {
  describe('IPv4 CIDR Matching Unit Tests', () => {
    it('nhận diện chính xác các dải IPv4 Private, Loopback, Link-Local, CGNAT và Reserved', () => {
      // 127.0.0.0/8 (Loopback)
      expect(isPrivateIPv4('127.0.0.1')).toBe(true);
      expect(isPrivateIPv4('127.255.255.254')).toBe(true);

      // 10.0.0.0/8 (Class A)
      expect(isPrivateIPv4('10.0.0.5')).toBe(true);
      expect(isPrivateIPv4('10.254.1.1')).toBe(true);

      // 172.16.0.0/12 (Class B & Docker Default Bridge Networks)
      expect(isPrivateIPv4('172.16.0.1')).toBe(true);
      expect(isPrivateIPv4('172.17.0.1')).toBe(true);
      expect(isPrivateIPv4('172.20.0.5')).toBe(true);
      expect(isPrivateIPv4('172.31.255.255')).toBe(true);
      expect(isPrivateIPv4('172.15.255.255')).toBe(false); // Public
      expect(isPrivateIPv4('172.32.0.1')).toBe(false); // Public

      // 192.168.0.0/16 (Class C)
      expect(isPrivateIPv4('192.168.1.1')).toBe(true);
      expect(isPrivateIPv4('192.168.254.254')).toBe(true);

      // 169.254.0.0/16 (Link-Local & Cloud Metadata IMDS)
      expect(isPrivateIPv4('169.254.169.254')).toBe(true);
      expect(isPrivateIPv4('169.254.1.1')).toBe(true);

      // 0.0.0.0/8 & 100.64.0.0/10 (CGNAT) & Multicast/Reserved
      expect(isPrivateIPv4('0.0.0.0')).toBe(true);
      expect(isPrivateIPv4('100.64.0.1')).toBe(true);
      expect(isPrivateIPv4('224.0.0.1')).toBe(true);
      expect(isPrivateIPv4('240.0.0.1')).toBe(true);

      // Public IPv4 Addresses
      expect(isPrivateIPv4('8.8.8.8')).toBe(false);
      expect(isPrivateIPv4('1.1.1.1')).toBe(false);
      expect(isPrivateIPv4('142.250.190.46')).toBe(false);
    });
  });

  describe('IPv6 CIDR Matching Unit Tests', () => {
    it('nhận diện chính xác các dải IPv6 Loopback, ULA, Link-Local, Multicast và IPv4-Mapped', () => {
      // Loopback & Unspecified
      expect(isPrivateIPv6('::1')).toBe(true);
      expect(isPrivateIPv6('[::1]')).toBe(true);
      expect(isPrivateIPv6('::')).toBe(true);

      // fc00::/7 (Unique Local Address - ULA)
      expect(isPrivateIPv6('fc00::1')).toBe(true);
      expect(isPrivateIPv6('fd00:ec2::254')).toBe(true);
      expect(isPrivateIPv6('[fd00:ec2::254]')).toBe(true);

      // fe80::/10 (Link-Local)
      expect(isPrivateIPv6('fe80::1')).toBe(true);

      // Multicast
      expect(isPrivateIPv6('ff02::1')).toBe(true);

      // IPv4-mapped IPv6
      expect(isPrivateIPv6('::ffff:127.0.0.1')).toBe(true);
      expect(isPrivateIPv6('::ffff:172.20.0.5')).toBe(true);
      expect(isPrivateIPv6('::ffff:10.0.0.1')).toBe(true);
      expect(isPrivateIPv6('::ffff:8.8.8.8')).toBe(false);

      // Public IPv6 Addresses
      expect(isPrivateIPv6('2001:4860:4860::8888')).toBe(false);
      expect(isPrivateIPv6('2606:4700:4700::1111')).toBe(false);
    });
  });

  describe('Restricted Hostnames Unit Tests', () => {
    it('chặn các hostname nội bộ, metadata và docker service names', () => {
      expect(isRestrictedHostname('localhost')).toBe(true);
      expect(isRestrictedHostname('sub.localhost')).toBe(true);
      expect(isRestrictedHostname('server.local')).toBe(true);
      expect(isRestrictedHostname('service.internal')).toBe(true);
      expect(isRestrictedHostname('metadata.google.internal')).toBe(true);
      expect(isRestrictedHostname('instance-data')).toBe(true);
      expect(isRestrictedHostname('vault')).toBe(true);
      expect(isRestrictedHostname('postgres')).toBe(true);
      expect(isRestrictedHostname('mcp-gateway')).toBe(true);

      expect(isRestrictedHostname('mycompany.frappe.cloud')).toBe(false);
      expect(isRestrictedHostname('api.hubspot.com')).toBe(false);
    });
  });

  describe('validateIntegrationUrl (Synchronous Validation)', () => {
    it('cho phép URL https công khai hợp lệ', () => {
      expect(validateIntegrationUrl('https://mycompany.frappe.cloud')).toBe('https://mycompany.frappe.cloud');
      expect(validateIntegrationUrl('https://crm.hubspot.com/api/v1')).toBe('https://crm.hubspot.com/api/v1');
      expect(validateIntegrationUrl('https://support.zammad.com')).toBe('https://support.zammad.com');
    });

    it('chặn tất cả các payload bypass bằng IP Docker nội bộ (172.16.0.0/12, 10.0.0.0/8, 192.168.0.0/16)', () => {
      expect(() => validateIntegrationUrl('http://172.20.0.5:80')).toThrowError(/SSRF CIDR Protection/);
      expect(() => validateIntegrationUrl('http://172.17.0.1:9200')).toThrowError(/SSRF CIDR Protection/);
      expect(() => validateIntegrationUrl('http://10.0.0.5:6379')).toThrowError(/SSRF CIDR Protection/);
      expect(() => validateIntegrationUrl('http://192.168.1.1:80')).toThrowError(/SSRF CIDR Protection/);
    });

    it('chặn localhost / loopback ở bất kỳ port nào (kể cả port không nằm trong list cũ)', () => {
      expect(() => validateIntegrationUrl('http://localhost:9229')).toThrowError(/SSRF/);
      expect(() => validateIntegrationUrl('http://127.0.0.1:9229')).toThrowError(/SSRF/);
      expect(() => validateIntegrationUrl('http://127.0.0.1:8080')).toThrowError(/SSRF/);
      expect(() => validateIntegrationUrl('http://127.0.0.2:3000')).toThrowError(/SSRF/);
    });

    it('chặn IPv6 Loopback [::1] ở bất kỳ port nào', () => {
      expect(() => validateIntegrationUrl('http://[::1]:8081')).toThrowError(/SSRF/);
      expect(() => validateIntegrationUrl('http://[::1]:80')).toThrowError(/SSRF/);
      expect(() => validateIntegrationUrl('http://[::1]:9229')).toThrowError(/SSRF/);
    });

    it('chặn Cloud Metadata & Link-Local (IPv4 + IPv6)', () => {
      expect(() => validateIntegrationUrl('http://169.254.169.254/latest/meta-data')).toThrowError(/SSRF/);
      expect(() => validateIntegrationUrl('http://169.254.1.1/secret')).toThrowError(/SSRF/);
      expect(() => validateIntegrationUrl('http://[fd00:ec2::254]/')).toThrowError(/SSRF/);
      expect(() => validateIntegrationUrl('http://metadata.google.internal/computeMetadata/v1/')).toThrowError(/SSRF/);
      expect(() => validateIntegrationUrl('http://instance-data/latest/meta-data')).toThrowError(/SSRF/);
    });

    it('chặn các giao thức không phải http/https (file://, gopher://, ftp://, ldap://...)', () => {
      expect(() => validateIntegrationUrl('file:///etc/passwd')).toThrowError(/Giao thức/);
      expect(() => validateIntegrationUrl('gopher://127.0.0.1:6379/_flushall')).toThrowError(/Giao thức/);
      expect(() => validateIntegrationUrl('ftp://ftp.example.com')).toThrowError(/Giao thức/);
      expect(() => validateIntegrationUrl('dict://127.0.0.1:11211/stat')).toThrowError(/Giao thức/);
      expect(() => validateIntegrationUrl('javascript:alert(1)')).toThrowError(/Giao thức/);
    });

    it('chặn thông tin user:pass nhúng trong URL', () => {
      expect(() => validateIntegrationUrl('http://admin:secret123@myerp.com')).toThrowError(/Không nhúng thông tin xác thực/);
    });

    it('ném lỗi khi URL rỗng hoặc sai cú pháp', () => {
      expect(() => validateIntegrationUrl('')).toThrowError(/không được để trống/);
      expect(() => validateIntegrationUrl('not-a-valid-url')).toThrowError(/Định dạng URL không hợp lệ/);
    });
  });

  describe('validateIntegrationUrlAsync (DNS Rebinding Protection)', () => {
    it('chặn các tên miền trỏ về IP Private/Loopback (DNS Rebinding Attack)', async () => {
      // Các domain nip.io phân giải trực tiếp về IP private tương ứng
      await expect(validateIntegrationUrlAsync('http://127.0.0.1.nip.io:8080'))
        .rejects.toThrowError(/DNS Rebinding \/ SSRF Protection/);

      await expect(validateIntegrationUrlAsync('http://10.0.0.1.nip.io'))
        .rejects.toThrowError(/DNS Rebinding \/ SSRF Protection/);

      await expect(validateIntegrationUrlAsync('http://172.20.0.5.nip.io'))
        .rejects.toThrowError(/DNS Rebinding \/ SSRF Protection/);
    });
  });
  describe('isAllowedPrivateHost & SENSITIVE_INFRA_HOSTS Protection', () => {
    const originalEnv = process.env.INTEGRATION_TEST_ALLOWED_PRIVATE_HOSTS;

    afterEach(() => {
      process.env.INTEGRATION_TEST_ALLOWED_PRIVATE_HOSTS = originalEnv;
    });

    it('vo hieu hoa wildcard * (fail-closed, khong cho phep bypass toan bo he thong)', () => {
      process.env.INTEGRATION_TEST_ALLOWED_PRIVATE_HOSTS = '*';
      expect(isAllowedPrivateHost('vault')).toBe(false);
      expect(isAllowedPrivateHost('postgres')).toBe(false);
      expect(isAllowedPrivateHost('127.0.0.1')).toBe(false);
      expect(isAllowedPrivateHost('gitea')).toBe(false);
    });

    it('tuyet doi chan vault, postgres, mcp-gateway, loopback ke ca khi co tinh dua vao whitelist', () => {
      process.env.INTEGRATION_TEST_ALLOWED_PRIVATE_HOSTS = 'vault,postgres,mcp-gateway,localhost,127.0.0.1,gitea';
      expect(isAllowedPrivateHost('vault')).toBe(false);
      expect(isAllowedPrivateHost('enterprise_ai_vault')).toBe(false);
      expect(isAllowedPrivateHost('postgres')).toBe(false);
      expect(isAllowedPrivateHost('enterprise_ai_postgres')).toBe(false);
      expect(isAllowedPrivateHost('mcp-gateway')).toBe(false);
      expect(isAllowedPrivateHost('localhost')).toBe(false);
      expect(isAllowedPrivateHost('127.0.0.1')).toBe(false);
      expect(isAllowedPrivateHost('169.254.169.254')).toBe(false);

      // Nhung host an toan hop le van duoc phep
      expect(isAllowedPrivateHost('gitea')).toBe(true);
    });

    it('cho phep cac service noi bo hop le duoc khai bao tuong minh', () => {
      process.env.INTEGRATION_TEST_ALLOWED_PRIVATE_HOSTS = 'frontend,gitea,enterprise_ai_n8n';
      expect(isAllowedPrivateHost('frontend')).toBe(true);
      expect(isAllowedPrivateHost('gitea')).toBe(true);
      expect(isAllowedPrivateHost('enterprise_ai_n8n')).toBe(true);
      expect(isAllowedPrivateHost('other_service')).toBe(false);
    });
  });
});