import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface Message {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: string;
  toolCalls?: any[];
}

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isAI = message.sender === 'ai';

  return (
    <div className={`flex w-full mb-8 ${isAI ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex max-w-[85%] gap-4 ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${
          isAI ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-800 text-white'
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

        {/* Bubble Content */}
        <div className="flex flex-col gap-1 min-w-[200px]">
          <span className={`text-xs font-medium px-1 ${isAI ? 'text-gray-500' : 'text-gray-500 text-right'}`}>
            {isAI ? 'Enterprise AI' : 'You'} • {message.timestamp}
          </span>
          <div className={`rounded-2xl p-4 shadow-sm border ${
            isAI 
              ? 'bg-white border-gray-100 text-slate-700 rounded-tl-none' 
              : 'bg-indigo-600 border-indigo-600 text-white rounded-tr-none'
          }`}>
        <div className="prose prose-sm prose-slate max-w-none">
            {message.content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                </ReactMarkdown>
  ) : (
    <span className="text-red-500 font-medium italic">⚠️ Lỗi: Dữ liệu message.content bị rỗng (undefined)</span>
  )}
</div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MessageBubble;
