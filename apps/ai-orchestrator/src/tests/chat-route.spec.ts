import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { getCurrentUser, chatMock, appendChatTurn } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  chatMock: vi.fn(),
  appendChatTurn: vi.fn()
}));

vi.mock('../gateway/mcp-gateway-client.js', () => ({
  McpGatewayClient: vi.fn().mockImplementation(function (this: any) {
    this.getCurrentUser = getCurrentUser;
  })
}));

vi.mock('../services/chat-service.js', () => ({
  ChatService: vi.fn().mockImplementation(function (this: any) {
    this.chat = chatMock;
  })
}));

vi.mock('../repositories/chat-history-repository.js', () => ({
  appendChatTurn,
  editChatTurn: vi.fn(),
  getChatMessages: vi.fn(),
  listChatSessions: vi.fn(),
  renameSession: vi.fn(),
  toggleStarSession: vi.fn(),
  searchChatSessions: vi.fn(),
  deleteSession: vi.fn()
}));

import { createApp } from '../app.js';

const FAKE_USER = { id: 'user-1', username: 'staff', roles: ['staff'], tenantId: 'tenant-1' };

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(FAKE_USER);
    chatMock.mockResolvedValue({ sessionId: 'session-123', answer: 'ok', toolCalls: [] });
    appendChatTurn.mockResolvedValue(undefined);
  });

  it('trả 400 khi thiếu sessionId (không còn fallback về 1 session mặc định dùng chung)', async () => {
    const response = await request(createApp())
      .post('/api/chat')
      .set('Authorization', 'Bearer valid-token')
      .send({ message: 'Hôm nay doanh thu bao nhiêu?' })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      errorCode: 'INVALID_CHAT_INPUT'
    });
    // Không được gọi tới ChatService/appendChatTurn khi input không hợp lệ
    expect(chatMock).not.toHaveBeenCalled();
    expect(appendChatTurn).not.toHaveBeenCalled();
  });

  it('trả 400 khi sessionId là chuỗi rỗng', async () => {
    const response = await request(createApp())
      .post('/api/chat')
      .set('Authorization', 'Bearer valid-token')
      .send({ sessionId: '   ', message: 'Hôm nay doanh thu bao nhiêu?' })
      .expect(400);

    expect(response.body.errorCode).toBe('INVALID_CHAT_INPUT');
  });

  it('xử lý bình thường khi có sessionId hợp lệ', async () => {
    const response = await request(createApp())
      .post('/api/chat')
      .set('Authorization', 'Bearer valid-token')
      .send({ sessionId: 'session-123', message: 'Hôm nay doanh thu bao nhiêu?' })
      .expect(200);

    expect(response.body).toMatchObject({ sessionId: 'session-123', answer: 'ok' });
    expect(chatMock).toHaveBeenCalledWith({
      sessionId: 'session-123',
      message: 'Hôm nay doanh thu bao nhiêu?',
      authToken: 'valid-token',
      userId: 'user-1',
      tenantId: 'tenant-1'
    });
    expect(appendChatTurn).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-123', userId: 'user-1', tenantId: 'tenant-1' })
    );
  });
});
