import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: any) => children,
  GoogleLogin: () => null,
  useGoogleLogin: () => vi.fn()
}));