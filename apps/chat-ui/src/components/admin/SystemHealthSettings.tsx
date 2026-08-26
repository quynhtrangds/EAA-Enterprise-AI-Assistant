import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';

// ============================================================================
// Tab "Tình trạng Hệ thống" — giám sát health-check tự động (tách khỏi
// Kết nối Tích hợp để tách bạch hành động (sửa cấu hình/test) và quan sát).
// Dữ liệu từ GET /api/admin/integrations/health (scheduler quét mỗi 10 phút).
// ============================================================================

interface HealthEventRow {
  integration_code: string;
  event_type: string;
  from_status?: string | null;
  to_status: string;
  failed_step?: string | null;
  error_code?: string | null;
  created_at: string;
}

interface HealthOverview {
  health: { integration_code: string; last_test_status: string | null; last_tested_at: string | null }[];
  recent_events: HealthEventRow[];
}

const STATUS_LABEL: Record<string, string> = {
  passed: 'Hoạt động',
  degraded: 'Cảnh báo',
  failed: 'Sự cố'
};

function statusDotClass(status: string | null): string {
  return status === 'passed' ? 'bg-sage'
    : status === 'degraded' ? 'bg-amber-400'
    : status === 'failed' ? 'bg-clay'
    : 'bg-ink-3/50';
}

function eventText(ev: HealthEventRow): string {
  switch (ev.event_type) {
    case 'incident_start': return `sự cố (${ev.to_status})${ev.failed_step ? ` — fail tại ${ev.failed_step}` : ''}`;
    case 'recovered': return 'hồi phục';
    case 'still_failing': return 'vẫn đang sự cố';
    case 'baseline': return 'quan sát đầu tiên';
    default: return `đổi trạng thái → ${ev.to_status}`;
  }
}

export function SystemHealthSettings() {
  const { authToken } = useAuth();
  const [overview, setOverview] = useState<HealthOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchHealth = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const token = authToken || localStorage.getItem('auth_token');
      const res = await fetch('/api/admin/integrations/health', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setOverview(await res.json());
        setLastRefreshed(new Date());
      }
    } catch {
      // Lỗi mạng — giữ dữ liệu cũ hiển thị
    } finally {
      if (manual) setRefreshing(false);
      else setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchHealth();
    // Scheduler quét mỗi 10 phút; UI tự làm mới mỗi 1 phút để timestamp luôn gần đúng
    const timer = setInterval(() => fetchHealth(), 60_000);
    return () => clearInterval(timer);
  }, [fetchHealth]);

  const items = overview?.health || [];
  const events = overview?.recent_events || [];
  const countBy = (s: string) => items.filter(h => h.last_test_status === s).length;
  const stats = [
    { label: 'Hoạt động', value: countBy('passed'), dot: 'bg-sage', text: 'text-sage' },
    { label: 'Cảnh báo', value: countBy('degraded'), dot: 'bg-amber-400', text: 'text-amber-400' },
    { label: 'Sự cố', value: countBy('failed'), dot: 'bg-clay', text: 'text-clay' }
  ];

  return (
    <div>
      {/* Header + nút làm mới */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs text-ink-3">
          Health-check tự động quét toàn bộ tích hợp đang bật mỗi 10 phút
          {lastRefreshed && <> · làm mới lúc <span className="font-mono">{lastRefreshed.toLocaleTimeString('vi-VN')}</span></>}
        </p>
        <button
          type="button"
          onClick={() => fetchHealth(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-raised hover:bg-hair text-ink-2 hover:text-ink-1 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
        >
          <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? 'Đang làm mới...' : 'Làm mới'}
        </button>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brass"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="p-6 bg-surface-raised/40 border border-hair rounded-xl text-sm text-ink-3">
          Chưa có dữ liệu health-check. Hãy bật ít nhất một tích hợp và chờ chu kỳ quét kế tiếp (10 phút),
          hoặc bấm "Làm mới" sau khi scheduler chạy.
        </div>
      ) : (
        <div className="space-y-5">
          {/* Thống kê tổng */}
          <div className="grid grid-cols-3 gap-3">
            {stats.map(s => (
              <div key={s.label} className="p-4 bg-surface-raised/40 border border-hair rounded-xl flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                <div>
                  <p className={`text-xl font-bold leading-none ${s.text}`}>{s.value}</p>
                  <p className="text-[11px] text-ink-3 mt-1">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Trạng thái từng tích hợp */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-2.5">Trạng thái từng tích hợp</p>
            <div className="grid grid-cols-2 gap-2.5">
              {items.map(h => (
                <div key={h.integration_code} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-surface-raised/40 border border-hair">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotClass(h.last_test_status)}`}
                    title={h.last_tested_at ? `Kiểm tra lúc ${new Date(h.last_tested_at).toLocaleString('vi-VN')}` : 'Chưa có kết quả quét'} />
                  <span className="font-mono text-[12px] text-ink-1">{h.integration_code}</span>
                  <span className="ml-auto text-[11px] text-ink-3 whitespace-nowrap">
                    {h.last_test_status ? STATUS_LABEL[h.last_test_status] || h.last_test_status : 'Chưa quét'}
                    {h.last_tested_at && ` · ${new Date(h.last_tested_at).toLocaleTimeString('vi-VN')}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Nhật ký sự kiện */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-2.5">
              Nhật ký sự kiện {events.length > 0 && <span className="font-mono normal-case">({events.length} bản ghi gần nhất)</span>}
            </p>
            {events.length === 0 ? (
              <div className="p-4 bg-surface-raised/40 border border-hair rounded-xl text-[12px] text-ink-3">
                Chưa có sự kiện nào — mọi tích hợp ổn định từ khi bật health-check.
              </div>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                {events.slice(0, 20).map((ev, i) => (
                  <div key={i} className="text-[12px] text-ink-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-raised/30 border border-hair/60">
                    <span className={ev.event_type === 'incident_start' ? 'text-clay' : ev.event_type === 'recovered' ? 'text-sage' : 'text-ink-3'}>
                      {ev.event_type === 'incident_start' ? '🔴' : ev.event_type === 'recovered' ? '🟢' : '·'}
                    </span>
                    <span className="font-mono font-semibold">{ev.integration_code}</span>
                    <span className="text-ink-3">{eventText(ev)}</span>
                    <span className="ml-auto text-[11px] text-ink-3 whitespace-nowrap">{new Date(ev.created_at).toLocaleString('vi-VN')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
