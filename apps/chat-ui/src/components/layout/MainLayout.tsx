import React, { useState } from 'react';
import Sidebar from './Sidebar';
import SearchModal from '../chat/SearchModal';
import ChatWindow from '../chat/ChatWindow';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../contexts/AuthContext';

const MainLayout: React.FC = () => {
  const { logout } = useAuth();
  const {
    sessions,
    activeSessionId,
    currentUser,
    selectSession,
    createNewSession,
    deleteSession,
    renameSession,
    toggleStarSession,
    searchSessions,
    messages,
    isLoading,
    sendMessage,
    editMessage
  } = useChat();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isGuestConfirmModalOpen, setIsGuestConfirmModalOpen] = useState(false);

  const userRoles = currentUser?.roles || (currentUser?.role ? [currentUser.role] : []);
  const isGuest =
    currentUser?.username === 'guest' ||
    currentUser?.username === 'viewer' ||
    currentUser?.role === 'viewer' ||
    userRoles.includes('viewer');

  const handleCreateSessionRequest = () => {
    if (isGuest && messages.length > 0) {
      setIsGuestConfirmModalOpen(true);
    } else {
      createNewSession();
    }
  };

  return (
    <div className="flex h-screen bg-ink font-sans overflow-hidden text-ink-1">
      {/* Container của Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        sessions={sessions}
        activeSessionId={activeSessionId}
        currentUser={currentUser ?? undefined}
        onSelectSession={selectSession}
        onCreateSession={handleCreateSessionRequest}
        onDeleteSession={deleteSession}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onLogout={logout}
        onRenameSession={renameSession}
        onToggleStarSession={toggleStarSession}
        onOpenSearch={() => setIsSearchModalOpen(true)}
      />

      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        sessions={sessions}
        searchSessions={searchSessions}
        onSelectSession={(id) => {
          selectSession(id);
          setIsSearchModalOpen(false);
        }}
      />

      {/* Guest New Chat Confirmation Modal */}
      {isGuestConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-hair rounded-lg p-7 max-w-md w-full animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-xl font-semibold text-ink-1 mb-3">
              Xóa cuộc trò chuyện hiện tại & tạo cuộc trò chuyện mới?
            </h3>
            <p className="text-[14.5px] text-ink-2 leading-relaxed mb-8">
              Khi bạn bắt đầu cuộc trò chuyện mới, cuộc trò chuyện hiện tại sẽ không được lưu.{' '}
              <button
                onClick={() => {
                  setIsGuestConfirmModalOpen(false);
                  logout();
                }}
                className="text-brass underline font-semibold cursor-pointer hover:text-brass-hover"
              >
                Đăng nhập
              </button>{' '}
              để lưu lịch sử cho các cuộc trò chuyện sau.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setIsGuestConfirmModalOpen(false)}
                className="px-5 py-2.5 text-sm font-semibold text-ink-2 hover:text-ink-1 transition-colors cursor-pointer rounded-full"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  setIsGuestConfirmModalOpen(false);
                  createNewSession();
                }}
                className="px-6 py-2.5 text-sm font-semibold text-ink bg-brass hover:bg-brass-hover rounded-full transition-colors cursor-pointer"
              >
                Cuộc trò chuyện mới
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col h-screen relative transition-all duration-300 ease-in-out">
        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          sendMessage={sendMessage}
          editMessage={editMessage}
        />
      </div>
    </div>
  );
};

export default MainLayout;
