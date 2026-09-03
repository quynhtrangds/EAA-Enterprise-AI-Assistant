import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface AuthContextType {
  authToken: string | null;
  currentUser: any | null;
  sessionExpiredNotice: string | null;
  login: (user: any, token: string) => void;
  logout: (notice?: string) => void;
  clearNotice: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem('current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(null);

  const login = (user: any, token: string) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('current_user', JSON.stringify(user));
    setAuthToken(token);
    setCurrentUser(user);
    setSessionExpiredNotice(null);
  };

  const logout = (notice?: string) => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
    setAuthToken(null);
    setCurrentUser(null);
    setSessionExpiredNotice(notice || null);
  };

  const clearNotice = () => {
    setSessionExpiredNotice(null);
  };

  // Kiem tra tinh hop le cua token khi mount (neu co token trong localStorage)
  useEffect(() => {
    if (!authToken) return;
    fetch('/api/me', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
      .then(res => {
        if (res.status === 401) {
          logout('Phiên đăng nhập của bạn đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.');
        }
      })
      .catch(() => {
        // Neu mat mang hoac backend offline, giu nguyen trang thai
      });
  }, [authToken]);

  return (
    <AuthContext.Provider value={{ authToken, currentUser, sessionExpiredNotice, login, logout, clearNotice }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
