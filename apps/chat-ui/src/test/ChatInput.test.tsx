import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ChatInput from '../components/chat/ChatInput';

describe('Kiểm thử Component ChatInput', () => {
  it('TC01: nên hiển thị đầy đủ ô nhập liệu', () => {
    render(<ChatInput onSendMessage={vi.fn()} isLoading={false} />);

    // Kiểm tra ô input có xuất hiện không
    const inputEl = screen.getByPlaceholderText('Nhập câu hỏi...');
    expect(inputEl).toBeInTheDocument();
  });

  it('TC02: nên khóa (disable) ô nhập liệu khi trạng thái isLoading là true', () => {
    render(<ChatInput onSendMessage={vi.fn()} isLoading={true} />);

    // Ô nhập liệu phải bị disable
    const inputEl = screen.getByPlaceholderText('Nhập câu hỏi...');
    expect(inputEl).toBeDisabled();
  });

  it('TC07: nên tự động điền giá trị vào ô input khi có sự kiện window "edit-prompt"', async () => {
    render(<ChatInput onSendMessage={vi.fn()} isLoading={false} />);

    // Bắn custom event edit-prompt vào object window
    const customEvent = new CustomEvent('edit-prompt', { detail: 'Báo cáo doanh thu tháng 10' });
    act(() => {
      window.dispatchEvent(customEvent);
    });

    const inputEl = screen.getByPlaceholderText('Nhập câu hỏi...');
    expect(inputEl).toHaveValue('Báo cáo doanh thu tháng 10');

    // Chờ 50ms cho setTimeout chạy để tăng coverage lên 100%
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 60));
    });

    // Đảm bảo ô input được focus sau sự kiện edit-prompt
    expect(inputEl).toHaveFocus();
  });

  it('TC08: nên render UI ở giữa (centered) khi truyền prop isCentered = true', () => {
    const { container } = render(<ChatInput onSendMessage={vi.fn()} isLoading={false} isCentered={true} />);

    // Thẻ div ngoài cùng sẽ chứa class "bg-transparent" thay vì "bg-white/80"
    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveClass('bg-transparent');
    expect(wrapper).toHaveClass('w-full');
    expect(wrapper).not.toHaveClass('bg-white/80');
  });

  it('TC09: Tự động loại bỏ khoảng trắng thừa ở hai đầu (Trim) khi gửi', () => {
    const mockOnSendMessage = vi.fn();
    render(<ChatInput onSendMessage={mockOnSendMessage} isLoading={false} />);

    const inputEl = screen.getByPlaceholderText('Nhập câu hỏi...');

    // Nhập giá trị có khoảng trắng ở 2 đầu
    fireEvent.change(inputEl, { target: { value: '  doanh thu hôm nay   ' } });

    // Submit form
    fireEvent.submit(inputEl.closest('form')!);

    // Kiểm tra onSendMessage phải được gọi với chuỗi đã trim
    expect(mockOnSendMessage).toHaveBeenCalledWith('doanh thu hôm nay');
  });
});
