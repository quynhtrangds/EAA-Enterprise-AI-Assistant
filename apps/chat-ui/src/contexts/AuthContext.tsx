import React, { createContext, useContext, useState, type ReactNode } from 'react';

interface AuthContextType {
  authToken: string | null;
  currentUser: string | null;
  login: (username: string, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('chat_auth_token'));
  const [currentUser, setCurrentUser] = useState<string | null>(() => localStorage.getItem('chat_current_user'));

  const login = (username: string, token: string) => {
    setAuthToken(token);
    setCurrentUser(username);
    localStorage.setItem('chat_auth_token', token);
    localStorage.setItem('chat_current_user', username);
  };

  const logout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    localStorage.removeItem('chat_auth_token');
    localStorage.removeItem('chat_current_user');
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
