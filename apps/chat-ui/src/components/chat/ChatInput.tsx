import React, { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isCentered?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, isCentered = false }) => {
  const [input, setInput] = useState('');
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
    <div className={`p-4 ${isCentered ? 'w-full' : 'w-full sticky bottom-0 z-10'} bg-transparent`}>
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