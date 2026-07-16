import React, { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isCentered?: boolean;
}

// Khai báo mảng 5 quick prompts
const QUICK_PROMPTS = [
  { icon: '💰', text: 'Hôm nay doanh thu bao nhiêu?' },
  { icon: '👑', text: 'Top 5 khách hàng mua nhiều nhất tháng này là ai?' },
  { icon: '📦', text: 'Đơn hàng ORD-001 có trạng thái gì?' },
  { icon: '📋', text: 'Khách hàng Nguyễn Văn A có những đơn hàng nào?' },
  { icon: '📈', text: 'Sản phẩm nào bán chạy nhất tháng này?' }
];

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, isCentered = false }) => {
  const [input, setInput] = useState('');
  const [showPrompts, setShowPrompts] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isLoading]);

  useEffect(() => {
    const handleEditPrompt = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setInput(customEvent.detail);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    };
    window.addEventListener('edit-prompt', handleEditPrompt);
    return () => window.removeEventListener('edit-prompt', handleEditPrompt);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className={`p-4 ${isCentered ? 'bg-transparent w-full' : 'bg-[#18191c]/80 backdrop-blur-md border-t border-[#26272b]/80 sticky bottom-0 z-10'}`}>

      {/* Vùng render Quick Prompts bằng map() */}
      <div className="max-w-4xl mx-auto mb-3 px-2">
        <button
          onClick={() => setShowPrompts(!showPrompts)}
          className="text-[13px] text-purple-400 font-semibold mb-2 flex items-center gap-1 hover:underline hover:text-purple-300 focus:outline-none transition-colors cursor-pointer"
        >
          <svg className={`w-4 h-4 transition-transform duration-300 ${showPrompts ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          {showPrompts ? 'Thu gọn gợi ý' : 'Hiển thị gợi ý câu hỏi'}
        </button>

        <div className={`flex flex-wrap gap-2 transition-all duration-300 overflow-hidden ${showPrompts ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
          {QUICK_PROMPTS.map((prompt, index) => (
            <button
              key={index}
              onClick={() => onSendMessage(prompt.text)}
              disabled={isLoading}
              className="text-[13px] font-semibold bg-[#2b2c35]/80 border border-[#3c3e4a]/60 text-slate-300 px-4 py-2.5 rounded-full hover:border-[#a855f7]/85 hover:text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {prompt.icon} {prompt.text}
            </button>
          ))}
        </div>
      </div>

      {/* Khung nhập text */}
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-3 relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          placeholder="Nhập câu hỏi..."
          className="flex-1 pl-6 pr-14 py-4 bg-[#2b2c35]/85 border border-[#3c3e4a]/65 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500/85 focus:bg-[#32333d] shadow-inner text-white placeholder-slate-500 disabled:opacity-60 transition-all text-[16px]"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="absolute right-2 top-2 bottom-2 aspect-square bg-[#a855f7] hover:bg-[#b062ff] disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl transition-all flex items-center justify-center shadow-lg shadow-purple-500/10 cursor-pointer"
        >
          <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </form>
    </div>
  );
};

export default ChatInput;