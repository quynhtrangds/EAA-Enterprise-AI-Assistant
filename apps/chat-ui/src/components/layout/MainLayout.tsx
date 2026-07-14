import React, { useState } from 'react';
import Sidebar from './Sidebar';
import SearchModal from '../chat/SearchModal';
import ChatWindow from '../chat/ChatWindow';
import { useChat } from '../../hooks/useChat'; // Import hook
import { useAuth } from '../../contexts/AuthContext';

const MainLayout: React.FC = () => {
  const { logout } = useAuth();
  // Rút gọn toàn bộ logic bằng Custom Hook
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

  // Trạng thái toggle Sidebar
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Container của Sidebar với animation trượt mượt mà */}
      <Sidebar
        isOpen={isSidebarOpen}
        sessions={sessions}
        activeSessionId={activeSessionId}
        currentUser={currentUser ?? undefined}
        onSelectSession={selectSession}
        onCreateSession={createNewSession}
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