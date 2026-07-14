import React, { useRef, useEffect } from 'react';
import ChatInput from './ChatInput'; // Phỏng đoán đường dẫn dựa theo cấu trúc
import MessageBubble from './MessageBubble';
import type { Message } from './MessageBubble';

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  sendMessage: (content: string) => Promise<void> | void;
  editMessage: (messageId: string, content: string) => Promise<void> | void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, isLoading, sendMessage, editMessage }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:px-12 w-full max-w-4xl mx-auto -mt-20">
        <div className="w-full text-center pb-2 animate-fade-in">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-700 mb-3">Enterprise AI Assistant</h2>
          <p className="text-base text-slate-500 max-w-xl mx-auto mb-6">
            Trợ lý thông minh kết nối trực tiếp với hệ thống dữ liệu doanh nghiệp
          </p>
        </div>
        <div className="w-full">
          <ChatInput onSendMessage={sendMessage} isLoading={isLoading} isCentered={true} />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Khu vực hiển thị nội dung chat */}
      <div className="flex-1 overflow-y-auto p-6 lg:px-12">
        <div className="max-w-4xl mx-auto pb-4">
          {messages.map((msg, index) => {
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const currentDate = msg.timestamp.split(' at ')[0];
            const prevDate = prevMsg ? prevMsg.timestamp.split(' at ')[0] : null;
            const showTimestamp = currentDate !== prevDate;

            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                showTimestamp={showTimestamp}
                onResend={(content) => editMessage(msg.id, content)}
              />
            );
          })}

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
      <ChatInput onSendMessage={sendMessage} isLoading={isLoading} isCentered={false} />
    </>
  );
};

export default ChatWindow;
