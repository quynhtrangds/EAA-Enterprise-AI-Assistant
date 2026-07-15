import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SearchModal from '../components/chat/SearchModal';

// Dữ liệu giả lập dùng chung
const mockSessions = [
  { id: 's1', title: 'Phân tích doanh thu Q1', session_code: 'SC001', updatedAt: '10:00', messages: [] },
  { id: 's2', title: 'Báo cáo nhân sự tháng 6', session_code: 'SC002', updatedAt: '09:30', messages: [] },
  { id: 's3', title: 'Top khách hàng VIP', session_code: 'SC003', updatedAt: '09:00', messages: [] },
];

const mockSearchResults = [
  { id: 's1', title: 'Phân tích doanh thu Q1', session_code: 'SC001', updatedAt: '10:00', matchedMessage: 'Doanh thu tháng 1 là 2 tỷ đồng' },
];

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  sessions: mockSessions,
  onSelectSession: vi.fn(),
};

describe('Kiểm thử Component SearchModal', () => {

  it('TC01: Không render gì khi isOpen = false', () => {
    render(<SearchModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByPlaceholderText('Tìm kiếm trong các cuộc trò chuyện')).not.toBeInTheDocument();
  });

  it('TC02: Render modal với ô tìm kiếm và danh sách gần đây khi isOpen = true', () => {
    render(<SearchModal {...defaultProps} />);
    
    expect(screen.getByPlaceholderText('Tìm kiếm trong các cuộc trò chuyện')).toBeInTheDocument();
    // Header mặc định khi chưa gõ gì là "Gần đây"
    expect(screen.getByText('Gần đây')).toBeInTheDocument();
    // Danh sách sessions được hiển thị
    expect(screen.getByText('Phân tích doanh thu Q1')).toBeInTheDocument();
    expect(screen.getByText('Báo cáo nhân sự tháng 6')).toBeInTheDocument();
  });

  it('TC03: Nhập từ khóa tìm kiếm thay đổi header sang "Kết quả"', () => {
    render(<SearchModal {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Tìm kiếm trong các cuộc trò chuyện');
    fireEvent.change(input, { target: { value: 'doanh thu' } });
    
    expect(screen.getByText('Kết quả')).toBeInTheDocument();
  });

  it('TC04: Nhấn phím Escape gọi hàm onClose', () => {
    const onClose = vi.fn();
    render(<SearchModal {...defaultProps} onClose={onClose} />);
    
    const input = screen.getByPlaceholderText('Tìm kiếm trong các cuộc trò chuyện');
    fireEvent.keyDown(input, { key: 'Escape' });
    
    expect(onClose).toHaveBeenCalled();
  });

  it('TC05: Click ra ngoài modal (backdrop) gọi hàm onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<SearchModal {...defaultProps} onClose={onClose} />);
    
    // Phần tử -z-10 là backdrop click-outside
    const backdrop = container.querySelector('.absolute.inset-0.-z-10') as HTMLElement;
    fireEvent.click(backdrop);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('TC06: Hiển thị nút X để xóa từ khóa khi có nội dung', () => {
    const { container } = render(<SearchModal {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Tìm kiếm trong các cuộc trò chuyện');
    
    // Ban đầu không có nút X (nút clear absolute)
    expect(container.querySelector('button.absolute')).not.toBeInTheDocument();
    
    // Nhập từ khóa → nút X xuất hiện
    fireEvent.change(input, { target: { value: 'test' } });
    expect(container.querySelector('button.absolute')).toBeInTheDocument();
  });

  it('TC07: Bấm nút X xóa từ khóa, quay về danh sách "Gần đây"', () => {
    const { container } = render(<SearchModal {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Tìm kiếm trong các cuộc trò chuyện');
    fireEvent.change(input, { target: { value: 'test' } });
    
    // Bấm nút X (nút clear button là absolute)
    const clearBtn = container.querySelector('button.absolute') as HTMLElement;
    fireEvent.click(clearBtn);
    
    expect((input as HTMLInputElement).value).toBe('');
    expect(screen.getByText('Gần đây')).toBeInTheDocument();
  });

  it('TC08: Chọn một session gọi cả onSelectSession và onClose', () => {
    const onSelectSession = vi.fn();
    const onClose = vi.fn();
    render(<SearchModal {...defaultProps} onSelectSession={onSelectSession} onClose={onClose} />);
    
    // Click vào session đầu tiên
    fireEvent.click(screen.getByText('Phân tích doanh thu Q1'));
    
    expect(onSelectSession).toHaveBeenCalledWith('s1');
    expect(onClose).toHaveBeenCalled();
  });

  it('TC09: Hiển thị matchedMessage khi kết quả tìm kiếm có trùng khớp nội dung', async () => {
    const searchSessions = vi.fn().mockResolvedValue(mockSearchResults);
    render(<SearchModal {...defaultProps} searchSessions={searchSessions} />);
    
    const input = screen.getByPlaceholderText('Tìm kiếm trong các cuộc trò chuyện');
    fireEvent.change(input, { target: { value: 'doanh thu' } });
    
    // Chờ debounce 300ms và async resolve
    await waitFor(() => {
      expect(screen.getByText('Trùng khớp:')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('TC10: Hiển thị ID session khi kết quả không có matchedMessage', () => {
    render(<SearchModal {...defaultProps} />);
    
    // Không gõ gì → danh sách gần đây → session_code hiển thị
    expect(screen.getByText('ID: SC001')).toBeInTheDocument();
  });

  it('TC11: Hiển thị trạng thái "không tìm thấy" khi không có kết quả khớp', async () => {
    const searchSessions = vi.fn().mockResolvedValue([]);
    render(<SearchModal {...defaultProps} searchSessions={searchSessions} />);
    
    const input = screen.getByPlaceholderText('Tìm kiếm trong các cuộc trò chuyện');
    fireEvent.change(input, { target: { value: 'xyz không tồn tại' } });
    
    await waitFor(() => {
      expect(screen.getByText(/Không tìm thấy kết quả nào cho/i)).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('TC12: Cắt ngắn matchedMessage khi dài hơn 80 ký tự', async () => {
    const longMessage = 'A'.repeat(100);
    const searchResults = [
      { id: 's1', title: 'Test', session_code: 'SC001', updatedAt: '10:00', matchedMessage: longMessage }
    ];
    const searchSessions = vi.fn().mockResolvedValue(searchResults);
    render(<SearchModal {...defaultProps} searchSessions={searchSessions} />);
    
    const input = screen.getByPlaceholderText('Tìm kiếm trong các cuộc trò chuyện');
    fireEvent.change(input, { target: { value: 'AAAA' } });
    
    await waitFor(() => {
      // Đoạn cắt ngắn sẽ có '...' ở cuối
      expect(screen.getByText(/A{80}\.\.\./)).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('TC13: Không làm gì khi gõ từ khóa nhưng không có prop searchSessions', async () => {
    // Dùng fake timer để kiểm soát debounce 300ms
    vi.useFakeTimers();
    
    render(<SearchModal {...defaultProps} searchSessions={undefined} />);
    
    const input = screen.getByPlaceholderText('Tìm kiếm trong các cuộc trò chuyện');
    fireEvent.change(input, { target: { value: 'doanh thu' } });
    
    // Chạy hết debounce 300ms → if (searchSessions) là false, không làm gì
    await act(async () => { vi.advanceTimersByTime(350); });
    
    // Danh sách sessions vẫn hiển thị, không crash
    expect(screen.getByText('Phân tích doanh thu Q1')).toBeInTheDocument();
    
    vi.useRealTimers();
  });

  it('TC14: Nhấn phím không phải Escape không gọi onClose', () => {
    const onClose = vi.fn();
    render(<SearchModal {...defaultProps} onClose={onClose} />);
    
    const input = screen.getByPlaceholderText('Tìm kiếm trong các cuộc trò chuyện');
    // Nhấn phím Enter (không phải Escape)
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(onClose).not.toHaveBeenCalled();
  });

  it('TC15: Hiển thị trạng thái loading (spinner) khi đang tìm kiếm', async () => {
    // Tạo mock trả về promise không resolve ngay (để giữ trạng thái isSearching = true)
    let resolveSearch!: (value: any[]) => void;
    const searchSessions = vi.fn().mockReturnValue(
      new Promise(resolve => { resolveSearch = resolve; })
    );
    render(<SearchModal {...defaultProps} searchSessions={searchSessions} />);
    
    const input = screen.getByPlaceholderText('Tìm kiếm trong các cuộc trò chuyện');
    fireEvent.change(input, { target: { value: 'doanh thu' } });
    
    // Chờ debounce 300ms để trigger
    await waitFor(() => {
      expect(screen.getByText('Đang tìm kiếm...')).toBeInTheDocument();
    }, { timeout: 1000 });
    
    // Resolve để tránh memory leak
    resolveSearch([]);
  });

  it('TC16: Bỏ qua kết quả trả về nếu component bị unmount trong lúc gọi API', async () => {
    vi.useFakeTimers();
    let resolveSearch!: (value: any[]) => void;
    const searchSessions = vi.fn().mockReturnValue(
      new Promise(resolve => { resolveSearch = resolve; })
    );
    const { unmount } = render(<SearchModal {...defaultProps} searchSessions={searchSessions} />);
    
    const input = screen.getByPlaceholderText('Tìm kiếm trong các cuộc trò chuyện');
    fireEvent.change(input, { target: { value: 'unmount test' } });
    
    // Chạy hết 300ms debounce
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    
    // Unmount component TRƯỚC KHI api trả về
    unmount();
    
    // Resolve api (lúc này isMounted đã là false)
    await act(async () => {
      resolveSearch([]);
    });
    
    vi.useRealTimers();
  });
});
