import React, { useState, useRef, useEffect } from 'react';
import ToolTrace from './ToolTrace';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Định nghĩa interface cho dữ liệu tin nhắn
interface ToolCall {
  toolName: string;
  arguments: any;
  success: boolean;
  durationMs: number;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
}

interface MessageBubbleProps {
  message: Message;
  showTimestamp?: boolean;
  onResend?: (content: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, showTimestamp = false, onResend }) => {
  const isAI = message.sender === 'ai';
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Tự động focus vào textarea khi mở chế độ chỉnh sửa
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [isEditing]);

  const handleEditSubmit = () => {
    if (editContent.trim() && editContent !== message.content && onResend) {
      onResend(editContent);
    }
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col w-full mb-8">
      {/* Phân cách timestamp giữa các ngày */}
      {showTimestamp && (
        <div className="text-center w-full mb-4">
          <span className="text-xs font-semibold text-gray-400">{message.timestamp}</span>
        </div>
      )}

      <div className={`flex w-full ${isAI ? 'justify-start' : 'justify-end'}`}>
        <div className={`flex max-w-[85%] gap-4 ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>

          {/* Avatar */}
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${isAI ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-800 text-white'
            }`}>
            {isAI ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            )}
          </div>

          {/* Nội dung tin nhắn */}
          <div className="relative group flex flex-col gap-1 min-w-[200px]">
            <span className={`text-xs font-medium px-1 ${isAI ? 'text-gray-500' : 'text-gray-500 text-right'}`}>
              {isAI ? 'Enterprise AI' : 'You'}
            </span>
            <div className={`rounded-2xl p-4 shadow-sm border ${isAI
              ? 'bg-white border-gray-100 text-slate-700 rounded-tl-none'
              : 'bg-indigo-600 border-indigo-600 text-white rounded-tr-none'
              }`}>
              {isEditing ? (
                <div className="flex flex-col gap-3 min-w-[300px]">
                  <textarea
                    ref={textareaRef}
                    value={editContent}
                    onChange={(e) => {
                      setEditContent(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    className="w-full bg-slate-800 text-white rounded-lg p-3 outline-none resize-none overflow-hidden"
                    rows={1}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setIsEditing(false); setEditContent(message.content); }}
                      className="px-4 py-1.5 rounded-full bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEditSubmit}
                      disabled={!editContent.trim()}
                      className="px-4 py-1.5 rounded-full bg-white text-slate-800 hover:bg-gray-100 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm prose-slate max-w-none">
                  {message.content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  ) : (
                    <span className="text-red-500 font-medium italic">⚠️ Lỗi: Dữ liệu message.content bị rỗng (undefined)</span>
                  )}
                </div>
              )}

              {!isEditing && isAI && message.toolCalls && message.toolCalls.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {message.toolCalls.map((tool, index) => (
                    <ToolTrace key={index} tool={tool} />
                  ))}
                </div>
              )}
            </div>

            {/* Hover Actions (Copy & Edit) */}
            {!isEditing && (
              <div className="absolute -bottom-8 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                <span className="text-[11px] text-slate-400 mr-1 font-medium select-none">
                  {message.timestamp.includes(' at ') ? message.timestamp.split(' at ')[1] : message.timestamp}
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(message.content)}
                  className="p-1.5 rounded-md bg-white/90 backdrop-blur shadow-sm border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-white transition-all"
                  title="Sao chép"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                {!isAI && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 rounded-md bg-white/90 backdrop-blur shadow-sm border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-white transition-all"
                    title="Chỉnh sửa"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
