import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatWindow from '../components/chat/ChatWindow';
import { useChat } from '../hooks/useChat';

// Mock hook useChat
vi.mock('../hooks/useChat', () => ({
  useChat: vi.fn(),
}));

// Mock scrollIntoView vì jsdom không hỗ trợ hàm này
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('Kiểm thử Component ChatWindow', () => {
  const mockSendMessage = vi.fn();
  const mockEditMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC01: Render màn hình Welcome khi chưa có tin nhắn nào', () => {
    (useChat as any).mockReturnValue({
      messages: [],
      isLoading: false,
      sendMessage: mockSendMessage,
      editMessage: mockEditMessage,
    });

    const props = (useChat as any)();
    render(<ChatWindow {...props} />);

    // Kiểm tra hiển thị màn hình chào mừng
    expect(screen.getByText('Trợ lý AI Doanh nghiệp')).toBeInTheDocument();
    expect(screen.getByText(/Trợ lý thông minh kết nối trực tiếp với hệ thống dữ liệu doanh nghiệp/i)).toBeInTheDocument();

    // Kiểm tra có ô nhập liệu
    expect(screen.getByPlaceholderText('Nhập câu hỏi...')).toBeInTheDocument();
  });

  it('TC02: Render danh sách tin nhắn khi có dữ liệu', () => {
    const mockMessages = [
      { id: '1', role: 'user', content: 'Xin chào', timestamp: '2023-01-01 at 10:00' },
      { id: '2', role: 'assistant', content: 'Chào bạn, tôi có thể giúp gì?', timestamp: '2023-01-01 at 10:01' }
    ];

    (useChat as any).mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      sendMessage: mockSendMessage,
      editMessage: mockEditMessage,
    });

    const props = (useChat as any)();
    render(<ChatWindow {...props} />);

    // Welcome screen không được hiển thị
    expect(screen.queryByText('Trợ lý AI Doanh nghiệp')).not.toBeInTheDocument();

    // Kiểm tra nội dung tin nhắn được render
    expect(screen.getByText('Xin chào')).toBeInTheDocument();
    expect(screen.getByText('Chào bạn, tôi có thể giúp gì?')).toBeInTheDocument();
  });

  it('TC03: Hiển thị trạng thái đang tải (Loading indicator) khi AI đang suy nghĩ', () => {
    const mockMessages = [
      { id: '1', role: 'user', content: 'Doanh thu hôm nay?', timestamp: '2023-01-01 at 10:00' }
    ];

    (useChat as any).mockReturnValue({
      messages: mockMessages,
      isLoading: true,
      sendMessage: mockSendMessage,
      editMessage: mockEditMessage,
    });

    const props = (useChat as any)();
    render(<ChatWindow {...props} />);

    // Kiểm tra indicator "Đang truy vấn dữ liệu..." xuất hiện
    expect(screen.getByText('Đang truy vấn dữ liệu...')).toBeInTheDocument();
  });

  it('TC04: Gọi sendMessage khi người dùng submit tin nhắn mới qua ChatInput', () => {
    (useChat as any).mockReturnValue({
      messages: [],
      isLoading: false,
      sendMessage: mockSendMessage,
      editMessage: mockEditMessage,
    });

    const props = (useChat as any)();
    render(<ChatWindow {...props} />);

    const inputEl = screen.getByPlaceholderText('Nhập câu hỏi...');
    fireEvent.change(inputEl, { target: { value: 'Báo cáo doanh thu' } });
    fireEvent.submit(inputEl.closest('form')!);

    expect(mockSendMessage).toHaveBeenCalledWith('Báo cáo doanh thu');
  });

  it('TC05: Tự động cuộn xuống cuối (scrollIntoView) khi có tin nhắn mới', () => {
    (useChat as any).mockReturnValue({
      messages: [{ id: '1', role: 'user', content: 'Tin nhắn 1', timestamp: '10:00' }],
      isLoading: false,
      sendMessage: mockSendMessage,
      editMessage: mockEditMessage,
    });

    const props1 = (useChat as any)();
    const { rerender } = render(<ChatWindow {...props1} />);
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

    // Rerender với tin nhắn mới
    (useChat as any).mockReturnValue({
      messages: [
        { id: '1', role: 'user', content: 'Tin nhắn 1', timestamp: '10:00' },
        { id: '2', role: 'assistant', content: 'Phản hồi 1', timestamp: '10:01' }
      ],
      isLoading: false,
      sendMessage: mockSendMessage,
      editMessage: mockEditMessage,
    });

    const props2 = (useChat as any)();
    rerender(<ChatWindow {...props2} />);

    // scrollIntoView phải được gọi nhiều hơn 1 lần
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('TC06: Gọi hàm editMessage khi người dùng sửa và gửi lại tin nhắn', () => {
    const mockMessages = [
      { id: 'msg-123', sender: 'user', content: 'Tin nhắn cũ', timestamp: '2023-01-01 at 10:00' }
    ];

    (useChat as any).mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      sendMessage: mockSendMessage,
      editMessage: mockEditMessage,
    });

    const props = (useChat as any)();
    render(<ChatWindow {...props} />);

    // Click nút "Chỉnh sửa"
    const editBtn = screen.getByTitle('Chỉnh sửa');
    fireEvent.click(editBtn);

    // Tìm ô textarea chứa nội dung cũ
    const textarea = screen.getByDisplayValue('Tin nhắn cũ');
    fireEvent.change(textarea, { target: { value: 'Tin nhắn mới đã sửa' } });

    // Click nút Send
    const sendBtn = screen.getByRole('button', { name: 'Send' });
    fireEvent.click(sendBtn);

    // Hàm editMessage phải được gọi với ID và nội dung mới
    expect(mockEditMessage).toHaveBeenCalledWith('msg-123', 'Tin nhắn mới đã sửa');
  });

  it('TC07: Hiển thị System Log khi AI gọi tool (Function Calling) thành công', () => {
    const mockMessages = [
      {
        id: 'msg-456',
        sender: 'ai',
        role: 'assistant',
        content: 'Tôi đã lấy dữ liệu cho bạn',
        timestamp: '2023-01-01 at 10:05',
        toolCalls: [
          {
            toolName: 'query_database',
            arguments: { table: 'users', limit: 5 },
            success: true,
            durationMs: 120
          }
        ]
      }
    ];

    (useChat as any).mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      sendMessage: mockSendMessage,
      editMessage: mockEditMessage,
    });

    const props = (useChat as any)();
    render(<ChatWindow {...props} />);

    // Kiểm tra hiển thị tiêu đề tool
    const toolHeader = screen.getByText('query_database');
    expect(toolHeader).toBeInTheDocument();

    // Ban đầu nội dung JSON bị ẩn (chưa mở rộng)
    expect(screen.queryByText(/table/i)).not.toBeInTheDocument();

    // Click vào header để mở rộng
    fireEvent.click(toolHeader.closest('button')!);

    // Bây giờ nội dung JSON và status sẽ hiển thị
    expect(screen.getByText(/"table": "users"/i)).toBeInTheDocument();
    expect(screen.getByText('success')).toBeInTheDocument();
  });

  it('TC08: Hủy bỏ chỉnh sửa tin nhắn (Cancel edit)', () => {
    const mockMessages = [
      { id: 'msg-123', sender: 'user', content: 'Tin nhắn cũ', timestamp: '2023-01-01 at 10:00' }
    ];

    (useChat as any).mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      sendMessage: mockSendMessage,
      editMessage: mockEditMessage,
    });

    const props = (useChat as any)();
    render(<ChatWindow {...props} />);

    // Mở chế độ chỉnh sửa
    fireEvent.click(screen.getByTitle('Chỉnh sửa'));

    const textarea = screen.getByDisplayValue('Tin nhắn cũ');
    fireEvent.change(textarea, { target: { value: 'Tin nhắn gõ dở' } });

    // Bấm nút Cancel
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Đảm bảo không gọi editMessage
    expect(mockEditMessage).not.toHaveBeenCalled();

    // Đảm bảo quay về trạng thái hiển thị bình thường
    expect(screen.queryByDisplayValue('Tin nhắn gõ dở')).not.toBeInTheDocument(); // textarea biến mất
    expect(screen.getByText('Tin nhắn cũ')).toBeInTheDocument();
  });

  it('TC09: Sao chép nội dung tin nhắn (Copy to clipboard)', async () => {
    const mockMessages = [
      { id: 'msg-123', sender: 'ai', content: 'Nội dung cần copy', timestamp: '2023-01-01 at 10:00' }
    ];

    (useChat as any).mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      sendMessage: mockSendMessage,
      editMessage: mockEditMessage,
    });

    // Mock navigator.clipboard
    const mockWriteText = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    const props = (useChat as any)();
    render(<ChatWindow {...props} />);

    // Bấm nút Sao chép
    fireEvent.click(screen.getByTitle('Sao chép'));

    expect(mockWriteText).toHaveBeenCalledWith('Nội dung cần copy');
  });

  it('TC10: Hiển thị trạng thái failed khi AI gọi tool thất bại', () => {
    const mockMessages = [
      {
        id: 'msg-456',
        sender: 'ai',
        role: 'assistant',
        content: 'Lỗi',
        timestamp: '2023-01-01 at 10:05',
        toolCalls: [
          {
            toolName: 'read_file',
            arguments: { path: '/secret.txt' },
            success: false,
            durationMs: 50
          }
        ]
      }
    ];

    (useChat as any).mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      sendMessage: mockSendMessage,
      editMessage: mockEditMessage,
    });

    const props = (useChat as any)();
    render(<ChatWindow {...props} />);

    const toolHeader = screen.getByText('read_file');
    fireEvent.click(toolHeader.closest('button')!);

    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('TC11: Ngăn chặn gửi lại tin nhắn nếu nội dung sửa bị rỗng hoặc chỉ chứa khoảng trắng', () => {
    const mockMessages = [
      { id: 'msg-123', sender: 'user', content: 'Tin nhắn cũ', timestamp: '2023-01-01 at 10:00' }
    ];

    (useChat as any).mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      sendMessage: mockSendMessage,
      editMessage: mockEditMessage,
    });

    const props = (useChat as any)();
    render(<ChatWindow {...props} />);

    fireEvent.click(screen.getByTitle('Chỉnh sửa'));

    const textarea = screen.getByDisplayValue('Tin nhắn cũ');
    // Nhập toàn khoảng trắng
    fireEvent.change(textarea, { target: { value: '   ' } });

    const sendBtn = screen.getByRole('button', { name: 'Send' });
    // Nút gửi có thể bị vô hiệu hoá (disabled), ta thử click
    fireEvent.click(sendBtn);

    // Đảm bảo không gọi API sửa tin nhắn
    expect(mockEditMessage).not.toHaveBeenCalled();
  });

  it('TC12: Hiển thị cảnh báo lỗi khi nội dung tin nhắn bị rỗng (undefined hoặc chuỗi rỗng)', () => {
    const mockMessages = [
      { id: 'msg-err', sender: 'ai', content: '', timestamp: '2023-01-01 at 10:00' }
    ];

    (useChat as any).mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      sendMessage: mockSendMessage,
      editMessage: mockEditMessage,
    });

    const props = (useChat as any)();
    render(<ChatWindow {...props} />);

    // Phải hiển thị dòng cảnh báo lỗi
    expect(screen.getByText(/Lỗi: nội dung tin nhắn bị rỗng/i)).toBeInTheDocument();
  });
});
