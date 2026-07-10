import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { McpGatewayClient } from '../gateway/mcp-gateway-client.js';
import { appendChatTurn, deleteChatSession, getChatMessages, listChatSessions } from '../repositories/chat-history-repository.js';
import { ChatService } from '../services/chat-service.js';

export const chatRouter = Router();

const chatService = new ChatService();
const gatewayClient = new McpGatewayClient();

const chatSchema = z.object({
  sessionId: z.string().trim().min(1).default('default-session'),
  message: z.string().trim().min(1)
});

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1)
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

chatRouter.delete('/chat/sessions/:sessionId', async (req, res, next) => {
  try {
    const authToken = getBearerToken(req.header('authorization'));
    const user = await gatewayClient.getCurrentUser(authToken);
    await deleteChatSession(user.id, req.params.sessionId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
