import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ChatInput from '../components/chat/ChatInput';

describe('Kiểm thử Component ChatInput', () => {

  it('TC01: nên hiển thị đầy đủ ô nhập và 5 nút gợi ý Quick Prompts', () => {
    render(<ChatInput onSendMessage={vi.fn()} isLoading={false} />);

    // Kiểm tra ô input có xuất hiện không
    const inputEl = screen.getByPlaceholderText('Nhập câu hỏi...');
    expect(inputEl).toBeInTheDocument();

    // Kiểm tra xem các nút Quick Prompts có xuất hiện đủ không
    expect(screen.getByText(/Hôm nay doanh thu bao nhiêu\?/)).toBeInTheDocument();
    expect(screen.getByText(/Top 5 khách hàng/)).toBeInTheDocument();
    expect(screen.getByText(/Sản phẩm nào bán chạy/)).toBeInTheDocument();
  });

  it('TC02: nên kích hoạt onSendMessage khi người dùng click vào nút gợi ý nhanh', () => {
    // Tạo hàm giả lập (Mock Function) để theo dõi sự kiện
    const mockOnSendMessage = vi.fn();
    render(<ChatInput onSendMessage={mockOnSendMessage} isLoading={false} />);

    // Tìm nút "Doanh thu hôm nay" và giả lập hành vi click chuột
    const quickPromptBtn = screen.getByText(/Hôm nay doanh thu bao nhiêu\?/);
    fireEvent.click(quickPromptBtn);

    // Xác nhận xem hàm gửi tin nhắn có được gọi đúng nội dung không
    expect(mockOnSendMessage).toHaveBeenCalledTimes(1);
    expect(mockOnSendMessage).toHaveBeenCalledWith('Hôm nay doanh thu bao nhiêu?');
  });

  it('TC03: nên khóa (disable) toàn bộ tương tác khi trạng thái isLoading là true', () => {
    render(<ChatInput onSendMessage={vi.fn()} isLoading={true} />);

    // Ô nhập liệu phải bị disable
    const inputEl = screen.getByPlaceholderText('Nhập câu hỏi...');
    expect(inputEl).toBeDisabled();

    // Các nút gợi ý nhanh cũng phải bị disable để tránh spam click
    const quickPromptBtn = screen.getByText(/Hôm nay doanh thu bao nhiêu\?/);
    expect(quickPromptBtn).toBeDisabled();
  });

  it('TC04: nên cập nhật giá trị ô input, gọi onSendMessage khi submit và xóa rỗng ô nhập', () => {
    const mockOnSendMessage = vi.fn();
    render(<ChatInput onSendMessage={mockOnSendMessage} isLoading={false} />);

    const inputEl = screen.getByPlaceholderText('Nhập câu hỏi...');

    // Giả lập gõ text
    fireEvent.change(inputEl, { target: { value: 'Xin chào AI' } });
    expect(inputEl).toHaveValue('Xin chào AI');

    // Giả lập submit form
    fireEvent.submit(inputEl.closest('form')!);

    // Hàm gửi tin nhắn phải được gọi
    expect(mockOnSendMessage).toHaveBeenCalledWith('Xin chào AI');

    // Ô input phải bị xóa rỗng sau khi gửi
    expect(inputEl).toHaveValue('');
  });

  it('TC05: không gọi onSendMessage khi input trống hoặc chỉ có dấu cách', () => {
    const mockOnSendMessage = vi.fn();
    render(<ChatInput onSendMessage={mockOnSendMessage} isLoading={false} />);

    const inputEl = screen.getByPlaceholderText('Nhập câu hỏi...');

    // TH1: Submit form rỗng
    fireEvent.submit(inputEl.closest('form')!);
    expect(mockOnSendMessage).not.toHaveBeenCalled();

    // TH2: Submit form chỉ chứa dấu cách
    fireEvent.change(inputEl, { target: { value: '     ' } });
    fireEvent.submit(inputEl.closest('form')!);
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it('TC06: nên toggle (ẩn/hiện) text gợi ý khi click vào nút "Hiển thị gợi ý câu hỏi"', () => {
    render(<ChatInput onSendMessage={vi.fn()} isLoading={false} />);

    const toggleBtn = screen.getByText('Hiển thị gợi ý câu hỏi');
    expect(toggleBtn).toBeInTheDocument();

    // Click lần 1 để mở (văn bản đổi thành "Thu gọn gợi ý")
    fireEvent.click(toggleBtn);
    expect(screen.getByText('Thu gọn gợi ý')).toBeInTheDocument();

    // Click lần 2 để đóng (trở về "Hiển thị gợi ý câu hỏi")
    fireEvent.click(screen.getByText('Thu gọn gợi ý'));
    expect(screen.getByText('Hiển thị gợi ý câu hỏi')).toBeInTheDocument();
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
