import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../components/layout/Sidebar';
import type { Session } from '../hooks/useChat';

const mockSessions: Session[] = [
  { id: 's1', title: 'Session 1', session_code: 'SC001', isStarred: true, updatedAt: '10:00', messages: [] },
  { id: 's2', title: 'Session 2', session_code: 'SC002', isStarred: false, updatedAt: '10:05', messages: [] },
];

const defaultProps = {
  isOpen: true,
  sessions: mockSessions,
  activeSessionId: 's1',
  currentUser: 'admin',
  onSelectSession: vi.fn(),
  onCreateSession: vi.fn(),
  onDeleteSession: vi.fn(),
  onToggleSidebar: vi.fn(),
  onLogout: vi.fn(),
  onRenameSession: vi.fn(),
  onToggleStarSession: vi.fn(),
  onOpenSearch: vi.fn(),
};

describe('Kiểm thử Component Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC01: Render đúng giao diện ban đầu (mở, có session đã ghim và lịch sử)', () => {
    render(<Sidebar {...defaultProps} />);
    
    // Header
    expect(screen.getByText('Enterprise UI')).toBeInTheDocument();
    
    // Quick actions
    expect(screen.getByText('Cuộc trò chuyện mới')).toBeInTheDocument();
    expect(screen.getByText('Tìm kiếm trong các cuộc trò chuyện')).toBeInTheDocument();
    
    // Sessions
    expect(screen.getByText('Đã ghim')).toBeInTheDocument();
    expect(screen.getByText('Session 1')).toBeInTheDocument();
    expect(screen.getByText('LỊCH SỬ HỘI THOẠI')).toBeInTheDocument();
    expect(screen.getByText('Session 2')).toBeInTheDocument();
    
    // Profile
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('TC02: Gọi onToggleSidebar khi bấm nút thu gọn/mở rộng', () => {
    const { rerender } = render(<Sidebar {...defaultProps} />);
    
    // Nút toggle ở header (mũi tên <-)
    const toggleBtn = screen.getByTitle('Thu gọn Sidebar');
    fireEvent.click(toggleBtn);
    expect(defaultProps.onToggleSidebar).toHaveBeenCalledTimes(1);
    
    // Nút toggle ở logo khi sidebar đóng
    rerender(<Sidebar {...defaultProps} isOpen={false} />);
    const logoArea = screen.getByText('Enterprise UI').closest('div')?.parentElement;
    fireEvent.click(logoArea!);
    expect(defaultProps.onToggleSidebar).toHaveBeenCalledTimes(2);
  });

  it('TC03: Gọi onCreateSession khi bấm Tạo mới', () => {
    render(<Sidebar {...defaultProps} />);
    
    const btn = screen.getByText('Cuộc trò chuyện mới').closest('button');
    fireEvent.click(btn!);
    expect(defaultProps.onCreateSession).toHaveBeenCalled();
  });

  it('TC04: Gọi onOpenSearch khi bấm Tìm kiếm', () => {
    render(<Sidebar {...defaultProps} />);
    
    const btn = screen.getByText('Tìm kiếm trong các cuộc trò chuyện').closest('button');
    fireEvent.click(btn!);
    expect(defaultProps.onOpenSearch).toHaveBeenCalled();
  });

  it('TC05: Gọi onSelectSession khi click vào session', () => {
    render(<Sidebar {...defaultProps} />);
    
    const sessionBtn = screen.getByText('Session 2').closest('button');
    fireEvent.click(sessionBtn!);
    expect(defaultProps.onSelectSession).toHaveBeenCalledWith('s2');
  });

  it('TC06: Mở và đóng menu 3 chấm của session', () => {
    const { container } = render(<Sidebar {...defaultProps} />);
    
    // Menu ban đầu không có
    expect(screen.queryByText('Đổi tên')).not.toBeInTheDocument();
    
    // Tìm nút 3 chấm của Session 1. Nút này render dạng button chứa svg có class absolute right-2
    const dotBtn = container.querySelectorAll('.absolute.right-2.p-1\\.5')[0] as HTMLElement;
    
    // Bấm mở menu
    fireEvent.click(dotBtn);
    expect(screen.getByText('Đổi tên')).toBeInTheDocument();
    
    // Bấm lần nữa đóng menu
    fireEvent.click(dotBtn);
    expect(screen.queryByText('Đổi tên')).not.toBeInTheDocument();
  });

  it('TC07: Gọi onToggleStarSession khi chọn Ghim/Bỏ ghim', () => {
    const { container } = render(<Sidebar {...defaultProps} />);
    
    // Mở menu Session 1 (đã ghim)
    const dotBtn1 = container.querySelectorAll('.absolute.right-2.p-1\\.5')[0] as HTMLElement;
    fireEvent.click(dotBtn1);
    
    const unstarBtn = screen.getByText('Bỏ ghim');
    fireEvent.click(unstarBtn);
    expect(defaultProps.onToggleStarSession).toHaveBeenCalledWith('s1', false);
    
    // Mở menu Session 2 (chưa ghim)
    const dotBtn2 = container.querySelectorAll('.absolute.right-2.p-1\\.5')[1] as HTMLElement;
    fireEvent.click(dotBtn2);
    
    const starBtn = screen.getByText('Ghim');
    fireEvent.click(starBtn);
    expect(defaultProps.onToggleStarSession).toHaveBeenCalledWith('s2', true);
  });

  it('TC08: Chỉnh sửa tên session và lưu thành công (Enter & Blur)', () => {
    const { container } = render(<Sidebar {...defaultProps} />);
    
    // Mở menu Session 1
    const dotBtn = container.querySelectorAll('.absolute.right-2.p-1\\.5')[0] as HTMLElement;
    fireEvent.click(dotBtn);
    
    // Chọn đổi tên
    fireEvent.click(screen.getByText('Đổi tên'));
    
    // Input xuất hiện
    const input = screen.getByDisplayValue('Session 1');
    expect(input).toBeInTheDocument();
    
    // Đổi value
    fireEvent.change(input, { target: { value: 'New Session 1' } });
    
    // Nhấn Enter
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(defaultProps.onRenameSession).toHaveBeenCalledWith('s1', 'New Session 1');
  });

  it('TC08b: Chỉnh sửa tên session và lưu thành công (Blur)', () => {
    const { container } = render(<Sidebar {...defaultProps} />);
    
    const dotBtn = container.querySelectorAll('.absolute.right-2.p-1\\.5')[0] as HTMLElement;
    fireEvent.click(dotBtn);
    fireEvent.click(screen.getByText('Đổi tên'));
    
    const input = screen.getByDisplayValue('Session 1');
    fireEvent.change(input, { target: { value: 'Another' } });
    fireEvent.blur(input);
    expect(defaultProps.onRenameSession).toHaveBeenCalledWith('s1', 'Another');
  });

  it('TC09: Hủy bỏ chỉnh sửa khi nhấn Escape', () => {
    const { container } = render(<Sidebar {...defaultProps} />);
    
    const dotBtn = container.querySelectorAll('.absolute.right-2.p-1\\.5')[0] as HTMLElement;
    fireEvent.click(dotBtn);
    fireEvent.click(screen.getByText('Đổi tên'));
    
    const input = screen.getByDisplayValue('Session 1');
    fireEvent.keyDown(input, { key: 'Escape' });
    
    // Input biến mất, tiêu đề session quay lại ban đầu
    expect(screen.queryByDisplayValue('Session 1')).not.toBeInTheDocument();
    expect(screen.getByText('Session 1')).toBeInTheDocument();
  });

  it('TC10: Gọi onDeleteSession khi click Xóa', () => {
    const { container } = render(<Sidebar {...defaultProps} />);
    
    const dotBtn = container.querySelectorAll('.absolute.right-2.p-1\\.5')[0] as HTMLElement;
    fireEvent.click(dotBtn);
    
    const deleteBtn = screen.getByText('Xóa');
    fireEvent.click(deleteBtn);
    expect(defaultProps.onDeleteSession).toHaveBeenCalledWith('s1');
  });

  it('TC11: Ẩn nút xóa nếu chỉ còn 1 session', () => {
    const { container } = render(<Sidebar {...defaultProps} sessions={[mockSessions[0]]} />);
    
    const dotBtn = container.querySelectorAll('.absolute.right-2.p-1\\.5')[0] as HTMLElement;
    fireEvent.click(dotBtn);
    
    expect(screen.queryByText('Xóa')).not.toBeInTheDocument();
  });

  it('TC12: Mở menu profile và gọi onLogout', () => {
    render(<Sidebar {...defaultProps} />);
    
    expect(screen.queryByText('Đăng xuất')).not.toBeInTheDocument();
    
    // Bấm vào profile
    const profileBtn = screen.getByTitle('Tài khoản');
    fireEvent.click(profileBtn);
    
    const logoutBtn = screen.getByText('Đăng xuất');
    expect(logoutBtn).toBeInTheDocument();
    
    fireEvent.click(logoutBtn);
    expect(defaultProps.onLogout).toHaveBeenCalled();
  });

  it('TC13: Click ra ngoài (click outside) để đóng các menu', () => {
    const { container } = render(<Sidebar {...defaultProps} />);
    
    // Mở menu session
    const dotBtn = container.querySelectorAll('.absolute.right-2.p-1\\.5')[0] as HTMLElement;
    fireEvent.click(dotBtn);
    expect(screen.getByText('Đổi tên')).toBeInTheDocument();
    
    // Mở menu profile
    const profileBtn = screen.getByTitle('Tài khoản');
    fireEvent.click(profileBtn);
    expect(screen.getByText('Đăng xuất')).toBeInTheDocument();
    
    // Click ra ngoài body
    fireEvent.mouseDown(document.body);
    
    expect(screen.queryByText('Đổi tên')).not.toBeInTheDocument();
    expect(screen.queryByText('Đăng xuất')).not.toBeInTheDocument();
  });

  it('TC14: Role mặc định nếu currentUser không khớp', () => {
    render(<Sidebar {...defaultProps} currentUser="unknown" />);
    // Role admin là fallback đầu tiên
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('TC15: Không gọi rename nếu tiêu đề trống hoặc onRenameSession không được truyền', () => {
    const { container } = render(<Sidebar {...defaultProps} onRenameSession={undefined} />);
    const dotBtn = container.querySelectorAll('.absolute.right-2.p-1\\.5')[0] as HTMLElement;
    fireEvent.click(dotBtn);
    fireEvent.click(screen.getByText('Đổi tên'));
    
    const input = screen.getByDisplayValue('Session 1');
    fireEvent.change(input, { target: { value: '   ' } }); // empty
    fireEvent.blur(input); // shouldn't crash
    expect(defaultProps.onRenameSession).not.toHaveBeenCalled(); // empty so shouldn't be called anyway
  });

  it('TC16: Click mousedown vào bên trong menu thì không đóng menu', () => {
    const { container } = render(<Sidebar {...defaultProps} />);
    const dotBtn = container.querySelectorAll('.absolute.right-2.p-1\\.5')[0] as HTMLElement;
    fireEvent.click(dotBtn);
    
    // Mousedown inside menu
    const renameBtn = screen.getByText('Đổi tên');
    fireEvent.mouseDown(renameBtn);
    
    // Menu still open
    expect(screen.getByText('Đổi tên')).toBeInTheDocument();
    
    // Profile menu mousedown inside
    const profileBtn = screen.getByTitle('Tài khoản');
    fireEvent.click(profileBtn);
    const logoutBtn = screen.getByText('Đăng xuất');
    fireEvent.mouseDown(logoutBtn);
    
    expect(screen.getByText('Đăng xuất')).toBeInTheDocument();
  });

  it('TC17: Mở profile menu khi sidebar đang đóng (isOpen = false)', () => {
    render(<Sidebar {...defaultProps} isOpen={false} />);
    const profileBtn = screen.getByTitle('Tài khoản');
    fireEvent.click(profileBtn);
    
    // Test branch isOpen ? ... : 'left-2 w-48'
    const logoutBtn = screen.getByText('Đăng xuất');
    expect(logoutBtn).toBeInTheDocument();
  });

  it('TC18: Click on logo starts new session under different conditions', () => {
    const { rerender } = render(<Sidebar {...defaultProps} activeSessionId="s1" isOpen={true} />);
    const logoArea = screen.getByText('Enterprise UI').closest('div')?.parentElement;
    expect(logoArea).toBeInTheDocument();

    // 1. Sidebar open, activeSessionId !== 'new-chat-session'
    fireEvent.click(logoArea!);
    expect(defaultProps.onCreateSession).toHaveBeenCalledTimes(1);
    expect(defaultProps.onToggleSidebar).not.toHaveBeenCalled();

    // 2. Sidebar open, activeSessionId === 'new-chat-session'
    vi.clearAllMocks();
    rerender(<Sidebar {...defaultProps} activeSessionId="new-chat-session" isOpen={true} />);
    fireEvent.click(logoArea!);
    expect(defaultProps.onCreateSession).not.toHaveBeenCalled();

    // 3. Sidebar closed, activeSessionId !== 'new-chat-session'
    vi.clearAllMocks();
    rerender(<Sidebar {...defaultProps} activeSessionId="s1" isOpen={false} />);
    const logoAreaClosed = screen.getByText('Enterprise UI').closest('div')?.parentElement;
    fireEvent.click(logoAreaClosed!);
    expect(defaultProps.onToggleSidebar).toHaveBeenCalledTimes(1);
    expect(defaultProps.onCreateSession).toHaveBeenCalledTimes(1);
  });
});

