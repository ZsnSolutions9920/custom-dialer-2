import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [agent, setAgent] = useState(() => {
    try {
      const saved = sessionStorage.getItem('agent');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name && parsed.email) return parsed;
      }
    } catch { /* ignore */ }
    return null;
  });

  const [accessToken, setAccessToken] = useState(() => sessionStorage.getItem('accessToken'));

  const isAuthenticated = !!(agent && accessToken);

  const login = useCallback(async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Login failed');
    }

    const data = await res.json();
    sessionStorage.setItem('accessToken', data.accessToken);
    sessionStorage.setItem('refreshToken', data.refreshToken);
    sessionStorage.setItem('agent', JSON.stringify(data.agent));
    setAccessToken(data.accessToken);
    setAgent(data.agent);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('agent');
    setAccessToken(null);
    setAgent(null);
  }, []);

  const getAccessToken = useCallback(() => {
    return sessionStorage.getItem('accessToken');
  }, []);

  return (
    <AuthContext.Provider value={{ agent, accessToken, isAuthenticated, login, logout, getAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
