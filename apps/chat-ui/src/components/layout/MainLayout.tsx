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

  const isGuest = currentUser?.username === 'guest' || currentUser?.role === 'viewer';

  const handleCreateSessionRequest = () => {
    if (isGuest && messages.length > 0) {
      setIsGuestConfirmModalOpen(true);
    } else {
      createNewSession();
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#1c1d2e] via-[#0e101f] to-[#080914] font-sans overflow-hidden text-slate-100">
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
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1c1d27] border border-slate-700/60 rounded-3xl p-7 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-xl font-bold text-white mb-3">
              Clear current chat & create new one?
            </h3>
            <p className="text-[14.5px] text-slate-300 leading-relaxed mb-8">
              When you start a new chat, your current one won't be saved.{' '}
              <button
                onClick={() => {
                  setIsGuestConfirmModalOpen(false);
                  logout();
                }}
                className="text-white underline font-semibold cursor-pointer hover:text-indigo-300"
              >
                Sign in
              </button>{' '}
              to save your future chats.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setIsGuestConfirmModalOpen(false)}
                className="px-5 py-2.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer rounded-full"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsGuestConfirmModalOpen(false);
                  createNewSession();
                }}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-full shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              >
                New chat
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