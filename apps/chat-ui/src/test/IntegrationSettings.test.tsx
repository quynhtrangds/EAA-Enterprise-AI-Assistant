import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('TC-UI-01: Render 4 tab ứng dụng tích hợp (CRM, ERPNext, Zammad, Gitea)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ integrations: [] })
    });

    render(<IntegrationSettings onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Kết nối Tích hợp/i)[0]).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Zammad Helpdesk/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gitea/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ERPNext/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CRM \(Salesforce \/ HubSpot\)/i })).toBeInTheDocument();
  });

  it('TC-UI-02: Cho phép nhập API URL & Key và submit lưu cấu hình thành công', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url, options) => {
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
      expect(screen.getAllByRole('button', { name: /Zammad Helpdesk/i })[0]).toBeInTheDocument();
    });

    // Switch to Zammad tab
    fireEvent.click(screen.getAllByRole('button', { name: /Zammad Helpdesk/i })[0]);

    // Type URL & API Key
    const urlInput = screen.getByPlaceholderText('https://api.example.com...');
    fireEvent.change(urlInput, { target: { value: 'http://localhost:8080' } });

    const keyInput = screen.getByPlaceholderText('Bỏ trống nếu không muốn thay đổi...');
    fireEvent.change(keyInput, { target: { value: 'token_zammad_123' } });

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Lưu kết nối/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/Đã lưu cấu hình và thông tin kết nối vào Vault/i)).toBeInTheDocument();
    });
  });

  it('TC-UI-03: Báo lỗi khi cập nhật quyền người dùng thất bại (Không tạo ảo giác thành công)', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/role')) {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ message: 'Không đủ quyền thực hiện thao tác' })
        });
      }
      if (url.includes('/users')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            users: [
              { id: 'user-1', username: 'staff1', display_name: 'Staff One', role: 'manager' }
            ]
          })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ integrations: [] }) });
    });

    render(<IntegrationSettings onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Phân quyền$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Phân quyền$/i }));

    await waitFor(() => {
      expect(screen.getByText('staff1')).toBeInTheDocument();
    });

    const userRoleSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(userRoleSelect, { target: { value: 'staff' } });

    await waitFor(() => {
      expect(screen.getByText(/Không đủ quyền thực hiện thao tác/i)).toBeInTheDocument();
      expect(screen.queryByText(/Đã đổi quyền thành công/i)).not.toBeInTheDocument();
    });
  });
});
