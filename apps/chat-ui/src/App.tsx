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

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;