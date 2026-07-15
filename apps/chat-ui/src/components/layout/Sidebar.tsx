import React, { useState, useRef, useEffect } from 'react';
import type { Session } from '../../hooks/useChat';

const roles = [
  { code: 'admin', name: 'Admin', label: 'Quản trị viên' },
  { code: 'manager', name: 'Manager', label: 'Quản lý' },
  { code: 'staff', name: 'Staff', label: 'Nhân viên' },
  { code: 'viewer', name: 'Viewer', label: 'Người xem' },
];

interface SidebarProps {
  isOpen?: boolean;
  sessions?: Session[];
  activeSessionId?: string;
  currentUser?: string;
  onSelectSession?: (id: string) => void;
  onCreateSession?: () => void;
  onDeleteSession?: (id: string) => void;
  onToggleSidebar?: () => void;
  onLogout?: () => void;
  onRenameSession?: (id: string, newTitle: string) => void;
  onToggleStarSession?: (id: string, isStarred: boolean) => void;
  onOpenSearch?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen = true,
  sessions = [],
  activeSessionId,
  currentUser = 'admin',
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onToggleSidebar,
  onLogout,
  onRenameSession,
  onToggleStarSession,
  onOpenSearch
}) => {
  const activeRole = roles.find(r => r.code === currentUser) || roles[0];

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleLogoClick = () => {
    if (!isOpen) {
      onToggleSidebar?.();
      return;
    }
    if (activeSessionId !== 'new-chat-session' && onCreateSession) {
      onCreateSession();
    }
  };
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Click outside menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const starredSessions = sessions.filter(s => s.isStarred);
  const recentSessions = sessions.filter(s => !s.isStarred);

  const startEditing = (session: Session) => {
    setEditingSessionId(session.id);
    setEditTitle(session.title);
    setOpenMenuId(null);
  };

  const saveEdit = (id: string) => {
    if (editTitle.trim() && onRenameSession) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingSessionId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') saveEdit(id);
    if (e.key === 'Escape') setEditingSessionId(null);
  };

  const renderSessionItem = (session: Session) => {
    const isActive = session.id === activeSessionId;
    return (
      <div key={session.id} className="relative group flex items-center">
        {editingSessionId === session.id ? (
          <div className="w-full flex items-center bg-slate-800 p-2 pr-2 rounded-xl border border-indigo-500 mb-1 z-20">
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, session.id)}
              onBlur={() => saveEdit(session.id)}
              className="w-full bg-transparent text-sm text-white font-medium outline-none"
            />
          </div>
        ) : (
          <button
            onClick={() => onSelectSession?.(session.id)}
            className={`w-full text-left p-3 pr-10 rounded-xl transition-all duration-200 flex flex-col gap-1 cursor-pointer mb-1 ${isActive
              ? 'bg-slate-800 text-white border-l-4 border-indigo-500 pl-2'
              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
          >
            <p className={`text-sm font-medium truncate ${isActive ? 'text-indigo-400' : 'group-hover:text-indigo-400'}`}>
              {session.title}
            </p>
          </button>
        )}

        {/* 3-dot Menu Button on Hover */}
        {editingSessionId !== session.id && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenuId(openMenuId === session.id ? null : session.id);
            }}
            className={`absolute right-2 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700/50 transition-opacity cursor-pointer z-10 ${openMenuId === session.id ? 'opacity-100 bg-slate-700/50 text-white' : 'opacity-0 group-hover:opacity-100'}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>
        )}

        {/* Dropdown Menu */}
        {openMenuId === session.id && (
          <div ref={menuRef} className="absolute right-2 top-10 w-48 bg-[#202124] border border-[#3c4043] rounded-xl shadow-xl z-50 py-1 text-sm text-[#e8eaed]">
            <button onClick={(e) => { e.stopPropagation(); onToggleStarSession?.(session.id, !session.isStarred); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 hover:bg-[#3c4043] flex items-center gap-3">
              <svg className="w-4 h-4" fill={session.isStarred ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
              {session.isStarred ? 'Bỏ ghim' : 'Ghim'}
            </button>
            <button onClick={(e) => { e.stopPropagation(); startEditing(session); }} className="w-full text-left px-4 py-2 hover:bg-[#3c4043] flex items-center gap-3">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              Đổi tên
            </button>
            {sessions.length > 1 && (
              <button onClick={(e) => { e.stopPropagation(); onDeleteSession?.(session.id); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 hover:bg-red-500/10 text-red-400 hover:text-red-300 flex items-center gap-3 border-t border-[#3c4043] mt-1 pt-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Xóa
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`bg-[#0f172a] relative z-50 text-slate-300 flex flex-col h-screen shadow-xl select-none transition-all duration-300 ease-in-out shrink-0 ${isOpen ? 'w-75' : 'w-[72px]'} border-r border-slate-800`}>
      {/* Header */}
      <div className={`pt-4 pb-2 px-4 flex items-center justify-between overflow-hidden shrink-0`}>
        <div
          className="flex items-center gap-2 cursor-pointer group shrink-0 transition-transform duration-200 active:scale-95"
          onClick={handleLogoClick}
          title={activeSessionId !== 'new-chat-session' ? "Bắt đầu cuộc trò chuyện mới" : undefined}
        >
          <div className="w-10 h-10 flex items-center justify-center shrink-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${!isOpen ? 'bg-indigo-500 group-hover:bg-slate-800 shadow-lg shadow-indigo-500/30 group-hover:shadow-none' : 'bg-indigo-500 shadow-lg shadow-indigo-500/30'}`}>
              {!isOpen ? (
                <>
                  <svg className="w-5 h-5 text-white group-hover:hidden transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <svg className="w-5 h-5 text-slate-300 hidden group-hover:block transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </>
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              )}
            </div>
          </div>
          <div className={`flex flex-col whitespace-nowrap overflow-hidden transition-all duration-300 ${isOpen ? 'w-[120px] opacity-100' : 'w-0 opacity-0'}`}>
            <h1 className="text-[15px] font-bold text-white tracking-wide">Enterprise UI</h1>
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">MCP GATEWAY</span>
          </div>
        </div>
        <button
          onClick={() => onToggleSidebar?.()}
          className={`h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-300 focus:outline-none overflow-hidden shrink-0 ${isOpen ? 'w-10 opacity-100' : 'w-0 opacity-0'}`}
          title="Thu gọn Sidebar"
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Quick Actions */}
      <div className={`px-4 flex flex-col gap-2 mb-4 mt-2 shrink-0`}>
        <button
          onClick={() => onCreateSession?.()}
          className={`flex items-center gap-3 px-2 h-10 w-full text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-xl transition-all duration-300 font-medium text-[13px] border border-transparent hover:border-slate-700 shrink-0 overflow-hidden`}
          title={!isOpen ? "Cuộc trò chuyện mới" : undefined}
        >
          <div className="w-6 h-6 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </div>
          <span className={`truncate transition-all duration-300 text-left ${isOpen ? 'opacity-100' : 'opacity-0'}`}>Cuộc trò chuyện mới</span>
        </button>

        <button
          onClick={() => onOpenSearch?.()}
          className={`flex items-center gap-3 px-2 h-10 w-full text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-xl transition-all duration-300 font-medium text-[13px] border border-transparent hover:border-slate-700 shrink-0 overflow-hidden`}
          title={!isOpen ? "Tìm kiếm trong các cuộc trò chuyện" : undefined}
        >
          <div className="w-6 h-6 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <span className={`truncate transition-all duration-300 text-left ${isOpen ? 'opacity-100' : 'opacity-0'}`}>Tìm kiếm trong các cuộc trò chuyện</span>
        </button>
      </div>

      {/* Session List */}
      <div className={`flex-1 overflow-y-auto pb-3 dark-scrollbar transition-all duration-300 ${isOpen ? 'px-3 opacity-100' : 'px-0 opacity-0 pointer-events-none invisible'}`}>
        {starredSessions.length > 0 && (
          <div className="mb-4">
            <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Đã ghim
            </div>
            {starredSessions.map(renderSessionItem)}
          </div>
        )}

        {recentSessions.length > 0 && (
          <div>
            <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              LỊCH SỬ HỘI THOẠI
            </div>
            {recentSessions.map(renderSessionItem)}
          </div>
        )}
      </div>

      {/* Footer Profile / Role Selector */}
      <div className={`p-2 border-t border-slate-800/50 bg-[#0f172a] shrink-0 relative`} ref={profileMenuRef}>
        {/* Profile Menu Popup */}
        {isProfileMenuOpen && (
          <div className={`absolute bottom-[calc(100%+8px)] bg-slate-800 rounded-xl shadow-2xl border border-slate-700/50 z-50 p-1.5 origin-bottom animate-in slide-in-from-bottom-2 fade-in duration-200 ${isOpen ? 'left-2 right-2' : 'left-2 w-48'}`}>
            <button
              onClick={() => {
                setIsProfileMenuOpen(false);
                onLogout?.();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              <span className="font-medium truncate">Đăng xuất</span>
            </button>
          </div>
        )}

        <button
          onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
          className={`flex items-center gap-3 w-full rounded-xl transition-all duration-300 group overflow-hidden p-2 cursor-pointer`}
          title="Tài khoản"
        >
          <div className="w-10 h-10 shrink-0 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-200 shadow-inner group-hover:bg-slate-600 transition-colors relative">
            <span>{activeRole.name[0]}</span>
          </div>
          <div className={`flex flex-col text-left overflow-hidden transition-all duration-300 ${isOpen ? 'w-32 opacity-100' : 'w-0 opacity-0'}`}>
            <p className="text-sm font-semibold text-white truncate whitespace-nowrap">{activeRole.name}</p>
            <p className="text-[11px] text-slate-400 truncate whitespace-nowrap">{activeRole.label}</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;