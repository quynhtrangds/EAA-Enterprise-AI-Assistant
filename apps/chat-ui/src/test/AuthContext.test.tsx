import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

// Dummy component to test useAuth
const TestComponent = () => {
  const { authToken, currentUser, login, logout } = useAuth();

  return (
    <div>
      <div data-testid="auth-token">{authToken || 'no-token'}</div>
      <div data-testid="current-user">{currentUser || 'no-user'}</div>
      <button onClick={() => login('testuser', 'test-jwt-token')}>Login</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
};

const ErrorComponent = () => {
  useAuth();
  return <div>Should throw error</div>;
};

describe('AuthContext', () => {
  it('TC01: Should throw an error if useAuth is used outside of AuthProvider', () => {
    // Suppress console.error for expected React error boundary logs
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => render(<ErrorComponent />)).toThrow('useAuth must be used within an AuthProvider');
    
    consoleError.mockRestore();
  });

  it('TC02: Should provide default null values', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-token').textContent).toBe('no-token');
    expect(screen.getByTestId('current-user').textContent).toBe('no-user');
  });

  it('TC03: Should update state on login', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Login'));

    expect(screen.getByTestId('auth-token').textContent).toBe('test-jwt-token');
    expect(screen.getByTestId('current-user').textContent).toBe('testuser');
  });

  it('TC04: Should clear state on logout', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Login first
    fireEvent.click(screen.getByText('Login'));
    expect(screen.getByTestId('auth-token').textContent).toBe('test-jwt-token');

    // Then logout
    fireEvent.click(screen.getByText('Logout'));
    expect(screen.getByTestId('auth-token').textContent).toBe('no-token');
    expect(screen.getByTestId('current-user').textContent).toBe('no-user');
  });
});
