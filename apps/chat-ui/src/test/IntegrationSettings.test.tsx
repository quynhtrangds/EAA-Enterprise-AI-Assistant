import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntegrationSettings } from '../components/admin/IntegrationSettings';
import { useAuth } from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

describe('IntegrationSettings Component', () => {
  const onClose = vi.fn();
  const mockAuth = {
    authToken: 'test-token',
    currentUser: { id: '1', username: 'admin', displayName: 'Admin', email: 'admin@example.com', roles: ['admin'], tenantId: '00000000-0000-0000-0000-000000000000' },
    login: vi.fn(),
    logout: vi.fn()
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    (useAuth as any).mockReturnValue(mockAuth);
  });

  it('TC-UI-01: Render 4 tab ứng dụng tích hợp (CRM, ERPNext, Zammad, Gitea)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ integrations: [] })
    });

    render(<IntegrationSettings onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText(/Kết nối Tích hợp/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Zammad Helpdesk/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gitea/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ERPNext/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CRM/i })).toBeInTheDocument();
  });

  it('TC-UI-02: Cho phép nhập API URL & Key và submit lưu cấu hình thành công', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      if (options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, message: 'Đã lưu cấu hình và thông tin kết nối vào Vault' })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ integrations: [] })
      });
    });

    render(<IntegrationSettings onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Zammad Helpdesk/i })).toBeInTheDocument();
    });

    // Switch to Zammad tab
    fireEvent.click(screen.getByRole('button', { name: /Zammad Helpdesk/i }));

    // Type URL & API Key
    const urlInput = screen.getByPlaceholderText('https://api.example.com...');
    fireEvent.change(urlInput, { target: { value: 'http://localhost:8080' } });

    const keyInput = screen.getByPlaceholderText('Bỏ trống nếu không muốn thay đổi...');
    fireEvent.change(keyInput, { target: { value: 'token_zammad_123' } });

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Lưu cấu hình/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/Đã lưu cấu hình và thông tin kết nối vào Vault/i)).toBeInTheDocument();
    });
  });
});
