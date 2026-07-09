import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/app-error.js';
import type { ToolContext } from '../types/tool.js';
import { getUserByToken } from './auth-sessions.js';

export interface CurrentUser {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
}

export async function getCurrentUser(req: Request): Promise<CurrentUser> {
  const authorization = String(req.header('authorization') ?? '').trim();
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new AppError('UNAUTHORIZED', 'Ban phai cung cap header Authorization: Bearer <token>.', 401);
  }

  const token = match[1];
  if (!token) {
    throw new AppError('UNAUTHORIZED', 'Ban phai cung cap header Authorization: Bearer <token>.', 401);
  }

  const user = await getUserByToken(token.trim());
  if (!user) {
    throw new AppError('UNAUTHENTICATED', 'Token khong hop le hoac da het han.', 401);
  }

  return user;
}

export function createToolContext(req: Request, user: CurrentUser, sessionId: string): ToolContext {
  return {
    userId: user.id,
    username: user.username,
    roles: user.roles,
    sessionId,
    requestId: String(req.header('x-request-id') ?? randomUUID())
  };
}
