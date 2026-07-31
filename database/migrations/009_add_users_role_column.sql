-- Migration 009: Bổ sung cột role cho bảng users và backfill role từ user_roles
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'staff';

-- Cập nhật vai trò từ bảng user_roles liên kết với roles nếu có sẵn
UPDATE users u
SET role = r.role_code
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE u.id = ur.user_id;

-- Cập nhật vai trò cho các tài khoản mặc định nếu chưa được cập nhật
UPDATE users SET role = 'admin' WHERE username = 'admin' AND role = 'staff';
UPDATE users SET role = 'manager' WHERE username = 'manager' AND role = 'staff';
UPDATE users SET role = 'staff' WHERE username = 'staff';
UPDATE users SET role = 'viewer' WHERE username = 'viewer';
