// ============================================================================
// Phân loại chuyển trạng thái health-check — trái tim của cơ chế chống spam.
// Nguyên tắc: chỉ BÁO ĐỘNG khi trạng thái ĐỔI ở mức nghiêm trọng
// (pass/degraded → failed = phát sinh sự cố; failed → passed = hồi phục).
// Fail kéo dài (failed → failed) ghi event nhưng KHÔNG notify.
// ============================================================================

export type HealthStatus = 'passed' | 'degraded' | 'failed';

export type HealthEventType =
  | 'baseline'         // lần đầu quan sát (chưa có trạng thái cũ)
  | 'incident_start'   // phát sinh sự cố — CÓ notify
  | 'recovered'        // hồi phục — CÓ notify
  | 'still_failing'    // sự cố kéo dài — không notify
  | 'status_change';   // đổi trạng thái mức nhẹ (vd passed→degraded) — không notify

export interface HealthTransition {
  eventType: HealthEventType;
  shouldNotify: boolean;
}

export function classifyTransition(
  oldStatus: HealthStatus | null,
  newStatus: HealthStatus
): HealthTransition | null {
  // Lần đầu quan sát — ghi baseline để các tick sau có mốc so sánh
  if (!oldStatus) {
    return { eventType: 'baseline', shouldNotify: false };
  }

  // Không đổi
  if (oldStatus === newStatus) {
    if (newStatus === 'failed') {
      return { eventType: 'still_failing', shouldNotify: false };
    }
    return null; // passed→passed, degraded→degraded: không có gì để ghi
  }

  // Xấu đi ở mức nghiêm trọng → phát sinh sự cố
  const becameFailed = newStatus === 'failed';
  if (becameFailed) {
    return { eventType: 'incident_start', shouldNotify: true };
  }

  // Hồi phục hoàn toàn
  if (oldStatus === 'failed' && newStatus === 'passed') {
    return { eventType: 'recovered', shouldNotify: true };
  }

  // Các chuyển đổi mức nhẹ còn lại (passed→degraded, degraded→passed, failed→degraded)
  return { eventType: 'status_change', shouldNotify: false };
}
