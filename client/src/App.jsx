import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { CallProvider } from './contexts/CallContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dialer from './components/Dialer';
import CallHistory from './components/CallHistory';

export default function App() {
  const { isAuthenticated } = useAuth();
  const [view, setView] = useState('dialer');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  if (!isAuthenticated) {
    return <Login theme={theme} toggleTheme={toggleTheme} />;
  }

  return (
    <SocketProvider>
      <CallProvider>
        <div className="app-layout">
          <Sidebar
            view={view}
            onViewChange={setView}
            theme={theme}
            toggleTheme={toggleTheme}
          />
          <main className="main-content">
            {view === 'dialer' && <Dialer />}
            {view === 'history' && <CallHistory />}
          </main>
        </div>
      </CallProvider>
    </SocketProvider>
  );
}
