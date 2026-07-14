import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginScreen from '../components/auth/LoginScreen';
import { useAuth } from '../contexts/AuthContext';

// Mock hook useAuth
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('Kiểm thử Component LoginScreen', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Giả lập hàm login từ context
    (useAuth as any).mockReturnValue({ login: mockLogin });
    // Giả lập window.fetch toàn cục
    global.fetch = vi.fn();
  });

  it('TC01: Render giao diện đăng nhập ban đầu đúng chuẩn', () => {
    render(<LoginScreen />);

    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
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

  it('TC03: Ẩn/hiện mật khẩu khi click vào nút icon "con mắt"', () => {
    render(<LoginScreen />);

    const passwordInput = screen.getByPlaceholderText('Nhập mật khẩu');
    // Nút hiển thị/ẩn nằm ngay bên trong wrapper của input password (là nút đầu tiên trên màn hình)
    const toggleBtn = screen.getAllByRole('button')[0];

    // Ban đầu input là type password
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Click lần 1 để xem chữ
    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');

    // Click lần 2 để che giấu
    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('TC04: Gọi API đăng nhập thành công và thực thi hàm login()', async () => {
    // Giả lập fetch thành công
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'mock-token-xyz' })
    });

    render(<LoginScreen />);

    const usernameInput = screen.getByPlaceholderText('Nhập tên đăng nhập');
    const passwordInput = screen.getByPlaceholderText('Nhập mật khẩu');
    const submitBtn = screen.getByRole('button', { name: 'Đăng nhập' });

    // Nhập dữ liệu
    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    // Submit
    fireEvent.click(submitBtn);

    // Sau khi click submit, nút sẽ rơi vào trạng thái đang loading (disabled)
    expect(submitBtn).toBeDisabled();

    // Đợi quá trình gọi API xong
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'password123' })
      });
      // Đảm bảo hàm login của context được gọi để lưu token
      expect(mockLogin).toHaveBeenCalledWith('admin', 'mock-token-xyz');
    });
  });

  it('TC05: Hiển thị lỗi khi API báo sai thông tin (HTTP !ok)', async () => {
    // Giả lập fetch thất bại (sai pass)
    (global.fetch as any).mockResolvedValueOnce({
      ok: false
    });

    render(<LoginScreen />);

    fireEvent.change(screen.getByPlaceholderText('Nhập tên đăng nhập'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Sai tên đăng nhập hoặc mật khẩu.')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('TC06: Hiển thị lỗi khi xảy ra lỗi mạng (Network Exception)', async () => {
    // Giả lập fetch bị đứt mạng (ném lỗi)
    (global.fetch as any).mockRejectedValueOnce(new Error('Network Error'));

    render(<LoginScreen />);

    fireEvent.change(screen.getByPlaceholderText('Nhập tên đăng nhập'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Không thể kết nối đến máy chủ.')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('TC07: Đảm bảo giao diện cho phép nhập và gửi các ký tự đặc biệt (chống XSS / SQL Injection ở frontend)', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false
    });

    render(<LoginScreen />);

    // Nhập các chuỗi mang tính chất tấn công
    const sqlInjectionStr = "admin' OR 1=1 --";
    const xssStr = "<script>alert(1)</script>";

    fireEvent.change(screen.getByPlaceholderText('Nhập tên đăng nhập'), { target: { value: sqlInjectionStr } });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: xssStr } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    // Đảm bảo dữ liệu vẫn được truyền đi nguyên vẹn để server xử lý
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: sqlInjectionStr, password: xssStr })
      });
    });
  });

  it('TC08: Hiển thị lỗi khi nhập ĐÚNG tài khoản nhưng SAI mật khẩu', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false
    });

    render(<LoginScreen />);

    // Tên đúng, pass sai
    fireEvent.change(screen.getByPlaceholderText('Nhập tên đăng nhập'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'sai_mat_khau_ne' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Sai tên đăng nhập hoặc mật khẩu.')).toBeInTheDocument();
  });

  it('TC09: Ngăn chặn đăng nhập bằng tài khoản KHÔNG CÓ trong danh sách', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false
    });

    render(<LoginScreen />);

    // Tên user không tồn tại
    fireEvent.change(screen.getByPlaceholderText('Nhập tên đăng nhập'), { target: { value: 'nguoi_dung_ma' } });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Sai tên đăng nhập hoặc mật khẩu.')).toBeInTheDocument();
  });
});
