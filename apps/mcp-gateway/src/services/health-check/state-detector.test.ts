import { describe, it, expect } from 'vitest';
import { classifyTransition, type HealthStatus } from './state-detector.js';

describe('classifyTransition — bảng chuyển trạng thái health-check', () => {
  it('trạng thái cũ NULL → baseline, không notify', () => {
    expect(classifyTransition(null, 'passed')).toEqual({ eventType: 'baseline', shouldNotify: false });
    expect(classifyTransition(null, 'failed')).toEqual({ eventType: 'baseline', shouldNotify: false });
  });

  it('passed → failed = phát sinh sự cố, CÓ notify', () => {
    expect(classifyTransition('passed', 'failed')).toEqual({ eventType: 'incident_start', shouldNotify: true });
  });

  it('degraded → failed = phát sinh sự cố, CÓ notify', () => {
    expect(classifyTransition('degraded', 'failed')).toEqual({ eventType: 'incident_start', shouldNotify: true });
  });

  it('failed → passed = hồi phục, CÓ notify', () => {
    expect(classifyTransition('failed', 'passed')).toEqual({ eventType: 'recovered', shouldNotify: true });
  });

  it('failed → failed = sự cố kéo dài, KHÔNG notify (chống spam)', () => {
    expect(classifyTransition('failed', 'failed')).toEqual({ eventType: 'still_failing', shouldNotify: false });
  });

  it('failed → degraded = vẫn trong sự cố, KHÔNG notify', () => {
    const t = classifyTransition('failed', 'degraded');
    expect(t).toEqual({ eventType: 'status_change', shouldNotify: false });
  });

  it('passed → degraded = cảnh báo nhẹ, KHÔNG notify', () => {
    expect(classifyTransition('passed', 'degraded')).toEqual({ eventType: 'status_change', shouldNotify: false });
  });

  it('degraded → passed = cải thiện nhẹ, KHÔNG notify', () => {
    expect(classifyTransition('degraded', 'passed')).toEqual({ eventType: 'status_change', shouldNotify: false });
  });

  it('giống hệt nhau và không fail → KHÔNG ghi event gì (null)', () => {
    expect(classifyTransition('passed', 'passed')).toBeNull();
    expect(classifyTransition('degraded', 'degraded')).toBeNull();
  });

  it('bao phủ đủ mọi cặp trạng thái không crash', () => {
    const statuses: (HealthStatus | null)[] = [null, 'passed', 'degraded', 'failed'];
    for (const oldS of statuses) {
      for (const newS of statuses as HealthStatus[]) {
        const t = classifyTransition(oldS, newS);
        if (t !== null) {
          expect(['baseline', 'incident_start', 'recovered', 'still_failing', 'status_change']).toContain(t.eventType);
          expect(typeof t.shouldNotify).toBe('boolean');
        }
      }
    }
  });
});
