// ============================================================================
// Kênh thông báo sự cố health-check.
// - ConsoleNotifier: luôn bật.
// - EmailNotifier (giai đoạn C): qua SMTP, chỉ kích hoạt khi cấu hình đủ
//   SMTP_HOST + HEALTH_ALERT_EMAIL. nodemailer được nạp động (dynamic import
//   qua biến) nên gateway vẫn khởi động bình thường cả khi chưa `npm install`.
// ============================================================================
import { env } from '../../config/env.js';

export interface HealthEventInfo {
  tenantId: string;
  integrationCode: string;
  eventType: string;          // incident_start | recovered | ...
  fromStatus: string | null;
  toStatus: string;
  failedStep?: string;
  errorCode?: string;
  hint?: string;
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

// ---------------------------------------------------------------------------
// EmailNotifier (SMTP)
// ---------------------------------------------------------------------------
const SMTP_CONFIGURED = Boolean(env.SMTP_HOST && env.HEALTH_ALERT_EMAIL);

function buildEmail(info: HealthEventInfo): { subject: string; text: string; html: string } {
  const isIncident = info.eventType === 'incident_start';
  const isRecovery = info.eventType === 'recovered';
  const subject = isIncident
    ? `🔴 [EAA] Sự cố tích hợp ${info.integrationCode.toUpperCase()}`
    : isRecovery
    ? `🟢 [EAA] Hồi phục: tích hợp ${info.integrationCode.toUpperCase()}`
    : `[EAA] Health-check: ${info.integrationCode} ${info.fromStatus ?? ''} → ${info.toStatus}`;

  const rows: Array<[string, string]> = [
    ['Tích hợp', info.integrationCode],
    ['Tenant', info.tenantId],
    ['Chuyển trạng thái', `${info.fromStatus ?? '(chưa quan sát)'} → ${info.toStatus}`]
  ];
  if (info.failedStep) rows.push(['Bước lỗi', info.failedStep]);
  if (info.errorCode) rows.push(['Mã lỗi', info.errorCode]);
  if (info.hint) rows.push(['Hướng dẫn', info.hint]);
  rows.push(['Thời điểm', new Date().toLocaleString('vi-VN')]);

  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
    <div style="background:${isIncident ? '#b91c1c' : isRecovery ? '#15803d' : '#374151'};color:#fff;padding:14px 20px;font-size:15px;font-weight:600">
      ${emojiFor(info.eventType)} ${subject}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#111827">
      ${rows.map(([k, v]) => `
      <tr>
        <td style="padding:8px 20px;color:#6b7280;width:150px;vertical-align:top">${k}</td>
        <td style="padding:8px 20px 8px 0;font-weight:500">${escapeHtml(v)}</td>
      </tr>`).join('')}
    </table>
    <div style="padding:10px 20px;background:#f9fafb;color:#9ca3af;font-size:11px">
      Email tự động từ Health-check của Enterprise AI Assistant.
    </div>
  </div>`;

  return { subject, text, html };
}

function emojiFor(eventType: string): string {
  return eventType === 'incident_start' ? '🔴' : eventType === 'recovered' ? '🟢' : '⚪';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const emailNotifier: HealthNotifier = {
  name: 'email',
  async notify(info) {
    if (!SMTP_CONFIGURED) return;
    try {
      // Nạp động qua biến — tránh lỗi typecheck/build khi nodemailer chưa cài;
      // nếu chưa cài mà SMTP đã cấu hình thì báo cảnh báo rõ ràng thay vì crash.
      const pkgName = 'nodemailer';
      const mod: any = await import(/* @vite-ignore */ pkgName);
      const transport = mod.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE === 'true',
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
      });

      const mail = buildEmail(info);
      await transport.sendMail({
        from: env.SMTP_FROM || 'EAA Health-check <no-reply@localhost>',
        to: env.HEALTH_ALERT_EMAIL,
        subject: mail.subject,
        text: mail.text,
        html: mail.html
      });
      console.log(`[health-check] Đã gửi email tới ${env.HEALTH_ALERT_EMAIL} (${info.eventType}: ${info.integrationCode})`);
    } catch (err: any) {
      if (err?.code === 'MODULE_NOT_FOUND') {
        console.warn('[health-check] Chưa cài nodemailer — chạy `npm install` trong apps/mcp-gateway để bật email cảnh báo.');
      } else {
        console.warn(`[health-check] Gửi email thất bại: ${err?.message}`);
      }
    }
  }
};

// Đăng ký các kênh đang hoạt động
export const notifiers: HealthNotifier[] = SMTP_CONFIGURED
  ? [consoleNotifier, emailNotifier]
  : [consoleNotifier];

export async function dispatchHealthEvent(info: HealthEventInfo): Promise<void> {
  await Promise.allSettled(notifiers.map(n => n.notify(info)));
}
