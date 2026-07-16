import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ToolTrace from '../components/chat/ToolTrace';

const mockToolSuccess = {
  toolName: 'query_database',
  arguments: { table: 'users', limit: 5 },
  success: true,
  durationMs: 120,
};

const mockToolFailed = {
  toolName: 'read_file',
  arguments: { path: '/secret.txt' },
  success: false,
  durationMs: 50,
};

describe('Kiểm thử Component ToolTrace', () => {

  it('TC01: Render header với tên tool và duration, nội dung chi tiết bị ẩn ban đầu', () => {
    render(<ToolTrace tool={mockToolSuccess} />);

    expect(screen.getByText('query_database')).toBeInTheDocument();
    expect(screen.getByText(/120/)).toBeInTheDocument();

    // Nội dung chi tiết phải bị ẩn trước khi click
    expect(screen.queryByText('Input:')).not.toBeInTheDocument();
  });

  it('TC02: Click vào header để mở rộng chi tiết', () => {
    render(<ToolTrace tool={mockToolSuccess} />);

    fireEvent.click(screen.getByText('query_database').closest('button')!);

    // Sau khi click: nội dung JSON và status xuất hiện
    expect(screen.getByText('Input:')).toBeInTheDocument();
    expect(screen.getByText(/"table": "users"/i)).toBeInTheDocument();
    expect(screen.getByText('success')).toBeInTheDocument();
    expect(screen.getByText('Duration:')).toBeInTheDocument();
  });

  it('TC03: Click lần 2 vào header để thu gọn lại', () => {
    render(<ToolTrace tool={mockToolSuccess} />);

    const headerBtn = screen.getByText('query_database').closest('button')!;

    // Mở rộng
    fireEvent.click(headerBtn);
    expect(screen.getByText('Input:')).toBeInTheDocument();

    // Thu gọn lại
    fireEvent.click(headerBtn);
    expect(screen.queryByText('Input:')).not.toBeInTheDocument();
  });

  it('TC04: Hiển thị trạng thái "failed" với màu đỏ khi tool thất bại', () => {
    render(<ToolTrace tool={mockToolFailed} />);

    // Mở rộng chi tiết
    fireEvent.click(screen.getByText('read_file').closest('button')!);

    expect(screen.getByText('failed')).toBeInTheDocument();
    // 50ms xuất hiện ở header chip và trong vùng Duration
    expect(screen.getAllByText(/50/).length).toBeGreaterThanOrEqual(1);
  });

  it('TC05: Badge duration có màu xanh khi tool thành công', () => {
    const { container } = render(<ToolTrace tool={mockToolSuccess} />);

    // Badge duration dùng emerald cho success
    const badge = container.querySelector('.bg-emerald-500\\/15.text-emerald-400');
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent).toContain('120');
  });

  it('TC06: Badge duration có màu đỏ khi tool thất bại', () => {
    const { container } = render(<ToolTrace tool={mockToolFailed} />);

    // Badge duration dùng rose cho failed
    const badge = container.querySelector('.bg-rose-500\\/15.text-rose-400');
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent).toContain('50');
  });

  it('TC07: Hiển thị đúng duration trong vùng chi tiết sau khi mở rộng', () => {
    render(<ToolTrace tool={mockToolSuccess} />);

    fireEvent.click(screen.getByText('query_database').closest('button')!);

    // Vùng chi tiết phải hiển thị "Duration:" và "120ms"
    const durationRow = screen.getByText('Duration:').closest('p');
    expect(durationRow?.textContent).toContain('120ms');
  });

  it('TC08: Render đúng JSON arguments với nhiều trường dữ liệu', () => {
    const complexTool = {
      toolName: 'send_email',
      arguments: { to: 'admin@company.com', subject: 'Report', body: 'Hello' },
      success: true,
      durationMs: 200,
    };
    render(<ToolTrace tool={complexTool} />);

    fireEvent.click(screen.getByText('send_email').closest('button')!);

    // JSON phải được format đúng với indent
    expect(screen.getByText(/"to": "admin@company\.com"/i)).toBeInTheDocument();
    expect(screen.getByText(/"subject": "Report"/i)).toBeInTheDocument();
  });

  it('TC09: Hiển thị đúng tên tool trên header', () => {
    const customTool = { toolName: 'get_weather', arguments: {}, success: true, durationMs: 30 };
    render(<ToolTrace tool={customTool} />);

    expect(screen.getByText('get_weather')).toBeInTheDocument();
    // Tên tool không được lẫn lộn với tên tool khác
    expect(screen.queryByText(/query_database/i)).not.toBeInTheDocument();
  });
});

