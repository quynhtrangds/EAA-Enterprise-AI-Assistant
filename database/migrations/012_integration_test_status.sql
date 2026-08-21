-- ============================================================================
-- Migration 012: Integration Test Status Tracking
-- Adds last_tested_at, last_test_status, last_test_detail to tenant_integrations
-- ============================================================================

ALTER TABLE tenant_integrations
  ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_test_status VARCHAR(16),
  ADD COLUMN IF NOT EXISTS last_test_detail JSONB;
