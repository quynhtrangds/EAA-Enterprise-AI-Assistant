-- 008_chat_sessions_tenant_and_star.sql
--
-- Bug: apps/ai-orchestrator/src/repositories/chat-history-repository.ts tự
-- chạy CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS ngay
-- trong code (ensureChatHistoryTables()) và tự thêm 2 cột `tenant_id`,
-- `is_starred` vào chat_sessions — nhưng 2 cột này KHÔNG có trong migration
-- chính thức 004_chat_history.sql. Kết quả: nếu deploy DB chỉ dựa vào
-- database/migrations/ (nguồn migration chính thức), bảng chat_sessions sẽ
-- thiếu 2 cột mà app thực sự cần, và chỉ "chữa cháy" được nhờ đoạn code ẩn
-- chạy lúc app khởi động.
--
-- Fix: đưa 2 cột này vào migration chính thức để có DUY NHẤT một nguồn sự
-- thật cho schema. Dùng IF NOT EXISTS nên chạy an toàn kể cả khi
-- ensureChatHistoryTables() đã tự thêm từ trước.

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_tenant_id ON chat_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_is_starred ON chat_sessions(is_starred);
