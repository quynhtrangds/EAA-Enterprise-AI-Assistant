import React, { createContext, useContext, useState, type ReactNode } from 'react';

interface AuthContextType {
  authToken: string | null;
  currentUser: any | null;
  login: (user: any, token: string) => void;
  logout: () => void;
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

  const login = (user: any, token: string) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('current_user', JSON.stringify(user));
    setAuthToken(token);
    setCurrentUser(user);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
    setAuthToken(null);
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ authToken, currentUser, login, logout }}>
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
