import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Login({ theme, toggleTheme }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon">
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#390179" />
              <path d="M10 16.5L14.5 21L22 11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1>KrispCall</h1>
          <p className="login-subtitle">Agent Dialer</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@krispcall.com"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
          <div className="theme-toggle" style={{ display: 'inline-flex', gap: 12 }}>
            <span className="theme-toggle-label">
              {theme === 'dark' ? 'Dark' : 'Light'}
            </span>
            <label className="toggle-switch">
              <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
