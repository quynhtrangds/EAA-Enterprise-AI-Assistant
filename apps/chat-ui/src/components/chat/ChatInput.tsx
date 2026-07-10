import React, { useState } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

// Khai báo mảng 5 quick prompts
const QUICK_PROMPTS = [
  { icon: '💰', text: 'Hôm nay doanh thu bao nhiêu?' },
  { icon: '👑', text: 'Top 5 khách hàng mua nhiều nhất tháng này là ai?' },
  { icon: '📦', text: 'Đơn hàng ORD-001 có trạng thái gì?' },
  { icon: '📋', text: 'Khách hàng Nguyễn Văn A có những đơn hàng nào?' },
  { icon: '📈', text: 'Sản phẩm nào bán chạy nhất tháng này?' }
];

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 sticky bottom-0 z-10">

      {/* Vùng render Quick Prompts bằng map() */}
      <div className="max-w-4xl mx-auto flex flex-wrap gap-2 mb-3 px-2">
        {QUICK_PROMPTS.map((prompt, index) => (
          <button
            key={index}
            onClick={() => onSendMessage(prompt.text)}
            disabled={isLoading}
            className="text-xs font-medium bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-full hover:border-indigo-300 hover:text-indigo-600 shadow-sm transition-all disabled:opacity-50"
          >
            {prompt.icon} {prompt.text}
          </button>
        ))}
      </div>

      {/* Khung nhập text */}
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-3 relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          placeholder="Nhập yêu cầu truy vấn dữ liệu..."
          className="flex-1 pl-6 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white shadow-inner disabled:opacity-60 transition-all text-[15px]"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="absolute right-2 top-2 bottom-2 aspect-square bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-300 transition-all flex items-center justify-center shadow-md shadow-indigo-200"
        >
          <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </form>
    </div>
  );
};

export default ChatInput;