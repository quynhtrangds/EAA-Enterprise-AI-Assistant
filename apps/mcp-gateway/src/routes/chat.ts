import { Router } from 'express';
import { z } from 'zod';
import { getCurrentUser } from '../auth/current-user.js';
import { query } from '../db/pool.js';
import { AppError } from '../errors/app-error.js';

export const chatRouter = Router();

const saveMessagesSchema = z.object({
  sessionCode: z.string().trim().min(1),
  title: z.string().optional(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().trim().min(1),
      toolCallIds: z.array(z.string().uuid()).default([])
    })
  )
});

// GET /api/chat/sessions -> Get current user's sessions
chatRouter.get('/chat/sessions', async (req, res, next) => {
  try {
    const user = await getCurrentUser(req);
    
    const result = await query(
      `
      SELECT id, session_code, title, created_at, updated_at
      FROM chat_sessions
      WHERE user_id = $1
      ORDER BY updated_at DESC
      `,
      [user.id]
    );

    res.json({ sessions: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/chat/sessions/:sessionCode -> Get a specific session with messages and joined tool call traces
chatRouter.get('/chat/sessions/:sessionCode', async (req, res, next) => {
  try {
    const user = await getCurrentUser(req);
    const { sessionCode } = req.params;

    // Find the session
    const sessionResult = await query(
      `
      SELECT id, session_code, title, created_at, updated_at
      FROM chat_sessions
      WHERE session_code = $1 AND user_id = $2
      LIMIT 1
      `,
      [sessionCode, user.id]
    );

    const session = sessionResult.rows[0];
    if (!session) {
      return res.json({ sessionId: sessionCode, messages: [] });
    }

    // Get messages
    const messagesResult = await query(
      `
      SELECT id, role, content, tool_call_ids, created_at
      FROM chat_messages
      WHERE session_id = $1
      ORDER BY created_at ASC
      `,
      [session.id]
    );

    // Get audit logs for trace matching
    const auditLogsResult = await query(
      `
      SELECT id, tool_name, input_json, output_json, status, error_message, duration_ms, created_at
      FROM audit_logs
      WHERE session_id = $1
      `,
      [sessionCode]
    );

    const auditLogs = auditLogsResult.rows;

    const messages = messagesResult.rows.map(msg => {
      const toolCallIds = Array.isArray(msg.tool_call_ids) ? msg.tool_call_ids : [];
      const toolCalls = toolCallIds.map(tId => {
        const log = auditLogs.find(l => l.id === tId);
        if (!log) return null;
        
        return {
          toolName: log.tool_name,
          arguments: log.input_json,
          success: log.status === 'success',
          durationMs: log.duration_ms,
          data: log.status === 'success' ? log.output_json : undefined,
          errorCode: log.status === 'failed' ? 'GATEWAY_ERROR' : undefined,
          message: log.status === 'failed' ? log.error_message : undefined
        };
      }).filter(Boolean);

      return {
        id: msg.id,
        sender: msg.role === 'assistant' ? 'ai' : 'user',
        content: msg.content,
        timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined
      };
    });

    res.json({
      sessionId: sessionCode,
      title: session.title,
      messages
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/chat/messages -> Save messages and update session
chatRouter.post('/chat/messages', async (req, res, next) => {
  try {
    const user = await getCurrentUser(req);
    const body = saveMessagesSchema.parse(req.body);

    // 1. Create or update session
    const sessionResult = await query<{ id: string }>(
      `
      INSERT INTO chat_sessions (id, session_code, user_id, title, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, now())
      ON CONFLICT (session_code) DO UPDATE SET
        title = COALESCE(chat_sessions.title, $3),
        updated_at = now()
      RETURNING id
      `,
      [body.sessionCode, user.id, body.title ?? null]
    );

    const sessionId = sessionResult.rows[0]?.id;
    if (!sessionId) {
      throw new AppError('INTERNAL_ERROR', 'Failed to create or find session', 500);
    }

    // 2. Insert messages
    for (const msg of body.messages) {
      await query(
        `
        INSERT INTO chat_messages (id, session_id, role, content, tool_call_ids)
        VALUES (gen_random_uuid(), $1, $2, $3, $4)
        `,
        [sessionId, msg.role, msg.content, msg.toolCallIds]
      );
    }

    res.json({ success: true, sessionId });
  } catch (error) {
    next(error);
  }
});
