import { AppError } from '../errors/app-error.js';
import { query } from '../db/pool.js';
import type { ToolCallTrace } from '../types/chat.js';

let ensureChatHistoryTablesPromise: Promise<void> | null = null;

export interface StoredChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallTrace[];
  createdAt: string;
}

export interface StoredChatSessionSummary {
  sessionId: string;
  title: string | null;
  lastMessage: {
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
  } | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  isStarred: boolean;
}

export interface SearchResultSummary extends StoredChatSessionSummary {
  matchedMessage?: string;
}

interface ChatSessionOwnerRow {
  user_id: string;
  tenant_id: string;
}

interface ChatSessionRow {
  session_id: string;
  title: string | null;
  last_role: 'user' | 'assistant' | null;
  last_content: string | null;
  last_created_at: Date | string | null;
  message_count: string;
  created_at: Date | string;
  updated_at: Date | string;
  is_starred: boolean;
}

interface ChatMessageRow {
  message_id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls: ToolCallTrace[] | null;
  created_at: Date | string;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function deriveTitle(message: string): string {
  const compact = message.replace(/\s+/g, ' ').trim();
  return compact.length > 80 ? `${compact.slice(0, 77)}...` : compact;
}

// LƯU Ý: đây là safety-net idempotent (phòng trường hợp app chạy dev/test mà
// chưa apply migrations qua docker-entrypoint-initdb.d). Nguồn schema CHÍNH
// THỨC vẫn là database/migrations/004_chat_history.sql (bảng gốc) và
// 008_chat_sessions_tenant_and_star.sql (tenant_id, is_starred). Nếu sửa
// schema ở đây, PHẢI đồng bộ thêm 1 migration file tương ứng — tránh tình
// trạng 2 nguồn schema lệch nhau đã từng xảy ra.
export async function ensureChatHistoryTables(): Promise<void> {
  ensureChatHistoryTablesPromise ??= query(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      session_id VARCHAR(100) PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
      tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
      title VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;

    CREATE TABLE IF NOT EXISTS chat_messages (
      message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id VARCHAR(100) NOT NULL REFERENCES chat_sessions(session_id) ON UPDATE CASCADE ON DELETE CASCADE,
      role VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      tool_calls JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT chk_chat_messages_role CHECK (role IN ('user', 'assistant'))
    );

    CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
  `).then(() => undefined);

  return ensureChatHistoryTablesPromise;
}

async function ensureSessionOwnedByUser(sessionId: string, userId: string, title: string, tenantId: string): Promise<void> {
  await query(
    `
    INSERT INTO chat_sessions (session_id, user_id, title, tenant_id, created_at, updated_at)
    VALUES ($1, $2, $3, $4, now(), now())
    ON CONFLICT (session_id) DO NOTHING
    `,
    [sessionId, userId, title, tenantId]
  );

  const ownerResult = await query<ChatSessionOwnerRow>(
    `
    SELECT user_id, tenant_id
    FROM chat_sessions
    WHERE session_id = $1
    LIMIT 1
    `,
    [sessionId]
  );
  const owner = ownerResult.rows[0];

  if (!owner || owner.user_id !== userId || (owner.tenant_id && tenantId && owner.tenant_id !== tenantId)) {
    throw new AppError('SESSION_CONFLICT', 'Session ID da ton tai cho user khac.', 409);
  }

  await query(
    `
    UPDATE chat_sessions
    SET updated_at = now(),
        title = COALESCE(title, $4)
    WHERE session_id = $1
      AND user_id = $2
      AND tenant_id = $3
    `,
    [sessionId, userId, tenantId, title]
  );
}

export async function appendChatTurn(input: {
  sessionId: string;
  userId: string;
  tenantId: string;
  userMessage: string;
  assistantMessage: string;
  toolCalls: ToolCallTrace[];
}): Promise<void> {
  await ensureChatHistoryTables();
  await ensureSessionOwnedByUser(input.sessionId, input.userId, deriveTitle(input.userMessage), input.tenantId);

  await query(
    `
    INSERT INTO chat_messages (session_id, role, content, tool_calls, created_at)
    VALUES
      ($1, 'user', $2, NULL, now()),
      ($1, 'assistant', $3, $4::jsonb, now())
    `,
    [input.sessionId, input.userMessage, input.assistantMessage, JSON.stringify(input.toolCalls)]
  );
}

export async function editChatTurn(input: {
  sessionId: string;
  userId: string;
  tenantId: string;
  messageId: string;
  userMessage: string;
  assistantMessage: string;
  toolCalls: ToolCallTrace[];
}): Promise<void> {
  await ensureChatHistoryTables();

  // Verify session belongs to current user (and tenant)
  const sessionCheck = await query(
    `SELECT id FROM chat_sessions WHERE session_id = $1 AND user_id = $2 AND tenant_id = $3`,
    [input.sessionId, input.userId, input.tenantId]
  );
  if (sessionCheck.rows.length === 0) {
    throw new AppError('FORBIDDEN', 'Bạn không có quyền sửa phiên trò chuyện này.', 403);
  }

  const result = await query(
    `SELECT created_at FROM chat_messages WHERE message_id = $1 AND session_id = $2`,
    [input.messageId, input.sessionId]
  );
  
  if (result.rows.length === 0) {
    throw new AppError('NOT_FOUND', 'Message not found', 404);
  }

  const createdAt = result.rows[0].created_at;

  await query(
    `DELETE FROM chat_messages WHERE session_id = $1 AND created_at >= $2`,
    [input.sessionId, createdAt]
  );

  await appendChatTurn({
    sessionId: input.sessionId,
    userId: input.userId,
    tenantId: input.tenantId,
    userMessage: input.userMessage,
    assistantMessage: input.assistantMessage,
    toolCalls: input.toolCalls
  });
}

export async function renameSession(sessionId: string, userId: string, tenantId: string, title: string): Promise<void> {
  await ensureChatHistoryTables();
  const result = await query(
    `UPDATE chat_sessions SET title = $4, updated_at = now() WHERE session_id = $1 AND user_id = $2 AND tenant_id = $3`,
    [sessionId, userId, tenantId, title]
  );
  if (result.rowCount === 0) throw new AppError('NOT_FOUND', 'Session not found', 404);
}

export async function toggleStarSession(sessionId: string, userId: string, tenantId: string, isStarred: boolean): Promise<void> {
  await ensureChatHistoryTables();
  const result = await query(
    `UPDATE chat_sessions SET is_starred = $4, updated_at = now() WHERE session_id = $1 AND user_id = $2 AND tenant_id = $3`,
    [sessionId, userId, tenantId, isStarred]
  );
  if (result.rowCount === 0) throw new AppError('NOT_FOUND', 'Session not found', 404);
}

export async function deleteSession(sessionId: string, userId: string, tenantId: string): Promise<void> {
  await ensureChatHistoryTables();
  const result = await query(
    `DELETE FROM chat_sessions WHERE session_id = $1 AND user_id = $2 AND tenant_id = $3`,
    [sessionId, userId, tenantId]
  );
  if (result.rowCount === 0) throw new AppError('NOT_FOUND', 'Session not found', 404);
}

export async function listChatSessions(userId: string, tenantId: string): Promise<StoredChatSessionSummary[]> {
  await ensureChatHistoryTables();

  const result = await query<ChatSessionRow>(
    `
    SELECT
      s.session_id,
      s.title,
      s.created_at,
      s.updated_at,
      s.is_starred,
      COUNT(m.message_id)::text AS message_count,
      last_message.role AS last_role,
      last_message.content AS last_content,
      last_message.created_at AS last_created_at
    FROM chat_sessions s
    LEFT JOIN chat_messages m ON m.session_id = s.session_id
    LEFT JOIN LATERAL (
      SELECT role, content, created_at
      FROM chat_messages
      WHERE session_id = s.session_id
      ORDER BY created_at DESC, CASE WHEN role = 'assistant' THEN 1 ELSE 2 END ASC, message_id DESC
      LIMIT 1
    ) last_message ON true
    WHERE s.user_id = $1
      AND s.tenant_id = $2
    GROUP BY s.session_id, s.title, s.created_at, s.updated_at, s.is_starred, last_message.role, last_message.content, last_message.created_at
    ORDER BY s.is_starred DESC, s.updated_at DESC
    `,
    [userId, tenantId]
  );

  return result.rows.map((session) => ({
    sessionId: session.session_id,
    title: session.title,
    lastMessage:
      session.last_role && session.last_content && session.last_created_at
        ? {
            role: session.last_role,
            content: session.last_content,
            createdAt: toIsoString(session.last_created_at)
          }
        : null,
    messageCount: Number(session.message_count),
    createdAt: toIsoString(session.created_at),
    updatedAt: toIsoString(session.updated_at),
    isStarred: Boolean(session.is_starred)
  }));
}

export async function getChatMessages(userId: string, tenantId: string, sessionId: string): Promise<StoredChatMessage[]> {
  await ensureChatHistoryTables();

  const result = await query<ChatMessageRow>(
    `
    SELECT m.message_id, m.role, m.content, m.tool_calls, m.created_at
    FROM chat_messages m
    JOIN chat_sessions s ON s.session_id = m.session_id
    WHERE s.user_id = $1
      AND s.tenant_id = $2
      AND s.session_id = $3
    ORDER BY m.created_at ASC, 
             CASE WHEN m.role = 'user' THEN 1 ELSE 2 END ASC, 
             m.message_id ASC
    `,
    [userId, tenantId, sessionId]
  );

  return result.rows.map((message) => ({
    id: message.message_id,
    role: message.role,
    content: message.content,
    ...(message.tool_calls ? { toolCalls: message.tool_calls } : {}),
    createdAt: toIsoString(message.created_at)
  }));
}

export async function searchChatSessions(userId: string, tenantId: string, searchTerm: string): Promise<SearchResultSummary[]> {
  await ensureChatHistoryTables();

  const searchPattern = `%${searchTerm}%`;

  const result = await query<ChatSessionRow & { matched_content: string | null }>(
    `
    WITH matched_sessions AS (
      SELECT DISTINCT s.session_id
      FROM chat_sessions s
      LEFT JOIN chat_messages m ON m.session_id = s.session_id
      WHERE s.user_id = $1
        AND s.tenant_id = $2
        AND (s.title ILIKE $3 OR m.content ILIKE $3)
    )
    SELECT
      s.session_id,
      s.title,
      s.created_at,
      s.updated_at,
      s.is_starred,
      COUNT(m.message_id)::text AS message_count,
      last_message.role AS last_role,
      last_message.content AS last_content,
      last_message.created_at AS last_created_at,
      match_message.content AS matched_content
    FROM chat_sessions s
    JOIN matched_sessions ms ON ms.session_id = s.session_id
    LEFT JOIN chat_messages m ON m.session_id = s.session_id
    LEFT JOIN LATERAL (
      SELECT role, content, created_at
      FROM chat_messages
      WHERE session_id = s.session_id
      ORDER BY created_at DESC, CASE WHEN role = 'assistant' THEN 1 ELSE 2 END ASC, message_id DESC
      LIMIT 1
    ) last_message ON true
    LEFT JOIN LATERAL (
      SELECT content
      FROM chat_messages
      WHERE session_id = s.session_id AND content ILIKE $3
      ORDER BY created_at DESC
      LIMIT 1
    ) match_message ON true
    WHERE s.user_id = $1
      AND s.tenant_id = $2
    GROUP BY s.session_id, s.title, s.created_at, s.updated_at, s.is_starred, last_message.role, last_message.content, last_message.created_at, match_message.content
    ORDER BY s.updated_at DESC
    LIMIT 20
    `,
    [userId, tenantId, searchPattern]
  );

  return result.rows.map((session) => ({
    sessionId: session.session_id,
    title: session.title,
    lastMessage:
      session.last_role && session.last_content && session.last_created_at
        ? {
            role: session.last_role,
            content: session.last_content,
            createdAt: toIsoString(session.last_created_at)
          }
        : null,
    messageCount: Number(session.message_count),
    createdAt: toIsoString(session.created_at),
    updatedAt: toIsoString(session.updated_at),
    isStarred: Boolean(session.is_starred),
    matchedMessage: session.matched_content || undefined
  }));
}
