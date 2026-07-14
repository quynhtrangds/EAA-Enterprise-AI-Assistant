import React, { useState, useEffect, useRef } from 'react';
import type { Session, SearchSession } from '../../hooks/useChat';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  searchSessions?: (query: string) => Promise<SearchSession[]>;
  onSelectSession: (id: string) => void;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, sessions, searchSessions, onSelectSession }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchSession[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setResults(sessions.slice(0, 10));
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, sessions]);

  useEffect(() => {
    if (!isOpen) return;

    if (!searchTerm.trim()) {
      setResults(sessions.slice(0, 10));
      return;
    }

    const timer = setTimeout(async () => {
      if (searchSessions) {
        setIsSearching(true);
        try {
          const res = await searchSessions(searchTerm);
          setResults(res);
        } finally {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, searchSessions, isOpen, sessions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-sm p-4">
      <div 
        className="w-full max-w-2xl bg-[#1e1e1e] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="relative border-b border-slate-700 p-2">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent border-none py-4 pl-14 pr-12 text-lg text-white placeholder-slate-400 focus:outline-none"
            placeholder="Tìm kiếm trong các cuộc trò chuyện"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 max-h-[60vh] overflow-y-auto p-2 dark-scrollbar bg-[#171717]">
          <div className="px-4 py-3 text-sm font-semibold text-slate-400">
            {searchTerm.trim() ? 'Kết quả' : 'Gần đây'}
          </div>
          
          <div className="flex flex-col gap-1 px-2 pb-2">
            {isSearching ? (
              <div className="px-4 py-8 text-center text-slate-500">
                <svg className="animate-spin h-5 w-5 mx-auto text-indigo-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Đang tìm kiếm...
              </div>
            ) : results.length > 0 ? (
              results.map(session => (
                <button
                  key={session.id}
                  onClick={() => {
                    onSelectSession(session.id);
                    onClose();
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-between group"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <h4 className="text-base font-medium text-slate-200 truncate group-hover:text-white">
                      {session.title}
                    </h4>
                    <p className="text-sm text-slate-500 truncate mt-1">
                      {session.matchedMessage ? (
                        <span><span className="text-indigo-400 opacity-80">Trùng khớp: </span>"{session.matchedMessage.length > 80 ? session.matchedMessage.substring(0, 80) + '...' : session.matchedMessage}"</span>
                      ) : (
                        `ID: ${session.session_code}`
                      )}
                    </p>
                  </div>
                  <div className="text-xs text-slate-500 shrink-0">
                    {session.updatedAt}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-slate-500">
                Không tìm thấy kết quả nào cho "{searchTerm}"
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Click outside to close */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
};

export default SearchModal;
