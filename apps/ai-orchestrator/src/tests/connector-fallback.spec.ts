import { describe, it, expect } from 'vitest';

function handleConnectorError(err: Error): string {
  if (err.message.includes('timeout') || err.message.includes('HTTP 500')) {
    return 'Dịch vụ kết nối tới hệ thống đối tác đang tạm thời gián đoạn. Vui lòng thử lại sau ít phút.';
  }
  return `Lỗi hệ thống: ${err.message}`;
}

describe('Connector Timeout & Fallback Tests (Phase 3 Upgrade)', () => {
  it('should return a user-friendly Vietnamese fallback message when connector times out', () => {
    const error = new Error('ERPNext HTTP Error 500: Gateway timeout after 10000ms');
    const response = handleConnectorError(error);
    expect(response).toContain('Dịch vụ kết nối tới hệ thống đối tác đang tạm thời gián đoạn');
    expect(response).not.toContain('HTTP 500');
  });

  it('should handle normal error gracefully', () => {
    const error = new Error('Không tìm thấy tài liệu liên quan trong kho tri thức RAG');
    const response = handleConnectorError(error);
    expect(response).toContain('Lỗi hệ thống: Không tìm thấy tài liệu');
  });
});
