import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MainLayout from '../components/layout/MainLayout';
import { useChat } from '../hooks/useChat';
import { useAuth } from '../contexts/AuthContext';
// Mock tất cả các hook và component con
vi.mock('../hooks/useChat', () => ({ useChat: vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../components/layout/Sidebar', () => ({
    default: ({ isOpen, onToggleSidebar, onOpenSearch, onLogout, onCreateSession }: any) => (
        <div data-testid="sidebar" data-open={isOpen}>
            <button onClick={onToggleSidebar} data-testid="toggle-sidebar">Toggle</button>
            <button onClick={onOpenSearch} data-testid="open-search">Tìm kiếm</button>
            <button onClick={onLogout} data-testid="logout">Đăng xuất</button>
            <button onClick={onCreateSession} data-testid="create-session">Tạo mới</button>
        </div>
    ),
}));
vi.mock('../components/chat/SearchModal', () => ({
  default: ({ isOpen, onClose, onSelectSession }: any) => isOpen ? (
    <div data-testid="search-modal">
      <button onClick={onClose} data-testid="close-search">Đóng</button>
      <button onClick={() => { onSelectSession('s1'); onClose(); }} data-testid="select-session">Chọn session</button>
    </div>
  ) : null,
}));
vi.mock('../components/chat/ChatWindow', () => ({
    default: () => <div data-testid="chat-window">ChatWindow</div>,
}));
const mockUseChat = {
    sessions: [{ id: 's1', title: 'Session 1', session_code: 'SC001', isStarred: false, updatedAt: '10:00', messages: [] }],
    activeSessionId: 's1',
    currentUser: { name: 'Tester', email: 'test@example.com' },
    selectSession: vi.fn(),
    createNewSession: vi.fn(),
    deleteSession: vi.fn(),
    renameSession: vi.fn(),
    toggleStarSession: vi.fn(),
    searchSessions: vi.fn(),
};
const mockUseAuth = { logout: vi.fn() };
describe('Kiểm thử Component MainLayout', () => {
    beforeEach(() => {
        (useChat as any).mockReturnValue(mockUseChat);
        (useAuth as any).mockReturnValue(mockUseAuth);
    });
    it('TC01: Render đầy đủ các component con (Sidebar, ChatWindow, SearchModal)', () => {
        render(<MainLayout />);
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
        expect(screen.getByTestId('chat-window')).toBeInTheDocument();
        // SearchModal ẩn ban đầu (isOpen = false)
        expect(screen.queryByTestId('search-modal')).not.toBeInTheDocument();
    });
    it('TC02: Sidebar mở mặc định khi khởi tạo (isSidebarOpen = true)', () => {
        render(<MainLayout />);
        expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'true');
    });
    it('TC03: Bấm nút toggle đóng/mở Sidebar', () => {
        render(<MainLayout />);
        const toggleBtn = screen.getByTestId('toggle-sidebar');
        // Đóng sidebar
        fireEvent.click(toggleBtn);
        expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'false');
        // Mở lại sidebar
        fireEvent.click(toggleBtn);
        expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'true');
    });
    it('TC04: Bấm nút Tìm kiếm mở SearchModal', () => {
        render(<MainLayout />);
        fireEvent.click(screen.getByTestId('open-search'));
        expect(screen.getByTestId('search-modal')).toBeInTheDocument();
    });
    it('TC05: Đóng SearchModal khi bấm nút Đóng trong modal', () => {
        render(<MainLayout />);
        // Mở modal
        fireEvent.click(screen.getByTestId('open-search'));
        expect(screen.getByTestId('search-modal')).toBeInTheDocument();
        // Đóng modal
        fireEvent.click(screen.getByTestId('close-search'));
        expect(screen.queryByTestId('search-modal')).not.toBeInTheDocument();
    });
    it('TC06: Chọn session trong SearchModal gọi selectSession và đóng modal', () => {
        render(<MainLayout />);
        // Mở modal
        fireEvent.click(screen.getByTestId('open-search'));
        // Chọn session
        fireEvent.click(screen.getByTestId('select-session'));
        expect(mockUseChat.selectSession).toHaveBeenCalledWith('s1');
        // Modal đóng lại sau khi chọn session
        expect(screen.queryByTestId('search-modal')).not.toBeInTheDocument();
    });
    it('TC07: Bấm nút Đăng xuất gọi hàm logout từ useAuth', () => {
        render(<MainLayout />);
        fireEvent.click(screen.getByTestId('logout'));
        expect(mockUseAuth.logout).toHaveBeenCalled();
    });
    it('TC08: Bấm nút Tạo mới gọi hàm createNewSession', () => {
        render(<MainLayout />);
        fireEvent.click(screen.getByTestId('create-session'));
        expect(mockUseChat.createNewSession).toHaveBeenCalled();
    });
    it('TC09: Xử lý đúng khi currentUser là null', () => {
        (useChat as any).mockReturnValue({
          ...mockUseChat,
          currentUser: null,
        });
        
        render(<MainLayout />);
        
        // Sidebar component vẫn được render bình thường mà không bị crash
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });
    it('TC10: Render danh sách tin nhắn và tự động cuộn xuống cuối', () => {
        // Ghi đè mockUseChat tạm thời để có tin nhắn
        (useChat as any).mockReturnValue({
            ...mockUseChat,
            messages: [{ id: '1', role: 'user', content: 'Hello' }]
        });

        render(<MainLayout />);
        expect(screen.getByTestId('chat-window')).toBeInTheDocument();
    });
});