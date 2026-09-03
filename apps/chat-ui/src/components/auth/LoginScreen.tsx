import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';

const LoginScreen: React.FC = () => {
  const { login, sessionExpiredNotice } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (response.ok) {
        const data = await response.json();
        login(data.user, data.token);
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.message || 'Sai tên đăng nhập hoặc mật khẩu.');
      }
    } catch {
      setError('Không thể kết nối đến máy chủ.');
    } finally {
      setIsLoading(false);
    }
  };

  const googleCustomLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: tokenResponse.access_token })
        });

        if (response.ok) {
          const data = await response.json();
          login(data.user, data.token);
        } else {
          setError('Đăng nhập Google thất bại.');
        }
      } catch {
        setError('Không thể kết nối đến máy chủ.');
      } finally {
        setIsLoading(false);
      }
    },
    onError: () => {
      setError('Đăng nhập Google thất bại hoặc bị hủy.');
    }
  });

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/guest', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Guest sign-in failed');
      }
      const data = await response.json();
      login(data.user, data.token);
    } catch {
      setError('Không thể khởi tạo phiên khách. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen font-sans px-4 overflow-hidden bg-ink select-none">
      {/* 1. Background Wallpaper Image with Vignette Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
        style={{ backgroundImage: "url('/login-bg.jpg')" }}
      />
      {/* Dark gradient & subtle blur to blend image with theme */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink/85 via-ink/70 to-ink/90 backdrop-blur-[2px]" />
      
      {/* 2. Ambient Subtle Glow Flares */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-brass/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brass/10 rounded-full blur-3xl pointer-events-none" />

      {/* 3. Glassmorphic Login Card */}
      <div className="relative z-10 w-full max-w-md p-8 md:p-9 bg-surface/90 backdrop-blur-xl rounded-2xl border border-hair/80 shadow-2xl shadow-black/80 animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-brass/15 border border-brass/40 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brass/10">
            <span className="font-mono font-bold text-brass text-base tracking-wider">AI</span>
          </div>
          <h2 className="text-xl font-bold text-ink-1 tracking-tight">Trợ lý AI Doanh nghiệp</h2>
          <p className="text-xs text-ink-3 mt-1.5 font-medium">Đăng nhập để tiếp tục</p>
        </div>

        {sessionExpiredNotice && (
          <div
            role="alert"
            data-testid="session-expired-alert"
            className="mb-5 p-3.5 bg-amber-500/15 text-amber-300 text-xs font-medium rounded-xl border border-amber-500/30 flex items-center gap-2.5 animate-in fade-in duration-200"
          >
            <svg className="w-4 h-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{sessionExpiredNotice}</span>
          </div>
        )}

        {error && (
          <div className="mb-5 p-3.5 bg-clay/15 text-clay text-xs font-medium rounded-xl border border-clay/30 animate-in fade-in duration-150">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1.5">
              Tên đăng nhập
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-raised/80 border border-hair rounded-xl focus:ring-1 focus:ring-brass focus:border-brass outline-none transition-all text-ink-1 text-sm placeholder-ink-3"
              placeholder="Nhập tên đăng nhập"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-raised/80 border border-hair rounded-xl focus:ring-1 focus:ring-brass focus:border-brass outline-none transition-all text-ink-1 text-sm placeholder-ink-3 pr-11"
                placeholder="Nhập mật khẩu"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2 focus:outline-none transition-colors cursor-pointer"
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-brass hover:bg-brass-hover text-ink-1 font-semibold rounded-xl transition-all shadow-md shadow-brass/10 flex items-center justify-center disabled:opacity-60 text-sm mt-2 cursor-pointer active:scale-98"
          >
            {isLoading ? (
              <svg className="animate-spin h-4.5 w-4.5 text-ink-1" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              'Đăng nhập'
            )}
          </button>

          <div className="relative flex items-center justify-center my-4">
            <div className="w-full border-t border-hair"></div>
            <span className="absolute px-3 bg-surface/90 backdrop-blur-md text-ink-3 text-xs">
              hoặc
            </span>
          </div>

          <div className="flex items-center justify-center gap-4 pt-1">
            <button
              type="button"
              onClick={() => googleCustomLogin()}
              title="Đăng nhập bằng Google"
              className="w-10 h-10 rounded-full bg-surface-raised hover:border-brass/50 text-ink-1 border border-hair flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105"
            >
              <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={isLoading}
              title="Đăng nhập với tư cách Khách (Guest Mode)"
              className="w-10 h-10 rounded-full bg-surface-raised hover:border-brass/50 text-ink-2 border border-hair flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105"
            >
              <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
