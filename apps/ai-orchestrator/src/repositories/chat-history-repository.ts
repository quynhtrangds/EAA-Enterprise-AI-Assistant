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
}

interface ChatSessionOwnerRow {
  user_id: string;
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

export async function ensureChatHistoryTables(): Promise<void> {
  ensureChatHistoryTablesPromise ??= query(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      session_id VARCHAR(100) PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
      title VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

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

async function ensureSessionOwnedByUser(sessionId: string, userId: string, title: string): Promise<void> {
  await query(
    `
    INSERT INTO chat_sessions (session_id, user_id, title, created_at, updated_at)
    VALUES ($1, $2, $3, now(), now())
    ON CONFLICT (session_id) DO NOTHING
    `,
    [sessionId, userId, title]
  );

  const ownerResult = await query<ChatSessionOwnerRow>(
    `
    SELECT user_id
    FROM chat_sessions
    WHERE session_id = $1
    LIMIT 1
    `,
    [sessionId]
  );
  const owner = ownerResult.rows[0];

  if (!owner || owner.user_id !== userId) {
    throw new AppError('SESSION_CONFLICT', 'Session ID da ton tai cho user khac.', 409);
  }

  await query(
    `
    UPDATE chat_sessions
    SET updated_at = now(),
        title = COALESCE(title, $3)
    WHERE session_id = $1
      AND user_id = $2
    `,
    [sessionId, userId, title]
  );
}

export async function appendChatTurn(input: {
  sessionId: string;
  userId: string;
  userMessage: string;
  assistantMessage: string;
  toolCalls: ToolCallTrace[];
}): Promise<void> {
  await ensureChatHistoryTables();
  await ensureSessionOwnedByUser(input.sessionId, input.userId, deriveTitle(input.userMessage));

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

export async function listChatSessions(userId: string): Promise<StoredChatSessionSummary[]> {
  await ensureChatHistoryTables();

  const result = await query<ChatSessionRow>(
    `
    SELECT
      s.session_id,
      s.title,
      s.created_at,
      s.updated_at,
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
      ORDER BY created_at DESC, message_id DESC
      LIMIT 1
    ) last_message ON true
    WHERE s.user_id = $1
    GROUP BY s.session_id, s.title, s.created_at, s.updated_at, last_message.role, last_message.content, last_message.created_at
    ORDER BY s.updated_at DESC
    `,
    [userId]
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
    updatedAt: toIsoString(session.updated_at)
  }));
}

export async function getChatMessages(userId: string, sessionId: string): Promise<StoredChatMessage[]> {
  await ensureChatHistoryTables();

  const result = await query<ChatMessageRow>(
    `
    SELECT m.message_id, m.role, m.content, m.tool_calls, m.created_at
    FROM chat_messages m
    JOIN chat_sessions s ON s.session_id = m.session_id
    WHERE s.user_id = $1
      AND s.session_id = $2
    ORDER BY m.created_at ASC, m.message_id ASC
    `,
    [userId, sessionId]
  );

  return result.rows.map((message) => ({
    id: message.message_id,
    role: message.role,
    content: message.content,
    ...(message.tool_calls ? { toolCalls: message.tool_calls } : {}),
    createdAt: toIsoString(message.created_at)
  }));
}
