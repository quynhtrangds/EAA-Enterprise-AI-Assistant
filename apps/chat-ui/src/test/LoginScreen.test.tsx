import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginScreen from '../components/auth/LoginScreen';
import { useAuth } from '../contexts/AuthContext';

// Mock @react-oauth/google
vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: any) => <div>{children}</div>,
  GoogleLogin: () => <button>Sign in with Google</button>,
  useGoogleLogin: vi.fn(() => vi.fn())
}));

// Mock hook useAuth
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('Kiểm thử Component LoginScreen', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({ login: mockLogin });
    global.fetch = vi.fn();
  });

  it('TC01: Render giao diện đăng nhập ban đầu đúng chuẩn', () => {
    render(<LoginScreen />);

    expect(screen.getByRole('heading', { name: 'Trợ lý AI Doanh nghiệp' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập tên đăng nhập')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập mật khẩu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument();
  });

  it('TC02: Hiển thị báo lỗi khi bấm submit mà form trống', async () => {
    render(<LoginScreen />);

    const submitBtn = screen.getByRole('button', { name: 'Đăng nhập' });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('TC04: Gọi API đăng nhập thành công và thực thi hàm login()', async () => {
    const mockUser = { id: '1', username: 'admin', displayName: 'Quản trị viên' };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, token: 'mock-jwt-token', user: mockUser }),
    });

    render(<LoginScreen />);

    fireEvent.change(screen.getByPlaceholderText('Nhập tên đăng nhập'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/login', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'password123' }),
      }));
      expect(mockLogin).toHaveBeenCalledWith(mockUser, 'mock-jwt-token');
    });
  });

  it('TC05: Hiển thị lỗi khi API báo sai thông tin (HTTP !ok)', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Sai tên đăng nhập hoặc mật khẩu.' }),
    });

    render(<LoginScreen />);

    fireEvent.change(screen.getByPlaceholderText('Nhập tên đăng nhập'), { target: { value: 'wronguser' } });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Sai tên đăng nhập hoặc mật khẩu.')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });
});
