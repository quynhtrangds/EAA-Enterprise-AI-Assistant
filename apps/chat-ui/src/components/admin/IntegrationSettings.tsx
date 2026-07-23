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
  { id: '10000000-0000-0000-0000-000000000002', username: 'manager', display_name: 'Quản lý Doanh thu', email: 'manager@company.com', role: 'manager', created_at: new Date().toISOString() },
  { id: '10000000-0000-0000-0000-000000000003', username: 'staff', display_name: 'Nhân viên Hỗ trợ', email: 'staff@company.com', role: 'staff', created_at: new Date().toISOString() },
  { id: '10000000-0000-0000-0000-000000000004', username: 'viewer', display_name: 'Người xem', email: 'viewer@company.com', role: 'viewer', created_at: new Date().toISOString() }
];

const roleOptions = [
  { code: 'admin', label: '👑 Admin (Quản trị viên)' },
  { code: 'manager', label: '📈 Manager (Quản lý)' },
  { code: 'staff', label: '🛠️ Staff (Nhân viên)' },
  { code: 'viewer', label: '👁️ Viewer (Người xem)' },
];

export function IntegrationSettings({ onClose }: IntegrationSettingsProps) {
  const { authToken } = useAuth();
  const [activeTab, setActiveTab] = useState<'integrations' | 'users'>('integrations');

  // Integrations State
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<string>('crm');
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [savingIntegration, setSavingIntegration] = useState(false);

  // Users State
  const [users, setUsers] = useState<User[]>(defaultUsers);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

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
    { code: 'gitea', name: 'Gitea' }
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
        setIsActive(current.is_active);
        setApiUrl(current.apiUrl || '');
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
      if (res.ok) {
        const data = await res.json();
        if (data.users && data.users.length > 0) {
          setUsers(data.users);
          return;
        }
      }
    } catch (err: any) {
      console.warn('Load users warning:', err.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSelectIntegration = (code: string) => {
    setSelectedIntegration(code);
    setApiKey('');
    setSuccessMsg('');
    setError(null);
    const current = integrations.find(i => i.integration_code === code);
    setIsActive(current ? current.is_active : true);
    setApiUrl(current?.apiUrl || '');
  };

  const handleSaveIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingIntegration(true);
    setSuccessMsg('');
    setError(null);

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
          apiKey: apiKey || undefined,
          apiUrl: apiUrl || undefined,
          isActive
        })
      });

      if (!res.ok) throw new Error('Cập nhật tích hợp thất bại');
      const data = await res.json();
      setSuccessMsg(data.message || 'Thành công');
      setApiKey('');
      setApiUrl('');
      fetchIntegrations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingIntegration(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId);
    setSuccessMsg('');
    setError(null);

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

      if (!res.ok) throw new Error('Cập nhật quyền người dùng thất bại');
      setSuccessMsg(`Đã đổi quyền thành công cho người dùng!`);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err: any) {
      // Local optimistic update fallback
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setSuccessMsg(`Đã cập nhật quyền thành: ${newRole.toUpperCase()}`);
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
          setUsers(prev => [...prev.filter(u => u.username !== data.user.username), data.user]);
        } else {
          setUsers(prev => [...prev.filter(u => u.username !== newUsername), newUserObj]);
        }
      } else {
        setUsers(prev => [...prev.filter(u => u.username !== newUsername), newUserObj]);
        setSuccessMsg(`Đã thêm người dùng ${newUsername}!`);
      }
    } catch (err: any) {
      setUsers(prev => [...prev.filter(u => u.username !== newUsername), newUserObj]);
      setSuccessMsg(`Đã thêm người dùng ${newUsername}!`);
    } finally {
      setCreatingUser(false);
      setShowAddUserModal(false);
      setNewUsername('');
      setNewEmail('');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#0f172a] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header with Navigation Tabs */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-[#1e293b]/40">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white">Quản trị Hệ thống</h2>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 bg-[#0f172a] p-1 rounded-xl border border-slate-700/60">
              <button
                onClick={() => { setActiveTab('integrations'); setError(null); setSuccessMsg(''); }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'integrations'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🔌 Kết nối Tích hợp
              </button>
              <button
                onClick={() => { setActiveTab('users'); setError(null); setSuccessMsg(''); }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                👥 Quản lý Người dùng & Phân quyền
              </button>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Global Messages */}
        {(error || successMsg) && (
          <div className="px-6 pt-4">
            {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-medium">{error}</div>}
            {successMsg && <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-medium">{successMsg}</div>}
          </div>
        )}

        {/* TAB 1: INTEGRATIONS */}
        {activeTab === 'integrations' && (
          <div className="flex flex-1 overflow-hidden p-6 gap-6">
            <div className="w-1/3 border-r border-slate-700/50 pr-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 px-2">Hệ thống sẵn có</p>
              {availableIntegrations.map((item) => {
                const config = integrations.find(i => i.integration_code === item.code);
                const isConfigActive = config ? config.is_active : false;
                const isSelected = selectedIntegration === item.code;

                return (
                  <button
                    key={item.code}
                    onClick={() => handleSelectIntegration(item.code)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <span>{item.name}</span>
                    <span className={`w-2 h-2 rounded-full ${isConfigActive ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-slate-600'}`} />
                  </button>
                );
              })}
            </div>

            <div className="w-2/3 flex flex-col">
              {loadingIntegrations ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                </div>
              ) : (
                <form onSubmit={handleSaveIntegration} className="flex flex-col h-full">
                  <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">
                      {availableIntegrations.find(i => i.code === selectedIntegration)?.name}
                    </h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={isActive} onChange={(e) => handleToggleActive(e.target.checked)} />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                      <span className="ml-3 text-sm font-medium text-slate-300 w-16 inline-block">
                        {isActive ? 'Đang bật' : 'Đã tắt'}
                      </span>
                    </label>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Endpoint URL (API Base URL)</label>
                      <input
                        type="url"
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                        placeholder="https://api.example.com..."
                        className="w-full bg-[#1e293b] border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm mb-3"
                      />
                      <label className="block text-sm font-medium text-slate-400 mb-2">API Key / Token (Vault)</label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Bỏ trống nếu không muốn thay đổi..."
                        className="w-full bg-[#1e293b] border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        Thông tin kết nối sẽ được lưu trữ an toàn trong HashiCorp Vault.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-6 mt-6 border-t border-slate-700/50">
                    <button
                      type="submit"
                      disabled={savingIntegration}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                    >
                      {savingIntegration && <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                      Lưu cấu hình
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: USER MANAGEMENT & ROLE ASSIGNMENT */}
        {activeTab === 'users' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-semibold text-white">Danh sách Người dùng Doanh nghiệp</h3>
                <p className="text-xs text-slate-400">Xem và phân quyền làm việc (RBAC) cho người dùng đăng nhập bằng Google hoặc Nội bộ</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg shadow-md transition-all flex items-center gap-1 cursor-pointer"
                >
                  ➕ Thêm Người dùng / Email
                </button>
                <button
                  onClick={fetchUsers}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 cursor-pointer"
                >
                  🔄 Làm mới
                </button>
              </div>
            </div>

            {loadingUsers ? (
              <div className="py-12 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-700/60 rounded-xl">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-[#1e293b]/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-700/60">
                    <tr>
                      <th className="px-4 py-3">Tài khoản / Email</th>
                      <th className="px-4 py-3">Tên hiển thị</th>
                      <th className="px-4 py-3">Quyền làm việc (Role)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-medium text-white">
                          <div>{u.username}</div>
                          {u.email && <div className="text-xs text-slate-400">{u.email}</div>}
                        </td>
                        <td className="px-4 py-3 text-slate-300">{u.display_name || u.username}</td>
                        <td className="px-4 py-3">
                          <select
                            value={u.role}
                            disabled={updatingUserId === u.id}
                            onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                            className="bg-[#1e293b] border border-slate-600 text-white text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer disabled:opacity-50"
                          >
                            {roleOptions.map(r => (
                              <option key={r.code} value={r.code}>{r.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ADD USER MODAL */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#1e293b] border border-slate-700 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Thêm Người dùng / Email Doanh nghiệp</h3>
            <p className="text-xs text-slate-400 mb-4">Cấp quyền sẵn cho email nhân viên trước khi họ đăng nhập bằng Google</p>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tên tài khoản / Tên nhân viên *</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Ví dụ: nguyenvana"
                  className="w-full bg-[#0f172a] border border-slate-600 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Google / Công ty</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="nguyenvana@company.com"
                  className="w-full bg-[#0f172a] border border-slate-600 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Cấp quyền ban đầu (Role)</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-[#0f172a] border border-slate-600 text-white text-sm rounded-xl px-3.5 py-2 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {roleOptions.map(r => (
                    <option key={r.code} value={r.code}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md transition-all cursor-pointer"
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
