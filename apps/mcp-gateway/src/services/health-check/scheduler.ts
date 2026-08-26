// ============================================================================
// Scheduler health-check: chạy IntegrationTestService theo chu kỳ cho TẤT CẢ
// tích hợp đang BẬT của mọi tenant, phát hiện chuyển trạng thái, ghi event
// và điều phối thông báo.
//
// - Chu kỳ: env HEALTH_CHECK_INTERVAL_MINUTES (mặc định 10, đặt 0 = tắt)
// - Tick đầu tiên chờ 45s sau khởi động (đợi MCP servers + DB ổn định)
// - Chống chồng tick: tick mới đến khi tick cũ chưa xong thì bỏ qua
// - Giữa các tích hợp cách quãng 2s — lịch sự với hệ thống đối tác
// ============================================================================
import { query } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { IntegrationTestService } from '../integration-test/integration-test.service.js';
import { classifyTransition, type HealthStatus } from './state-detector.js';
import { dispatchHealthEvent } from './notifiers.js';

let isRunning = false;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runHealthCheckTick(): Promise<void> {
  if (isRunning) {
    console.log('[health-check] Tick trước chưa xong — bỏ qua tick này');
    return;
  }
  isRunning = true;
  try {
    const res = await query<{
      tenant_id: string;
      integration_code: string;
      last_test_status: string | null;
    }>(
      `SELECT tenant_id, integration_code, last_test_status
       FROM tenant_integrations
       WHERE is_active = true
       ORDER BY tenant_id, integration_code`
    );

    if (res.rows.length === 0) {
      console.log('[health-check] Không có tích hợp nào đang bật — tick rỗng');
      return;
    }

    for (const row of res.rows) {
      try {
        const oldStatus = (row.last_test_status as HealthStatus | null) ?? null;
        // skipAudit: kết quả health-check được ghi vào integration_health_events,
        // không nhồi vào audit_logs (chống noise)
        const result = await IntegrationTestService.testSaved(
          row.tenant_id,
          row.integration_code,
          'health-check',
          { skipAudit: true }
        );

        const transition = classifyTransition(oldStatus, result.overallStatus);
        if (transition) {
          const failedStep = result.steps.find(s => s.status === 'failed');
          await query(
            `INSERT INTO integration_health_events
             (tenant_id, integration_code, event_type, from_status, to_status, failed_step, error_code)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              row.tenant_id,
              row.integration_code,
              transition.eventType,
              oldStatus,
              result.overallStatus,
              failedStep?.step ?? null,
              failedStep?.error?.code ?? null
            ]
          );

          if (transition.shouldNotify) {
            await dispatchHealthEvent({
              tenantId: row.tenant_id,
              integrationCode: row.integration_code,
              eventType: transition.eventType,
              fromStatus: oldStatus,
              toStatus: result.overallStatus,
              failedStep: failedStep?.step,
              errorCode: failedStep?.error?.code
            });
          }
        }
      } catch (err: any) {
        console.warn(
          `[health-check] Lỗi khi kiểm tra [${row.integration_code}] (tenant ${row.tenant_id}): ${err?.message}`
        );
      }
      await sleep(2000); // cách quãng giữa các tích hợp
    }
  } finally {
    isRunning = false;
  }
}

export function startHealthCheckScheduler(): void {
  const minutes = Number(env.HEALTH_CHECK_INTERVAL_MINUTES ?? 10);
  if (!minutes || minutes <= 0) {
    console.log('[health-check] Đã tắt (HEALTH_CHECK_INTERVAL_MINUTES=0)');
    return;
  }
  console.log(`[health-check] Bật lịch quét mỗi ${minutes} phút cho các tích hợp đang bật`);
  setTimeout(() => {
    runHealthCheckTick().catch(e => console.warn('[health-check] Tick lỗi:', e?.message));
  }, 45_000);
  setInterval(() => {
    runHealthCheckTick().catch(e => console.warn('[health-check] Tick lỗi:', e?.message));
  }, minutes * 60_000);
}
