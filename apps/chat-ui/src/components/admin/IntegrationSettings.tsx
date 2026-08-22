import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export interface ProbeStepResult {
  step: string;
  status: 'passed' | 'failed' | 'skipped';
  latencyMs?: number;
  detail?: Record<string, any>;
  error?: {
    code: string;
    message: string;
    hint?: string;
  };
  skipReason?: string;
}

export interface TestConnectionResult {
  integrationCode: string;
  overallStatus: 'passed' | 'degraded' | 'failed';
  testedAt: string;
  durationMs: number;
  steps: ProbeStepResult[];
}

interface Integration {
  integration_code: string;
  is_active: boolean;
  apiUrl?: string;
  hasApiKey?: boolean;
  apiKeyMasked?: string;
  last_tested_at?: string | null;
  last_test_status?: 'passed' | 'degraded' | 'failed' | null;
  last_test_detail?: ProbeStepResult[] | null;
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

const stepLabels: Record<string, string> = {
  'config': '1. Cấu hình thông số đầu vào',
  'vault': '2. Truy xuất Secret từ Vault',
  'mcp-server': '3. Kiểm tra tiến trình MCP Server',
  'dns': '4. Phân giải tên miền (DNS Lookup)',
  'tcp': '5. Mở cổng kết nối mạng (TCP Socket)',
  'tls': '6. Bắt tay chứng chỉ bảo mật (TLS/SSL)',
  'http': '7. Xác thực & Phản hồi HTTP (Auth)',
  'business': '8. Xác thực dữ liệu nghiệp vụ'
};

// Lý do một bước bị bỏ qua — hiển thị rõ để admin không tưởng nhầm là lỗi
// (vd: connector nội bộ không gọi API ngoài nên các bước mạng không áp dụng)
const skipLabels: Record<string, string> = {
  'not_applicable': 'Không áp dụng',
  'previous_step_failed': 'Bỏ qua — bước trước lỗi'
};

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
  // apiKey = giá trị đang hiển thị trong ô nhập (ban đầu là dạng mask từ server,
  // vd "****abcd"); savedApiKeyMask = mask của khóa đã lưu để phân biệt user có
  // nhập khóa MỚI hay không. Secret thật không bao giờ được server trả về.
  const [apiKey, setApiKey] = useState('');
  const [savedApiKeyMask, setSavedApiKeyMask] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [savingIntegration, setSavingIntegration] = useState(false);

  // Test Connection State
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

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

  // Đồng bộ form từ dữ liệu server: apiKey hiển thị dạng mask nếu đã có khóa lưu
  const syncFormFromConfig = (config?: Integration) => {
    setIsActive(Boolean(config?.is_active));
    setApiUrl(config?.apiUrl || '');
    const mask = config?.hasApiKey ? (config?.apiKeyMasked || '') : '';
    setSavedApiKeyMask(mask);
    setApiKey(mask);
    setShowApiKey(false);
  };

  // Khóa MỚI user thực sự nhập (khác mask đang lưu) — chỉ gửi đi khi có giá trị này
  const newApiKey = apiKey && apiKey !== savedApiKeyMask ? apiKey : '';

  const fetchIntegrations = async (opts?: { keepForm?: boolean }) => {
    try {
      const token = authToken || localStorage.getItem('auth_token');
      const res = await fetch('/api/admin/integrations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Không thể tải cấu hình kết nối');
      const data = await res.json();
      setIntegrations(data.integrations || []);

      // keepForm: chỉ cập nhật danh sách (chấm trạng thái), GIỮ NGUYÊN form đang
      // nhập — dùng sau khi Test để không làm mất khóa mới người dùng vừa gõ.
      if (!opts?.keepForm) {
        const current = data.integrations?.find((i: any) => i.integration_code === selectedIntegration);
        syncFormFromConfig(current);
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
    setTestResult(null);

    const existing = integrations.find(i => i.integration_code === code);
    syncFormFromConfig(existing);
    if (existing?.last_test_detail) {
      setTestResult({
        integrationCode: code,
        overallStatus: existing.last_test_status || 'passed',
        testedAt: existing.last_tested_at || new Date().toISOString(),
        durationMs: 0,
        steps: existing.last_test_detail
      });
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setError(null);
    setSuccessMsg('');

    try {
      const token = authToken || localStorage.getItem('auth_token');
      const savedConfig = integrations.find(i => i.integration_code === selectedIntegration);
      // Chỉ tính là draft khi user nhập THÔNG TIN MỚI (khóa khác mask đang lưu,
      // hoặc URL khác URL đã lưu) — giá trị mask trong ô nhập không phải secret thật
      const urlChanged = Boolean(apiUrl && apiUrl !== savedConfig?.apiUrl);
      const isDraft = Boolean(newApiKey || urlChanged);

      let res: Response;
      if (isDraft) {
        res = await fetch('/api/admin/integrations/test', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            integrationCode: selectedIntegration,
            apiUrl: apiUrl || undefined,
            apiKey: newApiKey || undefined
          })
        });
      } else {
        res = await fetch(`/api/admin/integrations/${selectedIntegration}/test`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Lỗi kiểm tra kết nối (HTTP ${res.status})`);
      }

      const data: TestConnectionResult = await res.json();
      setTestResult(data);

      // Test dùng khóa mới người dùng vừa gõ nhưng KHÔNG tự lưu — nhắc rõ để
      // tránh tưởng nhầm đã ghi vào Vault
      const unsavedKeyHint = newApiKey
        ? ' Lưu ý: khóa MỚI chưa được lưu vào Vault — bấm "Lưu cấu hình" để ghi.'
        : '';
      if (data.overallStatus === 'passed') {
        setSuccessMsg(`Kiểm tra kết nối "${selectedIntegration.toUpperCase()}" thành công toàn bộ các bước!${unsavedKeyHint}`);
      } else if (data.overallStatus === 'degraded') {
        setSuccessMsg(`Kết nối "${selectedIntegration.toUpperCase()}" khả dụng nhưng có cảnh báo.${unsavedKeyHint}`);
      } else {
        setError(`Kiểm tra kết nối "${selectedIntegration.toUpperCase()}" thất bại. Vui lòng xem chi tiết từng bước bên dưới.`);
      }

      // Chỉ refresh chấm trạng thái, không đè form (giữ khóa mới đã gõ)
      await fetchIntegrations({ keepForm: true });
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi khi kiểm tra kết nối.');
    } finally {
      setTestingConnection(false);
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
          // Chỉ gửi khóa khi user nhập khóa MỚI — mask hiển thị không phải secret thật,
          // gửi đi sẽ ghi đè khóa đúng trong Vault
          apiKey: newApiKey || undefined,
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
      // Tải lại để nhận mask mới (nếu vừa đổi khóa) và đồng bộ form
      await fetchIntegrations();
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
    // Xác nhận khi TẮT tích hợp — tránh admin vô tình gạt làm ngắt luồng chat
    // đang dùng connector này. Bật lại thì không cần hỏi.
    if (!checked) {
      const name = availableIntegrations.find(i => i.code === selectedIntegration)?.name || selectedIntegration;
      const ok = window.confirm(
        `Bạn có muốn TẮT tích hợp "${name}" không?\n\n` +
        'Các luồng trò chuyện sử dụng tích hợp này sẽ không gọi được tool cho đến khi bật lại. ' +
        '(Nhớ bấm "Lưu cấu hình" để áp dụng.)'
      );
      if (!ok) return;
    }
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
      <div className="relative w-full max-w-5xl h-[650px] bg-surface border border-hair rounded-lg overflow-hidden flex animate-in zoom-in-95 duration-150">

        {/* Left Navigation Sidebar (Matching Image 2 Layout) */}
        <div className="w-56 bg-ink/90 border-r border-hair p-5 flex flex-col justify-between shrink-0">
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
              <div className="flex gap-8">
                {/* Left Service List */}
                <div className="w-[280px] shrink-0 border-r border-hair pr-6 space-y-2.5">
                  <div className="flex items-center justify-between px-1 mb-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Hệ thống Doanh nghiệp</p>
                    <span className="text-[10px] text-ink-3 font-mono">4 dịch vụ</span>
                  </div>
                  {availableIntegrations.map((item) => {
                    const config = integrations.find(i => i.integration_code === item.code);

                    const isSelected = selectedIntegration === item.code;
                    const testStatusText =
                      config?.last_test_status === 'passed' ? 'Hoạt động bình thường (lần kiểm tra gần nhất đạt)'
                      : config?.last_test_status === 'degraded' ? 'Kết nối được nhưng có cảnh báo'
                      : config?.last_test_status === 'failed' ? 'Lần kiểm tra gần nhất THẤT BẠI'
                      : 'Chưa kiểm tra kết nối';
                    const statusTitle = testStatusText +
                      (config?.last_tested_at ? ` — ${new Date(config.last_tested_at).toLocaleString('vi-VN')}` : '');

                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => handleSelectIntegration(item.code)}
                        className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all text-left cursor-pointer border ${
                          isSelected
                            ? 'bg-brass/10 border-brass/40 shadow-sm text-ink-1'
                            : 'border-transparent text-ink-2 hover:bg-surface-raised hover:text-ink-1 hover:border-hair'
                        }`}
                      >
                        <span className={`text-[13px] font-medium leading-none whitespace-nowrap mr-3 ${isSelected ? 'text-brass font-semibold' : 'text-ink-1'}`}>
                          {item.name}
                        </span>

                        {/* Status Dot — chỉ chấm màu, di chuột xem chi tiết */}
                        <span
                          className={`shrink-0 w-2 h-2 rounded-full ${
                            config?.last_test_status === 'passed' ? 'bg-sage'
                            : config?.last_test_status === 'degraded' ? 'bg-amber-400'
                            : config?.last_test_status === 'failed' ? 'bg-clay'
                            : 'bg-ink-3/50'
                          }`}
                          title={statusTitle}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Right Configuration Form */}
                <div className="flex-1 min-w-0 flex flex-col">
                  {loadingIntegrations ? (
                    <div className="py-16 flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brass"></div>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveIntegration} className="space-y-6 flex flex-col justify-between h-full">
                      <div>
                        <div className="flex items-center justify-between pb-4 border-b border-hair">
                          <div>
                            <h3 className="text-lg font-bold text-ink-1 leading-tight">
                              {availableIntegrations.find(i => i.code === selectedIntegration)?.name}
                            </h3>
                            <p className="text-xs text-ink-3 mt-1">Cấu hình thông tin kết nối và khóa API bảo mật</p>
                          </div>

                          <div className="flex items-center bg-surface-raised/80 border border-hair px-4 py-2 rounded-xl shrink-0">
                            <label className="relative inline-flex items-center cursor-pointer" title={isActive ? 'Đang hoạt động — bấm để tắt' : 'Đang tắt — bấm để bật'}>
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={isActive}
                                onChange={(e) => handleToggleActive(e.target.checked)}
                              />
                              <div className="w-11 h-6 bg-surface-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sage border border-hair"></div>
                            </label>
                          </div>
                        </div>

                        <div className="space-y-4 pt-5">
                          <div>
                            <label className="block text-xs font-semibold text-ink-2 mb-2">Endpoint URL (API Base URL)</label>
                            <input
                              type="url"
                              value={apiUrl}
                              onChange={(e) => setApiUrl(e.target.value)}
                              placeholder="https://api.example.com..."
                              className="w-full bg-ink border border-hair rounded-xl px-4 py-3 text-ink-1 placeholder-ink-3 focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-ink-2 mb-2">API Key / Token (Vault Security)</label>
                            <div className="relative">
                              <input
                                type={showApiKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Bỏ trống nếu không muốn thay đổi..."
                                autoComplete="off"
                                className="w-full bg-ink border border-hair rounded-xl pl-4 pr-11 py-3 text-ink-1 placeholder-ink-3 focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all text-sm"
                              />
                              {apiKey && (
                                <button
                                  type="button"
                                  onClick={() => setShowApiKey(s => !s)}
                                  title={showApiKey ? 'Ẩn khóa' : 'Hiện khóa'}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-brass transition-colors cursor-pointer"
                                >
                                  {showApiKey ? (
                                    <svg className="w-4.5 h-4.5" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4.5 h-4.5" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  )}
                                </button>
                              )}
                            </div>
                            {savedApiKeyMask && (
                              <p className="text-[11px] text-ink-3 mt-1.5 leading-relaxed">
                                Khóa đã lưu dạng rút gọn — server không bao giờ trả secret thật.
                                Chỉ nhập lại khi muốn thay đổi; xóa trắng ô này nghĩa là giữ nguyên khóa cũ.
                              </p>
                            )}
                          </div>

                          <p className="text-xs text-ink-3 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-brass shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Thông tin kết nối được mã hóa và bảo mật hai lớp bằng HashiCorp Vault.
                          </p>

                          {selectedIntegration === 'erpnext' && (
                            <div className="p-3 bg-brass/10 border border-brass/25 rounded-xl text-xs text-ink-2 leading-relaxed">
                              <span className="font-semibold text-brass">Lưu ý Frappe Cloud:</span> Nhập kết hợp cả API Key và API Secret theo định dạng: <code className="bg-surface-raised px-1.5 py-0.5 rounded text-brass font-mono">&lt;api_key&gt;:&lt;api_secret&gt;</code> (Ví dụ: <code className="bg-surface-raised px-1.5 py-0.5 rounded text-brass font-mono">93b68c02976a26e:a1b2c3d4e5f6</code>).
                            </div>
                          )}

                          {/* Probe Checklist Results Card */}
                          {testResult && (
                            <div className="mt-4 p-3.5 bg-surface-raised/40 border border-hair rounded-xl space-y-2">
                              <div className="flex items-center justify-between pb-2 border-b border-hair">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2.5 h-2.5 rounded-full ${
                                    testResult.overallStatus === 'passed' ? 'bg-sage' : testResult.overallStatus === 'degraded' ? 'bg-amber-400' : 'bg-clay'
                                  }`} />
                                  <span className="text-xs font-bold text-ink-1">
                                    Kết quả kiểm tra chuỗi Probe ({testResult.steps.filter(s => s.status === 'passed').length}/{testResult.steps.filter(s => s.status !== 'skipped').length} bước áp dụng đạt)
                                  </span>
                                </div>
                                <span className="text-[11px] font-mono text-ink-3">
                                  Tổng thời gian: {testResult.durationMs}ms
                                </span>
                              </div>

                              <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                                {testResult.steps.map((st, idx) => {
                                  const isPass = st.status === 'passed';
                                  const isFail = st.status === 'failed';

                                  return (
                                    <div key={idx} className={`p-2 rounded-lg text-xs border ${
                                      isPass ? 'bg-sage/5 border-sage/20 text-ink-1' :
                                      isFail ? 'bg-clay/10 border-clay/30 text-ink-1' :
                                      'bg-surface/60 border-hair text-ink-3'
                                    }`}>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className={`font-bold ${isPass ? 'text-sage' : isFail ? 'text-clay' : 'text-ink-3'}`}>
                                            {isPass ? '✓' : isFail ? '✗' : '—'}
                                          </span>
                                          <span className="font-semibold text-[11px]">
                                            {stepLabels[st.step] || st.step}
                                          </span>
                                        </div>
                                        <span className="text-[10px] font-mono text-ink-3">
                                          {st.latencyMs !== undefined ? `${st.latencyMs}ms` : (st.skipReason ? (skipLabels[st.skipReason] || 'Bỏ qua') : '')}
                                        </span>
                                      </div>

                                      {isFail && st.error && (
                                        <div className="mt-2 pt-1.5 border-t border-clay/20 text-[11px] space-y-1">
                                          <div className="text-clay font-medium flex items-center gap-1">
                                            <span>Lỗi [{st.error.code}]:</span> {st.error.message}
                                          </div>
                                          {st.error.hint && (
                                            <div className="p-2 bg-clay/15 border border-clay/25 rounded text-ink-1 text-[11px] leading-relaxed">
                                              💡 <strong className="text-clay">Hướng dẫn khắc phục:</strong> {st.error.hint}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 flex items-center justify-between border-t border-hair/50 mt-4">
                        <button
                          type="button"
                          onClick={handleTestConnection}
                          disabled={testingConnection || savingIntegration}
                          className="px-5 py-2.5 bg-surface-raised hover:bg-hair border border-hair text-ink-1 rounded-xl font-semibold text-xs transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                        >
                          {testingConnection ? (
                            <>
                              <svg className="animate-spin h-3.5 w-3.5 text-brass" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Đang kiểm tra kết nối...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5 text-brass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              <span>Kiểm tra kết nối</span>
                            </>
                          )}
                        </button>

                        <button
                          type="submit"
                          disabled={savingIntegration || testingConnection}
                          className="px-8 py-2.5 bg-brass hover:bg-brass-hover text-ink-1 rounded-xl font-semibold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                        >
                          {savingIntegration && <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-ink-1" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                          Lưu cấu hình
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
