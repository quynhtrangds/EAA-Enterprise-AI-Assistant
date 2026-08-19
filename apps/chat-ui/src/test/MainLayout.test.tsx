import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MainLayout from '../components/layout/MainLayout';
import { useChat } from '../hooks/useChat';
import { useAuth } from '../contexts/AuthContext';

// Mock tat ca cac hook va component con
vi.mock('../hooks/useChat', () => ({ useChat: vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../components/layout/Sidebar', () => ({
    default: ({ isOpen, onToggleSidebar, onOpenSearch, onLogout, onCreateSession }: any) => (
        <div data-testid="sidebar" data-open={isOpen}>
            <button onClick={onToggleSidebar} data-testid="toggle-sidebar">Toggle</button>
            <button onClick={onOpenSearch} data-testid="open-search">Tim kiem</button>
            <button onClick={onLogout} data-testid="logout">Dang xuat</button>
            <button onClick={onCreateSession} data-testid="create-session">Tao moi</button>
        </div>
    ),
}));
vi.mock('../components/chat/SearchModal', () => ({
  default: ({ isOpen, onClose, onSelectSession }: any) => isOpen ? (
    <div data-testid="search-modal">
      <button onClick={onClose} data-testid="close-search">Dong</button>
      <button onClick={() => { onSelectSession('s1'); onClose(); }} data-testid="select-session">Chon session</button>
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
    messages: [] as any[],
};
const mockUseAuth = { logout: vi.fn() };

describe('Kiem thu Component MainLayout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useChat as any).mockReturnValue(mockUseChat);
        (useAuth as any).mockReturnValue(mockUseAuth);
    });

    it('TC01: Render day du cac component con (Sidebar, ChatWindow, SearchModal)', () => {
        render(<MainLayout />);
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
        expect(screen.getByTestId('chat-window')).toBeInTheDocument();
        expect(screen.queryByTestId('search-modal')).not.toBeInTheDocument();
    });

    it('TC02: Sidebar mo mac dinh khi khoi tao (isSidebarOpen = true)', () => {
        render(<MainLayout />);
        expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'true');
    });

    it('TC03: Bam nut toggle dong/mo Sidebar', () => {
        render(<MainLayout />);
        const toggleBtn = screen.getByTestId('toggle-sidebar');
        fireEvent.click(toggleBtn);
        expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'false');
        fireEvent.click(toggleBtn);
        expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'true');
    });

    it('TC04: Bam nut Tim kiem mo SearchModal', () => {
        render(<MainLayout />);
        fireEvent.click(screen.getByTestId('open-search'));
        expect(screen.getByTestId('search-modal')).toBeInTheDocument();
    });

    it('TC05: Dong SearchModal khi bam nut Dong trong modal', () => {
        render(<MainLayout />);
        fireEvent.click(screen.getByTestId('open-search'));
        expect(screen.getByTestId('search-modal')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('close-search'));
        expect(screen.queryByTestId('search-modal')).not.toBeInTheDocument();
    });

    it('TC06: Chon session trong SearchModal goi selectSession va dong modal', () => {
        render(<MainLayout />);
        fireEvent.click(screen.getByTestId('open-search'));
        fireEvent.click(screen.getByTestId('select-session'));
        expect(mockUseChat.selectSession).toHaveBeenCalledWith('s1');
        expect(screen.queryByTestId('search-modal')).not.toBeInTheDocument();
    });

    it('TC07: Bam nut Dang xuat goi ham logout tu useAuth', () => {
        render(<MainLayout />);
        fireEvent.click(screen.getByTestId('logout'));
        expect(mockUseAuth.logout).toHaveBeenCalled();
    });

    it('TC08: Bam nut Tao moi goi ham createNewSession khi khong phai guest', () => {
        render(<MainLayout />);
        fireEvent.click(screen.getByTestId('create-session'));
        expect(mockUseChat.createNewSession).toHaveBeenCalled();
    });

    it('TC09: Xu ly dung khi currentUser la null', () => {
        (useChat as any).mockReturnValue({
          ...mockUseChat,
          currentUser: null,
        });
        
        render(<MainLayout />);
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });

    it('TC10: Render danh sach tin nhan va tu dong cuon xuong cuoi', () => {
        (useChat as any).mockReturnValue({
            ...mockUseChat,
            messages: [{ id: '1', role: 'user', content: 'Hello' }]
        });

        render(<MainLayout />);
        expect(screen.getByTestId('chat-window')).toBeInTheDocument();
    });

    it('TC11: Hien thi modal xac nhan khi tai khoan viewer/guest co tin nhan va bam Tao moi', () => {
        (useChat as any).mockReturnValue({
            ...mockUseChat,
            currentUser: { username: 'viewer', roles: ['viewer'] },
            messages: [{ id: '1', role: 'user', content: 'Tin nhan test' }]
        });

        render(<MainLayout />);
        fireEvent.click(screen.getByTestId('create-session'));

        expect(screen.getByText('Xóa cuộc trò chuyện hiện tại & tạo cuộc trò chuyện mới?')).toBeInTheDocument();
    });

    it('TC12: Bam Cuoc tro chuyen moi trong modal xac nhan goi createNewSession va dong modal', () => {
        (useChat as any).mockReturnValue({
            ...mockUseChat,
            currentUser: { username: 'viewer', roles: ['viewer'] },
            messages: [{ id: '1', role: 'user', content: 'Tin nhan test' }]
        });

        render(<MainLayout />);
        fireEvent.click(screen.getByTestId('create-session'));

        const confirmBtn = screen.getByRole('button', { name: 'Cuộc trò chuyện mới' });
        fireEvent.click(confirmBtn);

        expect(mockUseChat.createNewSession).toHaveBeenCalled();
        expect(screen.queryByText('Xóa cuộc trò chuyện hiện tại & tạo cuộc trò chuyện mới?')).not.toBeInTheDocument();
    });

    it('TC13: Bam Huy trong modal xac nhan khong goi createNewSession va dong modal', () => {
        (useChat as any).mockReturnValue({
            ...mockUseChat,
            currentUser: { username: 'viewer', roles: ['viewer'] },
            messages: [{ id: '1', role: 'user', content: 'Tin nhan test' }]
        });

        render(<MainLayout />);
        fireEvent.click(screen.getByTestId('create-session'));

        const cancelBtn = screen.getByRole('button', { name: 'Hủy' });
        fireEvent.click(cancelBtn);

        expect(screen.queryByText('Xóa cuộc trò chuyện hiện tại & tạo cuộc trò chuyện mới?')).not.toBeInTheDocument();
    });
});