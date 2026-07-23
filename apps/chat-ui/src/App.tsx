import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './components/layout/MainLayout';
import LoginScreen from './components/auth/LoginScreen';

function AppContent() {
  const { authToken } = useAuth();
  
  if (!authToken) {
    return <LoginScreen />;
  }
  
  return <MainLayout />;
}

import { GoogleOAuthProvider } from '@react-oauth/google';

function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy'}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;