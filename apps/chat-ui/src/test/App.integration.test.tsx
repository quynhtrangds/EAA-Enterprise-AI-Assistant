import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

// Setup global fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;
// Mock scrollIntoView for jsdom
Element.prototype.scrollIntoView = vi.fn();
process.env.DEBUG_PRINT_LIMIT = '1000000';

// Xoá tất cả module mock (đặc biệt là AuthContext và useChat) để test tích hợp
vi.unmock('../contexts/AuthContext');
vi.unmock('../hooks/useChat');

describe('App Integration Tests', () => {
  let messageCount = 2;

  beforeEach(() => {
    mockFetch.mockClear();
    messageCount = 2;
    
    // Default robust mock implementation for all endpoints
    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      console.log('mockFetch called with:', urlStr);
      
      if (urlStr.includes('/login')) {
        return { ok: true, json: async () => ({ token: 'integration-jwt-token' }) };
      }
      
      if (urlStr.endsWith('/sessions')) {
        return {
          ok: true,
          json: async () => ({
            sessions: [
              { sessionId: 'session-old-1', title: 'Test Session', updatedAt: new Date().toISOString() }
            ]
          })
        };
      }
      
      if (urlStr.includes('/api/chat/sessions/')) {
        const msgs = [
          { id: 'm1', role: 'user', content: 'Hello AI', createdAt: new Date().toISOString() },
          { id: 'm2', role: 'assistant', content: 'Hi User', createdAt: new Date().toISOString(), toolCalls: [{ toolName: 'search_db', arguments: { query: 'test' }, status: 'success', durationMs: 100 }] }
        ];
        if (messageCount > 2) {
          msgs.push({ id: 'm3', role: 'user', content: 'New integrated message', createdAt: new Date().toISOString() });
          msgs.push({ id: 'm4', role: 'assistant', content: 'Response', createdAt: new Date().toISOString() });
        }
        return { ok: true, json: async () => ({ messages: msgs }) };
      }
      
      if (urlStr.includes('/api/chat') && !urlStr.includes('sessions') && !urlStr.includes('search')) {
        messageCount = 4; // next fetch gets more messages
        return { ok: true, json: async () => ({ sessionId: 'session-old-1' }) };
      }

      if (urlStr.includes('/api/chat/search')) {
        return {
          ok: true,
          json: async () => ({
            sessions: [
              {
                sessionId: 'search-result-1',
                title: 'Found Session',
                matchedMessage: 'This matches your query',
                updatedAt: new Date().toISOString()
              }
            ]
          })
        };
      }
      
      return { ok: true, json: async () => ({}) };
    });
  });

  it('TC01: End-to-end user flow: Login -> Fetch Sessions -> Send Message -> Logout', async () => {
    render(<App />);

    // 1. Initial State: Should show Login Screen
    expect(screen.getByText('Enterprise UI')).toBeInTheDocument();

    // 2. Perform Login
    fireEvent.change(screen.getByPlaceholderText('Nhập tên đăng nhập'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    // Wait for the sessions to load
    await waitFor(() => {
      expect(screen.getByText('Test Session')).toBeInTheDocument();
    });

    // 3. Select existing session
    fireEvent.click(screen.getByText('Test Session'));
    
    // Verify messages and tool trace are rendered
    await waitFor(() => {
      expect(screen.getByText(/Hello AI/i)).toBeInTheDocument();
      expect(screen.getByText(/Hi User/i)).toBeInTheDocument();
      expect(screen.getByText(/search_db/i)).toBeInTheDocument();
    });

    // 4. Send a new message
    const input = screen.getByPlaceholderText('Nhập câu hỏi...');
    fireEvent.change(input, { target: { value: 'New integrated message' } });
    fireEvent.submit(input);

    await waitFor(() => {
      expect(screen.getByText(/Response/i)).toBeInTheDocument();
    });

    // 5. Logout
    fireEvent.click(screen.getByTitle('Tài khoản'));
    await waitFor(() => {
      expect(screen.getByText('Đăng xuất')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Đăng xuất'));
    await waitFor(() => {
      expect(screen.getByText('Enterprise UI')).toBeInTheDocument();
    });
  });

  it('TC02: Create new session -> Send message', async () => {
    render(<App />);

    // Login
    fireEvent.change(screen.getByPlaceholderText('Nhập tên đăng nhập'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => {
      expect(screen.getByText('Test Session')).toBeInTheDocument();
    });

    // Click 'Cuộc trò chuyện mới'
    fireEvent.click(screen.getByText('Cuộc trò chuyện mới'));

    // Send a message
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Nhập câu hỏi...')).not.toBeDisabled();
    });
    const input = screen.getByPlaceholderText('Nhập câu hỏi...');
    fireEvent.change(input, { target: { value: 'This is a new chat message' } });
    fireEvent.submit(input);

    await waitFor(() => {
      expect(screen.getByText(/New integrated message/i)).toBeInTheDocument();
    });
  });

  it('TC03: Search sessions flow', async () => {
    render(<App />);

    // Login
    fireEvent.change(screen.getByPlaceholderText('Nhập tên đăng nhập'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => {
      expect(screen.getByText('Test Session')).toBeInTheDocument();
    });

    // Click Search bar
    fireEvent.click(screen.getByText('Tìm kiếm trong các cuộc trò chuyện'));

    // Type in search modal
    const searchInput = screen.getByPlaceholderText('Tìm kiếm trong các cuộc trò chuyện');
    await waitFor(() => expect(searchInput).toBeInTheDocument());
    fireEvent.change(searchInput, { target: { value: 'query' } });

    await waitFor(() => {
      expect(screen.getByText('Found Session')).toBeInTheDocument();
      expect(screen.getByText(/This matches your query/i)).toBeInTheDocument();
    });
  });

  it('TC04: Rename session flow', async () => {
    render(<App />);

    // Login
    fireEvent.change(screen.getByPlaceholderText('Nhập tên đăng nhập'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => {
      expect(screen.getByText('Test Session')).toBeInTheDocument();
    });

    const menuBtn = screen.getByText('Test Session').closest('.group')?.querySelector('button.absolute') as HTMLButtonElement;
    expect(menuBtn).toBeInTheDocument();
    
    // Click the 3-dot menu button
    fireEvent.click(menuBtn);

    // Dropdown is shown. Click "Đổi tên"
    const renameOption = screen.getByText('Đổi tên');
    expect(renameOption).toBeInTheDocument();
    fireEvent.click(renameOption);

    // Input element should be displayed
    const input = screen.getByDisplayValue('Test Session');
    expect(input).toBeInTheDocument();

    // Type new title
    fireEvent.change(input, { target: { value: 'Updated Session Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Verify it updates on the screen and calls fetch API
    await waitFor(() => {
      expect(screen.getByText('Updated Session Name')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/chat/sessions/session-old-1'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated Session Name' })
      })
    );
  });

  it('TC05: Pin/Toggle star session flow', async () => {
    render(<App />);

    // Login
    fireEvent.change(screen.getByPlaceholderText('Nhập tên đăng nhập'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => {
      expect(screen.getByText('Test Session')).toBeInTheDocument();
    });

    const menuBtn = screen.getByText('Test Session').closest('.group')?.querySelector('button.absolute') as HTMLButtonElement;
    fireEvent.click(menuBtn);

    // Click "Ghim"
    const starOption = screen.getByText('Ghim');
    fireEvent.click(starOption);

    // Verify star API is called
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat/sessions/session-old-1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ isStarred: true })
        })
      );
    });
  });

  it('TC06: Render tool trace under assistant message bubble', async () => {
    render(<App />);

    // Login
    fireEvent.change(screen.getByPlaceholderText('Nhập tên đăng nhập'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => {
      expect(screen.getByText('Test Session')).toBeInTheDocument();
    });

    // Select the session to load its messages (one has toolCalls)
    fireEvent.click(screen.getByText('Test Session'));

    await waitFor(() => {
      expect(screen.getByText('search_db')).toBeInTheDocument();
    });

    // Click the tool trace header button to expand
    const traceBtn = screen.getByText('search_db').closest('button') as HTMLButtonElement;
    fireEvent.click(traceBtn);

    // Verify input arguments are displayed
    await waitFor(() => {
      expect(screen.getByText(/"query": "test"/i)).toBeInTheDocument();
    });
  });

  it('TC07: Handle login failure response', async () => {
    // Override login to return 401
    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/login')) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ success: false, errorCode: 'UNAUTHENTICATED', message: 'Tên đăng nhập hoặc mật khẩu không chính xác' })
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText('Nhập tên đăng nhập'), { target: { value: 'wrong-admin' } });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => {
      expect(screen.getByText('Sai tên đăng nhập hoặc mật khẩu.')).toBeInTheDocument();
    });
  });
});
