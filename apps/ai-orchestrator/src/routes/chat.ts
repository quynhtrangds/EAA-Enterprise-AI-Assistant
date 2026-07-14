import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { McpGatewayClient } from '../gateway/mcp-gateway-client.js';
import { appendChatTurn, editChatTurn, getChatMessages, listChatSessions, renameSession, toggleStarSession, searchChatSessions, deleteSession } from '../repositories/chat-history-repository.js';
import { ChatService } from '../services/chat-service.js';

export const chatRouter = Router();

const chatService = new ChatService();
const gatewayClient = new McpGatewayClient();

const chatSchema = z.object({
  sessionId: z.string().trim().min(1).default('default-session'),
  message: z.string().trim().min(1)
});

const chatEditSchema = z.object({
  sessionId: z.string().trim().min(1),
  messageId: z.string().trim().min(1),
  message: z.string().trim().min(1)
});

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1)
});

const sessionUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  isStarred: z.boolean().optional()
});

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
    const user = await gatewayClient.getCurrentUser(authToken);
    const output = await chatService.chat({ ...body, authToken });
    await appendChatTurn({
      sessionId: output.sessionId,
      userId: user.id,
      userMessage: body.message,
      assistantMessage: output.answer,
      toolCalls: output.toolCalls
    });

    res.json(output);
  } catch (error) {
    next(error);
  }
});

chatRouter.post('/chat/edit', async (req, res, next) => {
  try {
    const body = chatEditSchema.parse(req.body);
    const authToken = getBearerToken(req.header('authorization'));
    const user = await gatewayClient.getCurrentUser(authToken);
    const output = await chatService.chat({ sessionId: body.sessionId, message: body.message, authToken });
    
    await editChatTurn({
      sessionId: output.sessionId,
      userId: user.id,
      messageId: body.messageId,
      userMessage: body.message,
      assistantMessage: output.answer,
      toolCalls: output.toolCalls
    });

    res.json(output);
  } catch (error) {
    next(error);
  }
});

chatRouter.get('/chat/sessions', async (req, res, next) => {
  try {
    const authToken = getBearerToken(req.header('authorization'));
    const user = await gatewayClient.getCurrentUser(authToken);
    const sessions = await listChatSessions(user.id);
    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

chatRouter.get('/chat/search', async (req, res, next) => {
  try {
    const authToken = getBearerToken(req.header('authorization'));
    const user = await gatewayClient.getCurrentUser(authToken);
    const q = req.query.q as string;
    
    if (!q || q.trim() === '') {
      res.json({ sessions: [] });
      return;
    }

    const sessions = await searchChatSessions(user.id, q);
    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

chatRouter.get('/chat/sessions/:sessionId', async (req, res, next) => {
  try {
    const authToken = getBearerToken(req.header('authorization'));
    const user = await gatewayClient.getCurrentUser(authToken);
    const messages = await getChatMessages(user.id, req.params.sessionId);
    res.json({
      sessionId: req.params.sessionId,
      messages
    });
  } catch (error) {
    next(error);
  }
});

chatRouter.patch('/chat/sessions/:sessionId', async (req, res, next) => {
  try {
    const body = sessionUpdateSchema.parse(req.body);
    const authToken = getBearerToken(req.header('authorization'));
    const user = await gatewayClient.getCurrentUser(authToken);
    
    if (body.title !== undefined) {
      await renameSession(req.params.sessionId, user.id, body.title);
    }
    if (body.isStarred !== undefined) {
      await toggleStarSession(req.params.sessionId, user.id, body.isStarred);
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

chatRouter.delete('/chat/sessions/:sessionId', async (req, res, next) => {
  try {
    const authToken = getBearerToken(req.header('authorization'));
    const user = await gatewayClient.getCurrentUser(authToken);
    await deleteSession(req.params.sessionId, user.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
