// ============================================================================
// Kênh thông báo sự cố health-check. v1: ConsoleNotifier (luôn bật).
// EmailNotifier sẽ bổ sung khi có SMTP — chỉ cần push thêm vào mảng `notifiers`.
// ============================================================================

export interface HealthEventInfo {
  tenantId: string;
  integrationCode: string;
  eventType: string;          // incident_start | recovered | ...
  fromStatus: string | null;
  toStatus: string;
  failedStep?: string;
  errorCode?: string;
}

export interface HealthNotifier {
  readonly name: string;
  notify(info: HealthEventInfo): Promise<void>;
}

export const consoleNotifier: HealthNotifier = {
  name: 'console',
  async notify(info) {
    const label =
      info.eventType === 'incident_start'
        ? `SỰ CỐ: tích hợp [${info.integrationCode}] (tenant ${info.tenantId}) chuyển ${info.fromStatus} → ${info.toStatus}`
        : info.eventType === 'recovered'
        ? `HỒI PHỤC: tích hợp [${info.integrationCode}] (tenant ${info.tenantId}) đã hoạt động bình thường trở lại`
        : `[${info.eventType}] ${info.integrationCode}: ${info.fromStatus} → ${info.toStatus}`;
    const detail = info.failedStep ? ` — fail tại bước ${info.failedStep}${info.errorCode ? ` [${info.errorCode}]` : ''}` : '';
    console.log(`[health-check] ${label}${detail}`);
  }
};

// Đăng ký các kênh đang hoạt động — thêm EmailNotifier/SlackNotifier vào đây sau
export const notifiers: HealthNotifier[] = [consoleNotifier];

export async function dispatchHealthEvent(info: HealthEventInfo): Promise<void> {
  await Promise.allSettled(notifiers.map(n => n.notify(info)));
}
