import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { ChatService } from '../services/chat-service.js';
import type { ToolCallTrace } from '../types/chat.js';

export const chatRouter = Router();

const chatService = new ChatService();

const chatSchema = z.object({
  sessionId: z.string().trim().min(1).default('default-session'),
  message: z.string().trim().min(1)
});

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1)
});

interface StoredChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallTrace[];
  createdAt: string;
}

interface StoredChatSession {
  sessionId: string;
  ownerKey: string;
  messages: StoredChatMessage[];
  createdAt: string;
  updatedAt: string;
}

const chatSessions = new Map<string, StoredChatSession>();

function getBearerToken(rawAuthorization: string | undefined): string {
  const match = String(rawAuthorization ?? '').trim().match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new AppError('UNAUTHORIZED', 'Authorization: Bearer <token> header is required.', 401);
  }

  const token = match[1];
  if (!token) {
    throw new AppError('UNAUTHORIZED', 'Authorization: Bearer <token> header is required.', 401);
  }

  return token.trim();
}

function sessionKey(ownerKey: string, sessionId: string): string {
  return `${ownerKey}:${sessionId}`;
}

function createMessageId(role: StoredChatMessage['role']): string {
  return `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getOrCreateSession(ownerKey: string, sessionId: string): StoredChatSession {
  const key = sessionKey(ownerKey, sessionId);
  const existing = chatSessions.get(key);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const session: StoredChatSession = {
    sessionId,
    ownerKey,
    messages: [],
    createdAt: now,
    updatedAt: now
  };
  chatSessions.set(key, session);
  return session;
}

function getSession(ownerKey: string, sessionId: string): StoredChatSession | undefined {
  return chatSessions.get(sessionKey(ownerKey, sessionId));
}

chatRouter.get('/chat', (_req, res) => {
  res.json({
    service: 'ai-orchestrator',
    endpoint: 'POST /api/chat',
    requiredBody: {
      sessionId: 'chat-001',
      message: 'Hôm nay doanh thu bao nhiêu?'
    },
    requiredHeader: {
      Authorization: 'Bearer <token>'
    }
  });
});

chatRouter.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const response = await fetch(`${env.MCP_GATEWAY_URL}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const payload = await response.json();

    res.status(response.status).json(payload);
  } catch (error) {
    next(error);
  }
});

chatRouter.post('/chat', async (req, res, next) => {
  try {
    const body = chatSchema.parse(req.body);
    const authToken = getBearerToken(req.header('authorization'));
    const output = await chatService.chat({ ...body, authToken });
    const session = getOrCreateSession(authToken, output.sessionId);
    const now = new Date().toISOString();

    session.messages.push(
      {
        id: createMessageId('user'),
        role: 'user',
        content: body.message,
        createdAt: now
      },
      {
        id: createMessageId('assistant'),
        role: 'assistant',
        content: output.answer,
        toolCalls: output.toolCalls,
        createdAt: now
      }
    );
    session.updatedAt = now;

    res.json(output);
  } catch (error) {
    next(error);
  }
});

chatRouter.get('/chat/sessions', (req, res) => {
  const authToken = getBearerToken(req.header('authorization'));
  const sessions = [...chatSessions.values()]
    .filter((session) => session.ownerKey === authToken)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((session) => {
      const lastMessage = session.messages.at(-1);
      return {
        sessionId: session.sessionId,
        lastMessage: lastMessage
          ? {
              role: lastMessage.role,
              content: lastMessage.content,
              createdAt: lastMessage.createdAt
            }
          : null,
        messageCount: session.messages.length,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      };
    });

  res.json({ sessions });
});

chatRouter.get('/chat/sessions/:sessionId', (req, res) => {
  const authToken = getBearerToken(req.header('authorization'));
  const session = getSession(authToken, req.params.sessionId);
  res.json({
    sessionId: req.params.sessionId,
    messages: session?.messages ?? []
  });
});
