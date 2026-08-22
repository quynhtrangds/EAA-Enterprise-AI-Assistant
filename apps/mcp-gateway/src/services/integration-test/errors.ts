export interface ProbeError {
  code: string;
  message: string;
  hint: string;
}

export function mapNetworkError(stepName: string, error: unknown, latencyMs: number): {
  step: string;
  status: 'failed';
  latencyMs: number;
  error: ProbeError;
} {
  const err = error as any;
  const sysCode = err?.code || err?.cause?.code || '';
  const message = err?.message || 'Lỗi kết nối mạng';

  if (sysCode === 'ENOTFOUND') {
    return {
      step: stepName,
      status: 'failed',
      latencyMs,
      error: {
        code: 'DNS_FAILURE',
        message: `Không thể phân giải tên miền (DNS): ${err.hostname || message}`,
        hint: 'Kiểm tra lại hostname/tên miền trong URL. Đảm bảo tên miền chính xác và DNS server đang hoạt động.'
      }
    };
  }

  if (sysCode === 'ECONNREFUSED') {
    return {
      step: stepName,
      status: 'failed',
      latencyMs,
      error: {
        code: 'TCP_CONNECTION_REFUSED',
        message: 'Máy chủ đích từ chối kết nối (Connection Refused)',
        hint: 'Kiểm tra cổng (port) trong API URL và đảm bảo dịch vụ đích đang mở cổng và lắng nghe kết nối.'
      }
    };
  }

  if (sysCode === 'ETIMEDOUT' || sysCode === 'UND_ERR_CONNECT_TIMEOUT' || err?.name === 'AbortError' || message.includes('timeout')) {
    return {
      step: stepName,
      status: 'failed',
      latencyMs,
      error: {
        code: 'CONNECTION_TIMEOUT',
        message: 'Hết thời gian chờ kết nối (Connection Timeout)',
        hint: 'Máy chủ đích phản hồi quá chậm hoặc bị tường lửa (Firewall) chặn cổng. Kiểm tra lại mạng nội bộ/VPN.'
      }
    };
  }

  if (sysCode === 'CERT_HAS_EXPIRED') {
    return {
      step: stepName,
      status: 'failed',
      latencyMs,
      error: {
        code: 'TLS_CERT_EXPIRED',
        message: 'Chứng chỉ bảo mật SSL/TLS đã hết hạn',
        hint: 'Gia hạn chứng chỉ SSL/TLS trên máy chủ dịch vụ đích.'
      }
    };
  }

  if (sysCode === 'ERR_TLS_CERT_ALTNAME_INVALID' || sysCode === 'HOSTNAME_MISMATCH') {
    return {
      step: stepName,
      status: 'failed',
      latencyMs,
      error: {
        code: 'TLS_HOSTNAME_MISMATCH',
        message: 'Chứng chỉ SSL không khớp với tên miền trong API URL',
        hint: 'Kiểm tra lại domain trong chứng chỉ SSL và domain trong API URL cấu hình.'
      }
    };
  }

  if (sysCode === 'DEPTH_ZERO_SELF_SIGNED_CERT' || sysCode === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
    return {
      step: stepName,
      status: 'failed',
      latencyMs,
      error: {
        code: 'TLS_CERT_SELF_SIGNED',
        message: 'Chứng chỉ SSL tự ký (Self-Signed) hoặc không được tin cậy',
        hint: 'Sử dụng chứng chỉ SSL từ tổ chức cấp chứng chỉ CA hợp lệ hoặc cấu hình CA bundle tin cậy.'
      }
    };
  }

  return {
    step: stepName,
    status: 'failed',
    latencyMs,
    error: {
      code: 'NETWORK_ERROR',
      message: `Lỗi kết nối: ${message}`,
      hint: 'Kiểm tra lại đường truyền mạng, URL cấu hình và trạng thái máy chủ đích.'
    }
  };
}
