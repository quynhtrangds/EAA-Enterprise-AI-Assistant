-- ============================================================================
-- Migration 011: Account Lockout and Brute-Force Protection
-- Adds failed_login_attempts and locked_until columns to users table
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until) WHERE locked_until IS NOT NULL;
