import net from 'net';
import dns from 'dns';
import { AppError } from '../errors/app-error.js';

/**
 * Kiểm tra xem một địa chỉ IPv4 có thuộc các dải mạng Private, Loopback, Link-Local hoặc Reserved hay không
 */
export function isPrivateIPv4(ip: string): boolean {
  const rawParts = ip.split('.');
  if (rawParts.length !== 4) {
    return false;
  }

  const p0 = Number(rawParts[0]);
  const p1 = Number(rawParts[1]);
  const p2 = Number(rawParts[2]);
  const p3 = Number(rawParts[3]);

  if (
    isNaN(p0) || isNaN(p1) || isNaN(p2) || isNaN(p3) ||
    p0 < 0 || p0 > 255 || p1 < 0 || p1 > 255 || p2 < 0 || p2 > 255 || p3 < 0 || p3 > 255
  ) {
    return false;
  }

  // 0.0.0.0/8 (Current network / default route)
  if (p0 === 0) return true;

  // 10.0.0.0/8 (Private network Class A)
  if (p0 === 10) return true;

  // 100.64.0.0/10 (Carrier-Grade NAT)
  if (p0 === 100 && p1 >= 64 && p1 <= 127) return true;

  // 127.0.0.0/8 (Loopback)
  if (p0 === 127) return true;

  // 169.254.0.0/16 (Link-Local / Cloud Metadata IMDS)
  if (p0 === 169 && p1 === 254) return true;

  // 172.16.0.0/12 (Private network Class B / Docker default bridges 172.17.x, 172.18.x, 172.20.x...)
  if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (p0 === 192 && p1 === 0 && p2 === 0) return true;

  // 192.0.2.0/24 (TEST-NET-1)
  if (p0 === 192 && p1 === 0 && p2 === 2) return true;

  // 192.168.0.0/16 (Private network Class C)
  if (p0 === 192 && p1 === 168) return true;

  // 198.18.0.0/15 (Network Benchmark Testing)
  if (p0 === 198 && (p1 === 18 || p1 === 19)) return true;

  // 198.51.100.0/24 (TEST-NET-2)
  if (p0 === 198 && p1 === 51 && p2 === 100) return true;

  // 203.0.113.0/24 (TEST-NET-3)
  if (p0 === 203 && p1 === 0 && p2 === 113) return true;

  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved / Broadcast)
  if (p0 >= 224) return true;

  return false;
}

/**
 * Kiểm tra xem một địa chỉ IPv6 có thuộc các dải mạng Private, Loopback, Link-Local, ULA hoặc Mapped hay không
 */
export function isPrivateIPv6(ip: string): boolean {
  const clean = ip.toLowerCase().replace(/[[\]]/g, '');

  // ::1 (Loopback)
  if (clean === '::1' || clean === '0:0:0:0:0:0:0:1') return true;

  // :: (Unspecified)
  if (clean === '::' || clean === '0:0:0:0:0:0:0:0') return true;

  // fc00::/7 (Unique Local Address - ULA: fc00:: to fdff::, bao gồm cả fd00:ec2::254)
  if (clean.startsWith('fc') || clean.startsWith('fd')) return true;

  // fe80::/10 (Link-Local Unicast: fe80:: to febf::)
  if (clean.startsWith('fe8') || clean.startsWith('fe9') || clean.startsWith('fea') || clean.startsWith('feb')) return true;

  // ff00::/8 (Multicast)
  if (clean.startsWith('ff')) return true;

  // IPv4-mapped IPv6 (::ffff:127.0.0.1 hoặc ::ffff:10.0.0.1...)
  const mappedMatch = clean.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedMatch && mappedMatch[1]) {
    return isPrivateIPv4(mappedMatch[1]);
  }

  return false;
}

/**
 * Kiểm tra tổng quát một IP bất kỳ (IPv4 hoặc IPv6)
 */
export function isPrivateOrRestrictedIP(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return false;
}

/**
 * Kiểm tra hostname có thuộc danh sách bị hạn chế hoặc định danh nội bộ hay không
 */
/**
 * Kiểm tra xem hostname/IP có nằm trong danh sách whitelist cho phép nội bộ hay không
 * Đọc từ biến môi trường INTEGRATION_TEST_ALLOWED_PRIVATE_HOSTS (phân cách bằng dấu phẩy)
 */
export function isAllowedPrivateHost(rawHost: string): boolean {
  const host = rawHost.toLowerCase().replace(/[\[\]]/g, '');

  // 1. Tuyệt đối KHÔNG BAO GIỜ cho phép Cloud Metadata (169.254.169.254, metadata.google.internal, instance-data)
  if (
    host === '169.254.169.254' ||
    host.startsWith('169.254.') ||
    host === 'metadata.google.internal' ||
    host === 'instance-data'
  ) {
    return false;
  }

  const envAllowed = process.env.INTEGRATION_TEST_ALLOWED_PRIVATE_HOSTS;
  if (!envAllowed) return false;
  const list = envAllowed.split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
  return list.includes('*') || list.includes(host);
}

export function isRestrictedHostname(rawHost: string): boolean {
  const host = rawHost.toLowerCase().replace(/[[\]]/g, '');

  // 1. Tên miền loopback, local, internal
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.lan') ||
    host === 'metadata.google.internal' ||
    host === 'instance-data'
  ) {
    return true;
  }

  // 2. Tên service nội bộ trong mạng Docker / Kubernetes không có dấu chấm (e.g. vault, postgres, gitea, mcp-gateway)
  if (!host.includes('.')) {
    return true;
  }

  return false;
}

/**
 * Kiểm định đồng bộ (Synchronous) URL cấu hình tích hợp:
 * - Kiểm tra format URL
 * - Kiểm tra giao thức (chỉ http:/https:)
 * - Kiểm tra thông tin nhúng (user:pass)
 * - Kiểm tra CIDR đối với địa chỉ IP
 * - Kiểm tra tên miền nội bộ
 */
export function validateIntegrationUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new AppError('INVALID_TOOL_INPUT', 'URL tích hợp không được để trống.', 400);
  }

  const trimmed = rawUrl.trim();
  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppError('INVALID_TOOL_INPUT', 'Định dạng URL không hợp lệ. Vui lòng nhập URL đầy đủ (ví dụ: https://...).', 400);
  }

  // 1. Chỉ chấp nhận giao thức http hoặc https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError(
      'INVALID_TOOL_INPUT',
      `Giao thức '${parsed.protocol}' không được phép. Chỉ hỗ trợ giao thức 'http:' hoặc 'https:'.`,
      400
    );
  }

  // 2. Chặn thông tin xác thực nhúng trong URL
  if (parsed.username || parsed.password) {
    throw new AppError(
      'INVALID_TOOL_INPUT',
      'Không nhúng thông tin xác thực trực tiếp vào URL. Vui lòng sử dụng ô API Key / Token riêng.',
      400
    );
  }

  const host = parsed.hostname;

  // 3. Nếu hostname là địa chỉ IP trực tiếp -> Kiểm tra toàn bộ dải CIDR Private
  if (net.isIP(host)) {
    if (!isAllowedPrivateHost(host) && isPrivateOrRestrictedIP(host)) {
      throw new AppError(
        'INVALID_TOOL_INPUT',
        `Địa chỉ IP '${host}' thuộc dải mạng nội bộ/riêng tư bị hạn chế (SSRF CIDR Protection).`,
        400
      );
    }
  }

  // 4. Nếu hostname là tên miền/service nội bộ
  if (!isAllowedPrivateHost(host) && isRestrictedHostname(host)) {
    throw new AppError(
      'INVALID_TOOL_INPUT',
      `Hostname '${host}' trỏ tới dịch vụ nội bộ hoặc Cloud Metadata bị hạn chế (SSRF Protection).`,
      400
    );
  }

  return trimmed;
}

/**
 * Kiểm định bất đồng bộ (Asynchronous) toàn diện chống SSRF & DNS Rebinding:
 * - Thực hiện toàn bộ các bước kiểm định của validateIntegrationUrl
 * - Phân giải DNS thực tế của domain qua dns.promises.lookup
 * - Quét tất cả IP kết quả (IPv4 & IPv6): nếu có bất kỳ IP nào thuộc dải private CIDR -> chặn ngay lập tức.
 */
export async function validateIntegrationUrlAsync(rawUrl: string): Promise<string> {
  const validated = validateIntegrationUrl(rawUrl);
  const parsed = new URL(validated);
  const host = parsed.hostname;

  // Nếu là IP thuần đã qua bước validateIntegrationUrl thì không cần resolve DNS lại
  if (net.isIP(host)) {
    return validated;
  }

  // Phân giải DNS để chống DNS Rebinding
  try {
    const addresses = await dns.promises.lookup(host, { all: true });
    for (const addr of addresses) {
      if (!isAllowedPrivateHost(addr.address) && isPrivateOrRestrictedIP(addr.address)) {
        throw new AppError(
          'INVALID_TOOL_INPUT',
          `Tên miền '${host}' đã phân giải về địa chỉ IP nội bộ '${addr.address}' bị hạn chế (DNS Rebinding / SSRF Protection).`,
          400
        );
      }
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    // Cho phép các domain tài liệu tiêu chuẩn RFC 2606 trong môi trường test
    if (
      process.env.NODE_ENV === 'test' &&
      (host.endsWith('.example.com') || host.endsWith('.example') || host.endsWith('.test') || host.endsWith('.invalid'))
    ) {
      return validated;
    }
    throw new AppError(
      'INVALID_TOOL_INPUT',
      `Không thể phân giải tên miền '${host}' (DNS Lookup Failed / Không tồn tại).`,
      400
    );
  }

  return validated;
}
