import React, { useRef, useEffect } from 'react';
import ChatInput from './ChatInput'; // Phỏng đoán đường dẫn dựa theo cấu trúc
import MessageBubble from './MessageBubble';
import type { Message } from '../../types/chat';

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
          <div className="w-14 h-14 rounded-full border border-brass/50 flex items-center justify-center mx-auto mb-6">
            <span className="font-mono text-brass text-base">AI</span>
          </div>
          <h2 className="text-2xl font-semibold text-ink-1 mb-3">Trợ lý AI Doanh nghiệp</h2>
          <p className="text-[16px] text-ink-2 max-w-xl mx-auto mb-6 leading-relaxed">
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
            <div className="flex items-center text-[15px] text-ink-3 italic mt-6 ml-14">
              <div className="flex space-x-1 mr-3">
                <div className="w-2 h-2 bg-brass rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-brass rounded-full animate-bounce animation-delay-150"></div>
                <div className="w-2 h-2 bg-brass rounded-full animate-bounce animation-delay-300"></div>
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
