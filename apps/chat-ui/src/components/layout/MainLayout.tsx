import React, { useRef, useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import ChatInput from '../chat/ChatInput';
import MessageBubble from '../chat/MessageBubble';
import { useChat } from '../../hooks/useChat'; // Import hook
import { useAuth } from '../../contexts/AuthContext';

const MainLayout: React.FC = () => {
  const { logout } = useAuth();
  // Rút gọn toàn bộ logic bằng Custom Hook
  const { 
    messages, 
    isLoading, 
    sendMessage,
    sessions,
    activeSessionId,
    currentUser,
    selectSession,
    createNewSession,
    deleteSession
  } = useChat();
  
  // Trạng thái toggle Sidebar
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Ref dùng để xác định điểm cuối cùng của danh sách chat
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tự động cuộn xuống cuối mỗi khi messages thay đổi
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Container của Sidebar với animation trượt mượt mà */}
      <div 
        className={`transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
          isSidebarOpen ? 'w-72' : 'w-0'
        }`}
      >
        <div className="w-72">
          <Sidebar 
            sessions={sessions}
            activeSessionId={activeSessionId}
            currentUser={currentUser ?? undefined}
            onSelectSession={selectSession}
            onCreateSession={createNewSession}
            onDeleteSession={deleteSession}
            onToggleSidebar={() => setIsSidebarOpen(false)}
            onLogout={logout}
          />
        </div>
      </div>
      
      <div className="flex-1 flex flex-col h-screen relative transition-all duration-300 ease-in-out">
        {/* Nút Toggle Sidebar (chỉ hiện khi sidebar đóng) */}
        {!isSidebarOpen && (
          <div className="absolute top-4 left-4 z-20">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 bg-white/80 backdrop-blur-md rounded-lg shadow-sm border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-white transition-colors focus:outline-none"
              title="Mở Sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        )}

        {/* Khu vực hiển thị nội dung chat */}
        <div className="flex-1 overflow-y-auto p-6 lg:px-12">
          <div className="max-w-4xl mx-auto pb-4">
            {messages.length === 0 ? (
              <div className="text-center mt-32 animate-fade-in">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-700 mb-2">Enterprise AI Assistant</h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Trợ lý thông minh kết nối trực tiếp với hệ thống dữ liệu doanh nghiệp thông qua chuẩn MCP.
                </p>
              </div>
            ) : (
              messages.map(msg => <MessageBubble key={msg.id} message={msg} />)
            )}
            
            {/* Vùng hiển thị đang tải */}
            {isLoading && (
              <div className="flex items-center text-sm text-slate-500 italic mt-6 ml-14">
                <div className="flex space-x-1 mr-3">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce animation-delay-150"></div>
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce animation-delay-300"></div>
                </div>
                Đang truy vấn dữ liệu...
              </div>
            )}
            
            {/* Điểm neo để tự động cuộn xuống */}
            <div ref={messagesEndRef} />
          </div>
        </div>
        
        <ChatInput onSendMessage={sendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default MainLayout;