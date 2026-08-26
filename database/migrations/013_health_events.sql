-- ============================================================================
-- Migration 013: Health-check events
-- Lịch sử sự cố/hồi phục của tích hợp — nguồn cho panel "Tình trạng hệ thống".
-- Chỉ ghi khi TRẠNG THÁI ĐỔI (incident_start/recovered/...) để chống spam.
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_health_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    integration_code VARCHAR(50) NOT NULL,
    event_type VARCHAR(20) NOT NULL,   -- baseline | incident_start | recovered | still_failing | status_change
    from_status VARCHAR(16),           -- passed | degraded | failed | NULL (lần đầu)
    to_status VARCHAR(16) NOT NULL,
    failed_step VARCHAR(30),
    error_code VARCHAR(60),
    detail JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_health_events_tenant_time
    ON integration_health_events (tenant_id, integration_code, created_at DESC);
