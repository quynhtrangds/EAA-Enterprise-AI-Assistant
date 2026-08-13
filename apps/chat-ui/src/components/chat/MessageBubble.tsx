import React, { useState, useRef, useEffect } from 'react';
import ToolTrace from './ToolTrace';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { Message } from '../../types/chat';

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
        <div className="text-center w-full mb-6">
          <span className="text-[11px] font-mono text-ink-3 uppercase tracking-widest">{message.timestamp}</span>
        </div>
      )}

      <div className={`flex w-full ${isAI ? 'justify-start' : 'justify-end'}`}>
        <div className={`flex w-full gap-4 ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>
          {/* Nội dung tin nhắn */}
          <div className={`relative group flex flex-col gap-1.5 w-full ${isAI ? '' : 'items-end'}`}>
            <span className="sr-only">{isAI ? 'Enterprise AI' : 'You'}</span>
            {isEditing ? (
              <div className="flex flex-col gap-3 w-full max-w-2xl bg-surface-raised border border-hair rounded-lg p-4">
                <textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  className="w-full bg-ink text-ink-1 rounded-lg p-3 outline-none resize-none overflow-hidden border border-hair text-[15.5px]"
                  rows={1}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setIsEditing(false); setEditContent(message.content); }}
                    className="px-4 py-1.5 rounded-full bg-surface hover:bg-surface-raised text-ink-2 hover:text-ink-1 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditSubmit}
                    disabled={!editContent.trim()}
                    className="px-4 py-1.5 rounded-full bg-brass hover:bg-brass-hover text-ink text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Send
                  </button>
                </div>
              </div>
            ) : (
              <div className={`transition-colors ${isAI
                ? 'w-full text-ink-1'
                : 'bg-surface border border-hair text-ink-1 rounded-lg rounded-tr-sm px-5 py-3 max-w-[80%] text-[15.5px] leading-relaxed'
                }`}>
                {isAI ? (
                  <div className="prose prose-invert max-w-none text-[15.5px] leading-relaxed text-ink-1">
                    {message.content ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      <span className="text-clay font-medium italic">Lỗi: nội dung tin nhắn bị rỗng.</span>
                    )}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}

                {!isEditing && isAI && message.toolCalls && message.toolCalls.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 items-start">
                    {message.toolCalls.map((tool, index) => (
                      <ToolTrace key={index} tool={tool} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Hover Actions (Copy & Edit) */}
            {!isEditing && (
              <div className={`absolute -bottom-8 ${isAI ? 'left-0' : 'right-0'} flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10`}>
                <span className="text-[11px] font-mono text-ink-3 select-none">
                  {message.timestamp.includes(' at ') ? message.timestamp.split(' at ')[1] : message.timestamp}
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(message.content)}
                  className="p-1.5 rounded-lg bg-surface border border-hair text-ink-2 hover:text-ink-1 hover:bg-surface-raised transition-colors cursor-pointer"
                  title="Sao chép"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                {!isAI && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 rounded-lg bg-surface border border-hair text-ink-2 hover:text-ink-1 hover:bg-surface-raised transition-colors cursor-pointer"
                    title="Chỉnh sửa"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
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
