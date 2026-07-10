import React from 'react';
import type { Session } from '../../hooks/useChat';

const roles = [
  { code: 'admin', name: 'Admin', label: 'Quản trị viên' },
  { code: 'manager', name: 'Manager', label: 'Quản lý' },
  { code: 'staff', name: 'Staff', label: 'Nhân viên' },
  { code: 'viewer', name: 'Viewer', label: 'Người xem' },
];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatSessionTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const now = new Date();
  const daysDiff = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000);
  const time = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);

  if (daysDiff === 0) {
    return time;
  }

  if (daysDiff === 1) {
    return `Hôm qua ${time}`;
  }

  const dateText = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {})
  }).format(date);

  return `${dateText} ${time}`;
}

// 1. Thêm dấu ? để biến tất cả các props thành tùy chọn (không bắt buộc)
interface SidebarProps {
  sessions?: Session[];
  activeSessionId?: string;
  currentUser?: string;
  onSelectSession?: (id: string) => void;
  onCreateSession?: () => void;
  onDeleteSession?: (id: string) => void;
  onToggleSidebar?: () => void;
  onLogout?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  sessions = [], // 2. Mặc định là mảng rỗng để không bị lỗi khi dùng sessions.map()
  activeSessionId,
  currentUser = 'admin', // Mặc định là admin
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onToggleSidebar,
  onLogout
}) => {
  const activeRole = roles.find(r => r.code === currentUser) || roles[0];

  return (
    <div className="w-72 bg-slate-900 text-slate-300 flex flex-col h-screen border-r border-slate-800 shadow-xl z-10 select-none">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">Enterprise UI</h1>
            <p className="text-[10px] text-indigo-400 font-medium uppercase tracking-wider">MCP Gateway</p>
          </div>
        </div>
        <button
          onClick={() => onToggleSidebar?.()}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
          title="Thu gọn Sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={() => onCreateSession?.()} // 3. Thêm ?. để gọi hàm an toàn
          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Hội thoại mới
        </button>
      </div>

      {/* Session List Header (Fixed) */}
      <div className="px-6 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        Lịch sử hội thoại
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 dark-scrollbar">
        {sessions.map(session => {
          const isActive = session.id === activeSessionId;
          return (
            <div key={session.id} className="relative group flex items-center">
              <button
                onClick={() => onSelectSession?.(session.id)} // Thêm ?.
                className={`w-full text-left p-3 pr-10 rounded-xl transition-all duration-200 flex flex-col gap-1 cursor-pointer ${isActive
                  ? 'bg-slate-800 text-white border-l-4 border-indigo-500 pl-2'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
              >
                <p className={`text-sm font-medium truncate ${isActive ? 'text-indigo-400' : 'group-hover:text-indigo-400'}`}>
                  {session.title}
                </p>
                <p className="text-[11px] text-slate-500">{formatSessionTime(session.updatedAt)}</p>
              </button>

              {/* Delete Button on Hover */}
              {sessions.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession?.(session.id); // Thêm ?.
                  }}
                  className="absolute right-2 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Xóa hội thoại"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Profile / Role Selector */}
      <div className="p-4 border-t border-slate-800 flex flex-col gap-2 bg-slate-950/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center text-sm font-bold text-slate-200">
            {activeRole.name[0]}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white truncate">{activeRole.name}</p>
            <p className="text-xs text-slate-500">{activeRole.label}</p>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={() => onLogout?.()}
            className="w-full py-2 px-4 bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-500/30 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
