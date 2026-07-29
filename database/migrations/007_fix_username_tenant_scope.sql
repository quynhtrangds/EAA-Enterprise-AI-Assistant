-- 007_fix_username_tenant_scope.sql
--
-- Bug: `username` từng có UNIQUE constraint toàn hệ thống (không theo tenant).
-- Kết hợp với câu lệnh `INSERT ... ON CONFLICT (username) DO UPDATE ...` trong
-- apps/mcp-gateway/src/routes/admin.ts (route POST /users), nếu 2 tenant khác
-- nhau tạo user trùng username, dữ liệu (role/email/display_name) của user
-- thuộc tenant kia sẽ bị ghi đè âm thầm mà không có cảnh báo.
--
-- Fix: username chỉ cần unique TRONG PHẠM VI 1 tenant.

ALTER TABLE users DROP CONSTRAINT IF EXISTS uq_users_username;

ALTER TABLE users
  ADD CONSTRAINT uq_users_tenant_username UNIQUE (tenant_id, username);
