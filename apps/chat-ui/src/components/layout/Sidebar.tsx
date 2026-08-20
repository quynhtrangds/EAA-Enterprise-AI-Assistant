import React, { useState, useRef, useEffect } from 'react';
import type { Session } from '../../hooks/useChat';
import { IntegrationSettings } from '../admin/IntegrationSettings';

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
  currentUser?: any;
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
  currentUser,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onToggleSidebar,
  onLogout,
  onRenameSession,
  onToggleStarSession,
  onOpenSearch
}) => {
  const userRoles = currentUser?.roles || (currentUser?.role ? [currentUser.role] : []);
  const isAdmin = userRoles.includes('admin') || currentUser?.username === 'admin';
  const roleCode = userRoles[0] || 'viewer';
  const activeRole = roles.find(r => r.code === roleCode) || roles[0];
  const isGuest = currentUser?.username === 'guest' || currentUser?.role === 'viewer' || roleCode === 'viewer';
  const displayName = currentUser?.displayName || currentUser?.username || activeRole.name;
  const displayLabel = currentUser?.email || activeRole.label;
  const initial = displayName[0]?.toUpperCase() || activeRole.name[0];

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
  const [deletingSession, setDeletingSession] = useState<Session | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const handleLogoClick = () => {
    if (!isOpen) {
      onToggleSidebar?.();
      return;
    }
    if (activeSessionId !== 'new-chat-session' && onCreateSession) {
      onCreateSession();
    }
  };

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
          <div className="w-full flex items-center bg-surface-raised p-2 pr-2 rounded-lg border border-brass mb-1 z-20">
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, session.id)}
              onBlur={() => saveEdit(session.id)}
              className="w-full bg-transparent text-[15px] text-ink-1 font-medium outline-none"
            />
          </div>
        ) : (
          <button
            onClick={() => onSelectSession?.(session.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors cursor-pointer mb-0.5 relative pr-10 text-[15px] ${isActive
              ? 'bg-surface-raised text-ink-1 border-l-2 border-brass pl-2'
              : 'text-ink-2 hover:bg-surface-raised/60 hover:text-ink-1'
              }`}
          >
            <p className={`text-[15px] font-medium truncate ${isActive ? 'text-brass font-semibold' : 'group-hover:text-ink-1'}`}>
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
            className={`absolute right-2 p-1.5 rounded-lg text-ink-3 hover:text-ink-1 hover:bg-surface-raised transition-opacity cursor-pointer z-10 ${openMenuId === session.id ? 'opacity-100 bg-surface-raised text-ink-1' : 'opacity-0 group-hover:opacity-100'}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>
        )}

        {/* Dropdown Menu */}
        {openMenuId === session.id && (
          <div ref={menuRef} className="absolute right-2 top-10 w-48 bg-surface border border-hair rounded-lg shadow-xl z-50 py-1 text-sm text-ink-1">
            <button onClick={(e) => { e.stopPropagation(); onToggleStarSession?.(session.id, !session.isStarred); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 hover:bg-surface-raised flex items-center gap-3">
              <svg className="w-4 h-4" fill={session.isStarred ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
              {session.isStarred ? 'Bỏ ghim' : 'Ghim'}
            </button>
            <button onClick={(e) => { e.stopPropagation(); startEditing(session); }} className="w-full text-left px-4 py-2 hover:bg-surface-raised flex items-center gap-3">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              Đổi tên
            </button>
            {sessions.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingSession(session);
                  setOpenMenuId(null);
                }}
                className="w-full text-left px-4 py-2 hover:bg-clay/10 text-clay hover:text-clay flex items-center gap-3 border-t border-hair mt-1 pt-2 cursor-pointer"
              >
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
    <div className={`bg-ink relative z-50 text-ink-2 flex flex-col h-screen select-none transition-all duration-200 ease-in-out shrink-0 ${isOpen ? 'w-75' : 'w-[72px]'} border-r border-hair`}>
      {/* Header */}
      <div className={`pt-4 pb-2 px-4 flex items-center justify-between overflow-hidden shrink-0`}>
        <div
          className={`flex items-center gap-2 cursor-pointer group shrink-0 transition-transform duration-200 active:scale-95`}
          onClick={handleLogoClick}
          title={isOpen && activeSessionId !== 'new-chat-session' ? "Bắt đầu cuộc trò chuyện mới" : !isOpen ? "Mở rộng Sidebar" : undefined}
        >
          <div className="w-10 h-10 flex items-center justify-center shrink-0">
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${!isOpen ? 'border-brass/50 group-hover:bg-surface-raised' : 'border-brass/50'}`}>
              {!isOpen ? (
                <>
                  <span className="font-mono text-brass text-xs group-hover:hidden">AI</span>
                  <svg className="w-4 h-4 text-ink-2 hidden group-hover:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </>
              ) : (
                <span className="font-mono text-brass text-xs">AI</span>
              )}
            </div>
          </div>
          <div className={`flex flex-col whitespace-nowrap overflow-hidden transition-all duration-200 ${isOpen ? 'w-[140px] opacity-100' : 'w-0 opacity-0'}`}>
            <h1 className="text-[15px] font-semibold text-ink-1">AI Assistant</h1>
          </div>
        </div>
        <button
          onClick={() => onToggleSidebar?.()}
          className={`h-10 rounded-full flex items-center justify-center text-ink-3 hover:text-ink-1 hover:bg-surface-raised transition-all duration-200 focus:outline-none overflow-hidden shrink-0 ${isOpen ? 'w-10 opacity-100' : 'w-0 opacity-0'}`}
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
          className={`flex items-center gap-3 px-2 h-10 w-full text-ink-2 hover:text-ink-1 hover:bg-surface-raised/60 rounded-lg transition-colors font-medium text-[14.5px] border border-transparent hover:border-hair shrink-0 overflow-hidden cursor-pointer`}
          title={!isOpen ? "Cuộc trò chuyện mới" : undefined}
        >
          <div className="w-6 h-6 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </div>
          <span className={`truncate transition-all duration-200 text-left ${isOpen ? 'opacity-100' : 'opacity-0'}`}>Cuộc trò chuyện mới</span>
        </button>

        <button
          onClick={() => { if (!isGuest) onOpenSearch?.(); }}
          disabled={isGuest}
          className={`flex items-center gap-3 px-2 h-10 w-full rounded-lg focus:outline-none transition-colors font-medium text-[13px] border border-transparent shrink-0 overflow-hidden ${isGuest
            ? 'text-ink-3 opacity-40 cursor-not-allowed'
            : 'text-ink-2 hover:text-ink-1 hover:bg-surface-raised/60 hover:border-hair cursor-pointer'
            }`}
          title={!isOpen ? (isGuest ? "Cần đăng nhập để tìm kiếm" : "Tìm kiếm trong các cuộc trò chuyện") : undefined}
        >
          <div className="w-6 h-6 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <span className={`truncate transition-all duration-200 text-left ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
            Tìm kiếm trong các cuộc trò chuyện
          </span>
        </button>
      </div>

      {/* Session List */}
      <div className={`flex-1 overflow-y-auto pb-3 dark-scrollbar transition-all duration-200 ${isOpen ? 'px-3 opacity-100' : 'px-0 opacity-0 pointer-events-none invisible'}`}>
        {isGuest ? (
          <div className="p-4 text-center flex flex-col items-center justify-center h-48 gap-3 my-auto">
            <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-ink-2 border border-hair">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-xs text-ink-2 font-medium leading-relaxed">
              Đang ở chế độ Khách.<br />Lịch sử hội thoại sẽ không được lưu.
            </p>
          </div>
        ) : (
          <>
            {starredSessions.length > 0 && (
              <div className="mb-4">
                <div className="px-3 py-2 text-[11px] font-mono text-ink-3 uppercase tracking-wider">
                  Đã ghim
                </div>
                {starredSessions.map(renderSessionItem)}
              </div>
            )}

            {recentSessions.length > 0 && (
              <div>
                <div className="px-3 py-2 text-[10px] font-mono text-ink-3 uppercase tracking-wider">
                  Lịch sử hội thoại
                </div>
                {recentSessions.map(renderSessionItem)}
              </div>
            )}
          </>
        )}
      </div>

            {/* Footer Profile / Guest Login Button */}
      <div className="p-2 border-t border-hair bg-ink shrink-0 relative" ref={profileMenuRef}>
        {isGuest ? (
          <button
            onClick={() => onLogout?.()}
            title={!isOpen ? "Đăng nhập" : undefined}
            className={`flex items-center h-10 w-full rounded-lg bg-brass hover:bg-brass-hover text-ink font-medium text-sm transition-all duration-200 cursor-pointer overflow-hidden shadow-sm active:scale-98 ${
              isOpen ? 'px-3 justify-start gap-2.5' : 'px-0 justify-center'
            }`}
          >
            <div className="w-6 h-6 flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
            </div>
            <span className={`whitespace-nowrap transition-all duration-200 text-left ${isOpen ? 'opacity-100 max-w-[150px]' : 'opacity-0 max-w-0'}`}>
              Đăng nhập
            </span>
          </button>
        ) : (
          <>
            {/* Profile Menu Popup */}
            {isProfileMenuOpen && (
              <div className={`absolute bottom-[calc(100%+8px)] bg-surface rounded-lg shadow-xl border border-hair z-50 p-1.5 origin-bottom animate-in slide-in-from-bottom-2 fade-in duration-200 ${isOpen ? 'left-2 right-2' : 'left-2 w-48'}`}>

                {isAdmin && (
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      setIsIntegrationModalOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-ink-2 hover:text-ink-1 hover:bg-surface-raised rounded-lg transition-colors mb-1"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="font-medium truncate">Cài đặt</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onLogout?.();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-ink-2 hover:text-ink-1 hover:bg-surface-raised rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  <span className="font-medium truncate">Đăng xuất</span>
                </button>
              </div>
            )}

            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className={`flex items-center gap-3 w-full rounded-lg transition-colors group overflow-hidden p-2 cursor-pointer`}
              title="Tài khoản"
            >
              <div className="w-10 h-10 shrink-0 rounded-full bg-surface-raised flex items-center justify-center text-sm font-semibold text-ink-1 group-hover:bg-hair transition-colors relative overflow-hidden">
                {currentUser?.picture ? (
                  <img src={currentUser.picture} alt={displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span>{initial}</span>
                )}
              </div>
              <div className={`flex flex-col text-left overflow-hidden transition-all duration-200 ${isOpen ? 'w-32 opacity-100' : 'w-0 opacity-0'}`}>
                <p className="text-[15px] font-semibold text-ink-1 truncate whitespace-nowrap">{displayName}</p>
                <p className="text-[12px] text-ink-2 truncate whitespace-nowrap">{displayLabel}</p>
              </div>
            </button>
          </>
        )}
      </div>

      {/* Delete Session Confirmation Modal */}
      {deletingSession && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-surface border border-hair rounded-lg p-7 max-w-md w-full animate-in fade-in zoom-in-95 duration-150 shadow-2xl">
            <h3 className="text-xl font-semibold text-ink-1 mb-3">
              Xóa cuộc trò chuyện?
            </h3>
            <p className="text-[14.5px] text-ink-2 leading-relaxed mb-8">
              Thao tác này sẽ xóa vĩnh viễn đoạn chat <span className="font-semibold text-ink-1">"{deletingSession.title || 'Cuộc trò chuyện mới'}"</span> và không thể khôi phục lại. Bạn có chắc chắn muốn xóa không?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingSession(null)}
                className="px-5 py-2.5 text-sm font-semibold text-ink-2 hover:text-ink-1 transition-colors cursor-pointer rounded-full"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deletingSession) {
                    onDeleteSession?.(deletingSession.id);
                    setDeletingSession(null);
                  }
                }}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-clay hover:bg-clay/90 rounded-full transition-colors cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {isIntegrationModalOpen && (
        <IntegrationSettings onClose={() => setIsIntegrationModalOpen(false)} />
      )}
    </div>
  );
};

export default Sidebar;
