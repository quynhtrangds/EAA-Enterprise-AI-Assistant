import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface Integration {
  integration_code: string;
  is_active: boolean;
  apiUrl?: string;
}

interface User {
  id: string;
  username: string;
  display_name: string;
  email?: string;
  role: string;
  created_at: string;
}

interface IntegrationSettingsProps {
  onClose: () => void;
}

const defaultUsers: User[] = [
  { id: '10000000-0000-0000-0000-000000000001', username: 'admin', display_name: 'Quản trị viên', email: 'admin@company.com', role: 'admin', created_at: new Date().toISOString() },
  { id: '10000000-0000-0000-0000-000000000002', username: 'manager', display_name: 'Quản lý', email: 'manager@company.com', role: 'manager', created_at: new Date().toISOString() },
  { id: '10000000-0000-0000-0000-000000000003', username: 'staff', display_name: 'Nhân viên', email: 'staff@company.com', role: 'staff', created_at: new Date().toISOString() },
];

const roleOptions = [
  { code: 'admin', label: 'Admin' },
  { code: 'manager', label: 'Quản lý' },
  { code: 'staff', label: 'Nhân viên' },
];

export function IntegrationSettings({ onClose }: IntegrationSettingsProps) {
  const { authToken, currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'integrations' | 'users'>('integrations');

  // Integrations State
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<string>('crm');
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [savingIntegration, setSavingIntegration] = useState(false);

  // Users State
  const [users, setUsers] = useState<User[]>(defaultUsers);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Users Search & Filter State
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [showToolMatrixInfo, setShowToolMatrixInfo] = useState(false);

  const filteredUsers = (users || []).filter(u => {
    const queryStr = userSearchQuery.trim().toLowerCase();
    const matchesSearch = !queryStr ||
      (u.username || '').toLowerCase().includes(queryStr) ||
      (u.display_name || '').toLowerCase().includes(queryStr) ||
      (u.email || '').toLowerCase().includes(queryStr);
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  // Add User Form State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('staff');
  const [creatingUser, setCreatingUser] = useState(false);

  // Global Messages
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const availableIntegrations = [
    { code: 'crm', name: 'CRM (Salesforce / HubSpot)' },
    { code: 'erpnext', name: 'ERPNext' },
    { code: 'zammad', name: 'Zammad Helpdesk' },
    { code: 'gitea', name: 'Gitea Code Server' }
  ];

  useEffect(() => {
    fetchIntegrations();
    fetchUsers();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const token = authToken || localStorage.getItem('auth_token');
      const res = await fetch('/api/admin/integrations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Không thể tải cấu hình kết nối');
      const data = await res.json();
      setIntegrations(data.integrations || []);

      const current = data.integrations?.find((i: any) => i.integration_code === selectedIntegration);
      if (current) {
        setIsActive(Boolean(current.is_active));
        setApiUrl(current.apiUrl || '');
      } else {
        setIsActive(false);
        setApiUrl('');
      }
    } catch (err: any) {
      console.warn('Load integrations warning:', err.message);
    } finally {
      setLoadingIntegrations(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const token = authToken || localStorage.getItem('auth_token');
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Không thể tải danh sách người dùng');
      const data = await res.json();
      if (data.users && Array.isArray(data.users)) {
        setUsers(data.users);
      }
    } catch (err: any) {
      console.warn('Load users warning:', err.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSelectIntegration = (code: string) => {
    setSelectedIntegration(code);
    setError(null);
    setSuccessMsg('');
    setApiKey('');

    const existing = integrations.find(i => i.integration_code === code);
    if (existing) {
      setIsActive(Boolean(existing.is_active));
      setApiUrl(existing.apiUrl || '');
    } else {
      setIsActive(false);
      setApiUrl('');
    }
  };

  const handleSaveIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingIntegration(true);
    setError(null);
    setSuccessMsg('');

    try {
      const token = authToken || localStorage.getItem('auth_token');
      const res = await fetch('/api/admin/integrations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          integrationCode: selectedIntegration,
          apiKey,
          apiUrl,
          isActive
        })
      });

      if (!res.ok) throw new Error('Cập nhật cấu hình thất bại');
      const data = await res.json();

      setIntegrations(prev => {
        const exists = prev.some(i => i.integration_code === selectedIntegration);
        if (exists) {
          return prev.map(i => i.integration_code === selectedIntegration ? { ...i, is_active: isActive, apiUrl } : i);
        }
        return [...prev, { integration_code: selectedIntegration, is_active: isActive, apiUrl }];
      });

      setSuccessMsg(data.message || 'Đã lưu cấu hình thành công!');
      setApiKey('');
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi khi lưu cấu hình');
    } finally {
      setSavingIntegration(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId);
    setError(null);
    setSuccessMsg('');

    try {
      const token = authToken || localStorage.getItem('auth_token');
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Cập nhật quyền người dùng thất bại.');
      }
      setSuccessMsg(`Đã đổi quyền thành công cho người dùng!`);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi khi cập nhật quyền người dùng.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername) return;
    setCreatingUser(true);
    setError(null);
    setSuccessMsg('');

    const newUserObj: User = {
      id: `user-${Date.now()}`,
      username: newUsername,
      display_name: newUsername,
      email: newEmail || `${newUsername}@company.com`,
      role: newRole,
      created_at: new Date().toISOString()
    };

    try {
      const token = authToken || localStorage.getItem('auth_token');
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: newUsername,
          email: newEmail,
          displayName: newUsername,
          role: newRole
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(`Đã thêm thành công người dùng ${newUsername}!`);
        if (data.user) {
          setUsers(prev => [...prev.filter(u => u.username !== data.user.username && u.id !== data.user.id), data.user]);
        } else {
          setUsers(prev => [...prev.filter(u => u.username !== newUsername), newUserObj]);
        }
        setShowAddUserModal(false);
        setNewUsername('');
        setNewEmail('');
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || 'Không thể thêm người dùng. Bạn cần đăng nhập tài khoản Admin.');
      }
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi khi thêm người dùng.');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa người dùng "${username}" khỏi hệ thống?`)) return;

    setError(null);
    setSuccessMsg('');

    try {
      const token = authToken || localStorage.getItem('auth_token');
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== userId && u.username !== username));
        setSuccessMsg(`Đã xóa người dùng "${username}" thành công!`);
        await fetchUsers();
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || 'Xóa người dùng thất bại. Bạn cần quyền Admin.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi kết nối đến máy chủ.');
    }
  };

  const handleToggleActive = (checked: boolean) => {
    setIsActive(checked);
    setIntegrations(prev => {
      const exists = prev.some(i => i.integration_code === selectedIntegration);
      if (exists) {
        return prev.map(i => i.integration_code === selectedIntegration ? { ...i, is_active: checked } : i);
      } else {
        return [...prev, { integration_code: selectedIntegration, is_active: checked }];
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in duration-200 p-4">
      <div className="relative w-full max-w-4xl h-[620px] bg-surface border border-hair rounded-lg overflow-hidden flex animate-in zoom-in-95 duration-150">

        {/* Left Navigation Sidebar (Matching Image 2 Layout) */}
        <div className="w-64 bg-ink/90 border-r border-hair p-5 flex flex-col justify-between shrink-0">
          <div>
            {/* Top Close Button (x) */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-surface-raised hover:bg-hair text-ink-2 hover:text-ink-1 flex items-center justify-center transition-colors mb-6 cursor-pointer"
              title="Đóng Cài đặt"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <p className="text-[11px] font-bold text-ink-3 uppercase tracking-wider mb-3 px-1">Cài đặt Hệ thống</p>

            {/* Vertical Tabs Navigation List */}
            <div className="space-y-1">
              <button
                onClick={() => { setActiveTab('integrations'); setError(null); setSuccessMsg(''); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left cursor-pointer ${activeTab === 'integrations'
                  ? 'bg-surface-raised text-ink-1 font-semibold'
                  : 'text-ink-2 hover:text-ink-1 hover:bg-surface-raised/60'
                  }`}
              >
                <svg className="w-4 h-4 text-brass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <span>Kết nối Tích hợp</span>
              </button>

              <button
                onClick={() => { setActiveTab('users'); setError(null); setSuccessMsg(''); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left cursor-pointer ${activeTab === 'users'
                  ? 'bg-surface-raised text-ink-1 font-semibold'
                  : 'text-ink-2 hover:text-ink-1 hover:bg-surface-raised/60'
                  }`}
              >
                <svg className="w-4 h-4 text-brass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>Phân quyền</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-hair">
            <p className="text-[11px] text-ink-3 font-medium">Enterprise Assistant v1.0</p>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 bg-surface p-8 overflow-y-auto flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink-1 mb-6">
              {activeTab === 'integrations' ? 'Kết nối Tích hợp' : 'Phân quyền'}
            </h2>

            {/* Global Error/Success Messages */}
            {(error || successMsg) && (
              <div className="mb-6">
                {error && <div className="p-3.5 bg-clay/10 border border-clay/25 text-clay rounded-xl text-sm font-medium">{error}</div>}
                {successMsg && <div className="p-3.5 bg-brass/10 border border-brass/25 text-brass rounded-xl text-sm font-medium">{successMsg}</div>}
              </div>
            )}

            {/* TAB 1: INTEGRATIONS */}
            {activeTab === 'integrations' && (
              <div className="flex gap-6">
                <div className="w-1/3 border-r border-hair pr-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-3 px-1">Hệ thống Doanh nghiệp</p>
                  {availableIntegrations.map((item) => {
                    const config = integrations.find(i => i.integration_code === item.code);
                    const isConfigActive = config ? config.is_active : false;
                    const isSelected = selectedIntegration === item.code;

                    return (
                      <button
                        key={item.code}
                        onClick={() => handleSelectIntegration(item.code)}
                        className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all text-left cursor-pointer ${isSelected
                          ? 'bg-brass/15 text-brass border border-brass/40'
                          : 'text-ink-2 hover:bg-surface-raised hover:text-ink-1'
                          }`}
                      >
                        <span>{item.name}</span>
                        <span className={`w-2.5 h-2.5 rounded-full ${isConfigActive ? 'bg-sage ' : 'bg-slate-600'}`} />
                      </button>
                    );
                  })}
                </div>

                <div className="w-2/3 flex flex-col">
                  {loadingIntegrations ? (
                    <div className="py-12 flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brass"></div>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveIntegration} className="space-y-5">
                      <div className="flex items-center justify-between pb-4 border-b border-hair">
                        <h3 className="text-base font-semibold text-ink-1">
                          {availableIntegrations.find(i => i.code === selectedIntegration)?.name}
                        </h3>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={isActive} onChange={(e) => handleToggleActive(e.target.checked)} />
                          <div className="w-11 h-6 bg-surface-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sage"></div>
                          <span className="ml-3 text-xs font-semibold text-ink-2 w-16 inline-block">
                            {isActive ? 'Đang bật' : 'Đã tắt'}
                          </span>
                        </label>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-ink-2 mb-2">Endpoint URL (API Base URL)</label>
                        <input
                          type="url"
                          value={apiUrl}
                          onChange={(e) => setApiUrl(e.target.value)}
                          placeholder="https://api.example.com..."
                          className="w-full bg-ink border border-hair rounded-xl px-4 py-2.5 text-ink-1 placeholder-ink-3 focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all text-sm mb-4"
                        />
                        <label className="block text-xs font-semibold text-ink-2 mb-2">API Key / Token (Vault Security)</label>
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Bỏ trống nếu không muốn thay đổi..."
                          className="w-full bg-ink border border-hair rounded-xl px-4 py-2.5 text-ink-1 placeholder-ink-3 focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all text-sm"
                        />
                        <p className="mt-2 text-xs text-ink-3">
                          Thông tin kết nối được bảo mật hai lớp bằng HashiCorp Vault.
                        </p>
                        {selectedIntegration === 'erpnext' && (
                          <p className="mt-2 text-xs text-brass font-medium">
                            Đối với Frappe Cloud, bạn cần nhập kết hợp cả API Key và API Secret theo định dạng: <span className="bg-surface-raised px-1.5 py-0.5 rounded text-ink-1 font-mono">&lt;api_key&gt;:&lt;api_secret&gt;</span> (Ví dụ: <span className="bg-surface-raised px-1.5 py-0.5 rounded text-brass font-mono">93b68c02976a26e:a1b2c3d4e5f6</span>).
                          </p>
                        )}
                      </div>

                      <div className="pt-4 flex justify-end">
                        <button
                          type="submit"
                          disabled={savingIntegration}
                          className="px-6 py-2.5 bg-brass hover:bg-brass-hover text-ink-1 rounded-xl font-semibold text-sm shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                        >
                          {savingIntegration && <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-ink-1" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                          Lưu kết nối
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: USERS & ROLES */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-hair">
                  <div>
                    <h3 className="text-sm font-semibold text-ink-1 flex items-center gap-2">
                      Danh sách Phân quyền (RBAC)
                      <button
                        type="button"
                        onClick={() => setShowToolMatrixInfo(!showToolMatrixInfo)}
                        className="text-xs font-normal text-brass hover:text-brass bg-brass/10 hover:bg-brass/15 px-2 py-0.5 rounded-md border border-brass/25 transition-all cursor-pointer"
                        title="Xem ma trận quyền hạn các vai trò"
                      >
                        Chi tiết quyền hạn
                      </button>
                    </h3>
                    <p className="text-xs text-ink-2">Phân quyền trực tiếp cho từng người dùng hệ thống</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAddUserModal(true)}
                      className="text-xs font-semibold text-ink-1 bg-brass hover:bg-brass-hover px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      Thêm người dùng
                    </button>
                  </div>
                </div>

                {/* Tool Matrix Info Drawer */}
                {showToolMatrixInfo && (
                  <div className="p-3.5 bg-surface-raised border border-brass/25 rounded-xl space-y-2 text-xs text-ink-2">
                    <div className="font-semibold text-brass flex items-center justify-between">
                      <span>Vai trò & phạm vi truy vấn công cụ</span>
                      <button onClick={() => setShowToolMatrixInfo(false)} className="text-ink-2 hover:text-ink-1 cursor-pointer">✕</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11.5px]">
                      <div className="p-2 bg-ink rounded-lg border border-hair/50">
                        <span className="font-bold text-brass">Admin —</span> Toàn quyền cấu hình hệ thống & truy vấn tất cả công cụ (ERPNext, CRM, Gitea, Zammad, Postgres, RAG).
                      </div>
                      <div className="p-2 bg-ink rounded-lg border border-hair/50">
                        <span className="font-bold text-ink-1">Quản lý —</span> Xem báo cáo doanh thu tổng hợp, hóa đơn bán/mua ERPNext, cơ hội kinh doanh CRM & hỗ trợ Zammad.
                      </div>
                      <div className="p-2 bg-ink rounded-lg border border-hair/50">
                        <span className="font-bold text-brass">Nhân viên —</span> Tra cứu tồn kho, thông tin khách hàng, chi tiết đơn hàng & phiếu hỗ trợ kỹ thuật.
                      </div>
                    </div>
                  </div>
                )}

                {/* Search & Filter Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      placeholder="Tìm kiếm theo tên hoặc email..."
                      className="w-full bg-ink border border-hair focus:border-brass text-xs text-ink-1 rounded-xl px-3.5 py-2 focus:outline-none transition-colors"
                    />
                    {userSearchQuery && (
                      <button
                        onClick={() => setUserSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-2 hover:text-ink-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-2 font-medium">Lọc vai trò:</span>
                    <select
                      value={userRoleFilter}
                      onChange={(e) => setUserRoleFilter(e.target.value)}
                      className="bg-surface border border-hair text-xs font-medium text-ink-1 rounded-xl px-3 py-2 focus:outline-none focus:border-brass cursor-pointer"
                    >
                      <option value="all" className="bg-surface text-ink-1">Tất cả vai trò</option>
                      <option value="admin" className="bg-surface text-ink-1">Admin</option>
                      <option value="manager" className="bg-surface text-ink-1">Quản lý</option>
                      <option value="staff" className="bg-surface text-ink-1">Nhân viên</option>
                    </select>
                  </div>
                </div>

                {loadingUsers ? (
                  <div className="py-12 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brass"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-hair rounded-lg">
                    <table className="w-full text-left text-sm text-ink-2">
                      <thead className="bg-ink text-xs uppercase font-semibold text-ink-2 border-b border-hair">
                        <tr>
                          <th className="px-4 py-3">Tài khoản / Email</th>
                          <th className="px-4 py-3">Tên hiển thị</th>
                          <th className="px-4 py-3">Quyền hạn (Role)</th>
                          <th className="px-4 py-3 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hair bg-surface">
                        {filteredUsers.map(u => {
                          const isSelf = currentUser && (
                            u.id === currentUser.id ||
                            u.username === currentUser.username ||
                            (u.email && currentUser.email && u.email === currentUser.email)
                          );
                          const isAdminRole = u.role === 'admin' || u.username === 'admin' || u.id === '10000000-0000-0000-0000-000000000001';
                          const cannotBeDeleted = isSelf || isAdminRole;

                          return (
                            <tr key={u.id} className="hover:bg-surface-raised/60 transition-colors">
                              <td className="px-4 py-3 font-medium text-ink-1">
                                <div>{u.username}</div>
                                {u.email && <div className="text-xs text-ink-2">{u.email}</div>}
                              </td>
                              <td className="px-4 py-3 text-ink-2">{u.display_name || u.username}</td>
                              <td className="px-4 py-3">
                                <select
                                  value={u.role}
                                  disabled={updatingUserId === u.id || u.role === 'admin'}
                                  onChange={(e) => {
                                    const targetRole = e.target.value;
                                    const roleLabel = roleOptions.find(r => r.code === targetRole)?.label || targetRole;
                                    const userName = u.display_name || u.username;
                                    if (window.confirm(`Bạn có chắc chắn muốn đổi quyền của người dùng "${userName}" sang vai trò "${roleLabel}" không?`)) {
                                      handleUpdateRole(u.id, targetRole);
                                    }
                                  }}
                                  className="bg-surface border border-hair text-ink-1 text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:border-brass cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                  title={u.role === 'admin' ? 'Tài khoản Quản trị viên (Admin) không thể hạ quyền.' : 'Thay đổi quyền hạn'}
                                >
                                  {roleOptions.map(r => (
                                    <option key={r.code} value={r.code} className="bg-surface text-ink-1 py-1 font-normal">
                                      {r.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {!cannotBeDeleted ? (
                                  <button
                                    onClick={() => handleDeleteUser(u.id, u.username)}
                                    className="p-1.5 text-ink-2 hover:text-clay hover:bg-clay/10 rounded-lg transition-colors cursor-pointer"
                                    title="Xóa người dùng"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                ) : isSelf ? (
                                  <span className="text-[11px] text-ink-3 italic pr-2" title="Không thể xóa tài khoản đang đăng nhập">
                                    Đang sử dụng
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-ink-3 italic pr-2" title="Tài khoản Quản trị viên không thể bị xóa">
                                    Cố định
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ADD USER MODAL */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface border border-hair rounded-lg p-6">
            <h3 className="text-lg font-bold text-ink-1 mb-1">Thêm Người dùng Doanh nghiệp</h3>
            <p className="text-xs text-ink-2 mb-5">Cấp quyền trước cho email nhân viên trước khi đăng nhập</p>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1.5">Tên tài khoản *</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Ví dụ: nguyenvana"
                  className="w-full bg-ink border border-hair rounded-xl px-3.5 py-2.5 text-ink-1 text-sm focus:outline-none focus:border-brass"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1.5">Email Công ty / Google</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="nguyenvana@company.com"
                  className="w-full bg-ink border border-hair rounded-xl px-3.5 py-2.5 text-ink-1 text-sm focus:outline-none focus:border-brass"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1.5">Vai trò (Role)</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-ink border border-hair text-ink-1 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-brass cursor-pointer"
                >
                  {roleOptions.map(r => (
                    <option key={r.code} value={r.code}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-5 border-t border-hair">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-ink-2 hover:text-ink-1 rounded-xl hover:bg-surface-raised transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-5 py-2 text-xs font-semibold bg-brass hover:bg-brass-hover text-ink-1 rounded-xl transition-all cursor-pointer"
                >
                  Thêm Người dùng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
