import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MessageBubble from '../components/chat/MessageBubble';

describe('Kiểm thử Component MessageBubble', () => {

  it('TC01: Render đúng Avatar và tên người gửi (User)', () => {
    const mockMsg = { id: '1', sender: 'user' as const, content: 'Chào bạn', timestamp: '10:00' };
    render(<MessageBubble message={mockMsg} showTimestamp={true} />);

    expect(screen.getByText('You')).toBeInTheDocument();
    // 10:00 hiển thị ở 2 nơi: một ở trên cùng (do showTimestamp=true) và một ở phần hover action bên dưới
    expect(screen.getAllByText('10:00').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Chào bạn')).toBeInTheDocument();
  });

  it('TC02: Render đúng Avatar và tên người gửi (AI)', () => {
    const mockMsg = { id: '2', sender: 'ai' as const, content: 'Tôi là AI', timestamp: '10:01' };
    render(<MessageBubble message={mockMsg} showTimestamp={false} />);

    expect(screen.getByText('Enterprise AI')).toBeInTheDocument();
    // showTimestamp = false nên timestamp trên cùng bị ẩn, chỉ còn 1 cái ở phần hover action
    expect(screen.getAllByText('10:01').length).toBe(1);
    expect(screen.getByText('Tôi là AI')).toBeInTheDocument();
  });

  it('TC03: Tương tác với tính năng Copy', async () => {
    const mockMsg = { id: '3', sender: 'ai' as const, content: 'Mã bí mật: 123', timestamp: '10:00' };

    const mockWriteText = vi.fn();
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    });

    render(<MessageBubble message={mockMsg} />);

    const copyBtn = screen.getByTitle('Sao chép');
    fireEvent.click(copyBtn);
    expect(mockWriteText).toHaveBeenCalledWith('Mã bí mật: 123');
  });

  it('TC04: Tính năng Edit (Chỉnh sửa) và Gửi lại (Resend) chỉ dành cho User', () => {
    const mockResend = vi.fn();
    const mockMsg = { id: '4', sender: 'user' as const, content: 'Lỗi mạng', timestamp: '10:00' };

    render(<MessageBubble message={mockMsg} onResend={mockResend} />);

    // Mở chế độ Edit
    fireEvent.click(screen.getByTitle('Chỉnh sửa'));

    // Giao diện Edit xuất hiện
    const textarea = screen.getByDisplayValue('Lỗi mạng');
    fireEvent.change(textarea, { target: { value: 'Fix lỗi mạng' } });

    // Bấm Send
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    // Đảm bảo hàm onResend được gọi
    expect(mockResend).toHaveBeenCalledWith('Fix lỗi mạng');
  });

  it('TC05: Hủy Edit và quay về như cũ', () => {
    const mockMsg = { id: '5', sender: 'user' as const, content: 'Giữ nguyên', timestamp: '10:00' };
    render(<MessageBubble message={mockMsg} />);

    fireEvent.click(screen.getByTitle('Chỉnh sửa'));

    const textarea = screen.getByDisplayValue('Giữ nguyên');
    fireEvent.change(textarea, { target: { value: 'Thay đổi...' } });

    // Bấm Cancel
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Dữ liệu quay về ban đầu
    expect(screen.getByText('Giữ nguyên')).toBeInTheDocument();
  });

  it('TC06: Render Markdown thành công', () => {
    const mockMsg = { id: '6', sender: 'ai' as const, content: '**Chữ đậm** và *Chữ nghiêng*', timestamp: '10:00' };
    render(<MessageBubble message={mockMsg} />);

    // Markdown sẽ convert **Chữ đậm** thành <strong>
    const strongEl = screen.getByText('Chữ đậm');
    expect(strongEl.tagName).toBe('STRONG');

    const emEl = screen.getByText('Chữ nghiêng');
    expect(emEl.tagName).toBe('EM');
  });

  it('TC07: Hiển thị danh sách ToolTrace khi AI gọi tool (Function Calling)', () => {
    const mockMsg = {
      id: '7',
      sender: 'ai' as const,
      content: 'Tool running',
      timestamp: '10:00',
      toolCalls: [
        { toolName: 'search', arguments: { q: 'test' }, success: true, durationMs: 100 }
      ]
    };
    render(<MessageBubble message={mockMsg} />);

    // Đảm bảo ToolTrace được render thông qua prop truyền xuống
    expect(screen.getByText(/Tool called: search/i)).toBeInTheDocument();
  });

  it('TC08: Ngăn chặn gửi lại tin nhắn nếu nội dung sửa rỗng', () => {
    const mockResend = vi.fn();
    const mockMsg = { id: '8', sender: 'user' as const, content: 'Cũ', timestamp: '10:00' };
    render(<MessageBubble message={mockMsg} onResend={mockResend} />);

    fireEvent.click(screen.getByTitle('Chỉnh sửa'));

    const textarea = screen.getByDisplayValue('Cũ');
    fireEvent.change(textarea, { target: { value: '   ' } });

    const sendBtn = screen.getByRole('button', { name: 'Send' });
    // Dù người dùng có cố click đi chăng nữa
    fireEvent.click(sendBtn);

    expect(mockResend).not.toHaveBeenCalled();
  });

  it('TC09: Hiển thị cảnh báo lỗi khi nội dung tin nhắn bị rỗng', () => {
    // Ép kiểu để bỏ qua lỗi TypeScript khi test
    const mockMsg = { id: '9', sender: 'ai' as const, content: '', timestamp: '10:00' };
    render(<MessageBubble message={mockMsg} />);

    expect(screen.getByText('⚠️ Lỗi: Dữ liệu message.content bị rỗng (undefined)')).toBeInTheDocument();
  });

  it('TC10: Không gọi onResend nếu nội dung sửa giống hệt nội dung cũ', () => {
    const mockResend = vi.fn();
    const mockMsg = { id: '10', sender: 'user' as const, content: 'Giống nhau', timestamp: '10:00' };
    render(<MessageBubble message={mockMsg} onResend={mockResend} />);

    fireEvent.click(screen.getByTitle('Chỉnh sửa'));

    // Không thay đổi gì, để nguyên nội dung như cũ
    const textarea = screen.getByDisplayValue('Giống nhau');
    fireEvent.change(textarea, { target: { value: 'Giống nhau' } });

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    // Không thay đổi nội dung → không gọi onResend
    expect(mockResend).not.toHaveBeenCalled();
  });

  it('TC11: Hiển thị đúng phần giờ khi timestamp có định dạng "ngày at giờ"', () => {
    const mockMsg = { id: '11', sender: 'ai' as const, content: 'Test', timestamp: '2023-01-01 at 10:30' };
    render(<MessageBubble message={mockMsg} />);

    // Chỉ hiển thị phần sau chữ " at ", tức là "10:30"
    expect(screen.getByText('10:30')).toBeInTheDocument();
  });
});
