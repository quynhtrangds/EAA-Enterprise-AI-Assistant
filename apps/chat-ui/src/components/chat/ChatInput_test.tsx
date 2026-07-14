import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatInput from './ChatInput';

describe('Kiểm thử Component ChatInput', () => {

  it('nên hiển thị đầy đủ ô nhập và 5 nút gợi ý Quick Prompts', () => {
    render(<ChatInput onSendMessage={vi.fn()} isLoading={false} />);

    // Kiểm tra ô input có xuất hiện không
    const inputEl = screen.getByPlaceholderText('Nhập yêu cầu truy vấn dữ liệu...');
    expect(inputEl).toBeInTheDocument();

    // Kiểm tra xem các nút Quick Prompts có xuất hiện đủ không
    expect(screen.getByText(/Doanh thu hôm nay/)).toBeInTheDocument();
    expect(screen.getByText(/Top 5 khách hàng/)).toBeInTheDocument();
    expect(screen.getByText(/Sản phẩm nào đang bán chạy/)).toBeInTheDocument();
  });

  it('nên kích hoạt onSendMessage khi người dùng click vào nút gợi ý nhanh', () => {
    // Tạo hàm giả lập (Mock Function) để theo dõi sự kiện
    const mockOnSendMessage = vi.fn();
    render(<ChatInput onSendMessage={mockOnSendMessage} isLoading={false} />);

    // Tìm nút "Doanh thu hôm nay" và giả lập hành vi click chuột
    const quickPromptBtn = screen.getByText(/Doanh thu hôm nay/);
    fireEvent.click(quickPromptBtn);

    // Xác nhận xem hàm gửi tin nhắn có được gọi đúng nội dung không
    expect(mockOnSendMessage).toHaveBeenCalledTimes(1);
    expect(mockOnSendMessage).toHaveBeenCalledWith('Doanh thu hôm nay bao nhiêu?');
  });

  it('nên khóa (disable) toàn bộ tương tác khi trạng thái isLoading là true', () => {
    render(<ChatInput onSendMessage={vi.fn()} isLoading={true} />);

    // Ô nhập liệu phải bị disable
    const inputEl = screen.getByPlaceholderText('Nhập yêu cầu truy vấn dữ liệu...');
    expect(inputEl).toBeDisabled();

    // Các nút gợi ý nhanh cũng phải bị disable để tránh spam click
    const quickPromptBtn = screen.getByText(/Doanh thu hôm nay/);
    expect(quickPromptBtn).toBeDisabled();
  });
});