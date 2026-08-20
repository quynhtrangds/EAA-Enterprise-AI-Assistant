import { AppError } from '../errors/app-error.js';

/**
 * Danh sách hostname / domain bị chặn tuyệt đối (Cloud Metadata endpoints & Hạ tầng)
 */
const BLOCKED_HOSTNAMES = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.internal',
  'instance-data',
  '0.0.0.0',
  'fd00:ec2::254',
  '[fd00:ec2::254]',
  'vault',
  'enterprise_ai_vault',
  'postgres',
  'enterprise_ai_postgres',
  'mcp-gateway',
  'enterprise_ai_mcp_gateway'
]);

/**
 * Danh sách cổng nội bộ nhạy cảm không được phép gọi qua integration proxy
 */
const BLOCKED_INTERNAL_PORTS = new Set(['8200', '5432', '55432', '8081', '8085']);

/**
 * Kiểm định và phòng chống SSRF (Server-Side Request Forgery) cho URL tích hợp:
 * 1. Chỉ chấp nhận giao thức http: và https:
 * 2. Chặn các địa chỉ Cloud Metadata (169.254.169.254, metadata.google.internal...)
 * 3. Chặn các dải IP link-local (169.254.0.0/16)
 * 4. Chặn trỏ trực tiếp vào các service hạ tầng nhạy cảm (Vault, Postgres, MCP Gateway self-loop)
 *
 * @param rawUrl Chuỗi URL cấu hình tích hợp
 * @returns URL hợp lệ đã được chuẩn hóa
 * @throws AppError 400 nếu URL không hợp lệ hoặc vi phạm quy tắc an toàn SSRF
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
    throw new AppError('INVALID_TOOL_INPUT', 'Định dạng URL không hợp lệ. Vui lòng nhập URL đầy đủ (ví dụ: http://... hoặc https://...).', 400);
  }

  // 1. Chỉ chấp nhận http hoặc https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError(
      'INVALID_TOOL_INPUT',
      `Giao thức '${parsed.protocol}' không được phép. Chỉ hỗ trợ giao thức 'http:' hoặc 'https:'.`,
      400
    );
  }

  const rawHost = parsed.hostname.toLowerCase();
  const cleanHost = rawHost.replace(/^[|]$/g, '');
  const port = parsed.port;

  // 2. Chặn các hostname / domain metadata & hạ tầng bị cấm
  if (BLOCKED_HOSTNAMES.has(rawHost) || BLOCKED_HOSTNAMES.has(cleanHost) || cleanHost.includes('fd00:ec2::254')) {
    throw new AppError(
      'INVALID_TOOL_INPUT',
      'URL tích hợp không được phép trỏ tới Cloud Metadata hoặc dịch vụ hạ tầng nội bộ nhạy cảm (SSRF Protection).',
      400
    );
  }

  // 3. Chặn dải IP Link-Local (169.254.0.0/16)
  if (cleanHost.startsWith('169.254.')) {
    throw new AppError(
      'INVALID_TOOL_INPUT',
      'URL tích hợp không được phép sử dụng dải địa chỉ Link-Local / Cloud Metadata (169.254.0.0/16).',
      400
    );
  }

  // 4. Chặn các cổng hạ tầng nhạy cảm (Vault, Postgres, Gateway self-loop)
  if (port && BLOCKED_INTERNAL_PORTS.has(port)) {
    throw new AppError(
      'INVALID_TOOL_INPUT',
      `Cổng ${port} là cổng dịch vụ nội bộ nhạy cảm và không được phép sử dụng cho tích hợp (SSRF Protection).`,
      400
    );
  }

  // 5. Kiểm tra thông tin xác thực nhúng trong URL (vd: http://user:pass@host)
  if (parsed.username || parsed.password) {
    throw new AppError(
      'INVALID_TOOL_INPUT',
      'Không nhúng thông tin xác thực trực tiếp vào URL. Vui lòng sử dụng ô API Key / Token riêng.',
      400
    );
  }

  return trimmed;
}
