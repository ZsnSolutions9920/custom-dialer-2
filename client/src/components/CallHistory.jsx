import { useEffect, useState } from 'react';
import { api } from '../api';

export default function CallHistory() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCallHistory()
      .then(setCalls)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString();
  };

  const statusBadge = (status) => {
    const colors = {
      completed: 'badge-success',
      initiated: 'badge-info',
      ringing: 'badge-info',
      'no-answer': 'badge-warn',
      busy: 'badge-warn',
      failed: 'badge-error',
      canceled: 'badge-error',
    };
    return colors[status] || 'badge-info';
  };

  if (loading) {
    return (
      <div className="history-container">
        <div className="history-loading">Loading call history...</div>
      </div>
    );
  }

  return (
    <div className="history-container">
      <div className="history-header">
        <h2>Call History</h2>
        <span className="history-count">{calls.length} calls</span>
      </div>

      {calls.length === 0 ? (
        <div className="history-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
          </svg>
          <p>No calls yet. Start dialing!</p>
        </div>
      ) : (
        <div className="history-list">
          {calls.map((call) => (
            <div key={call.id} className="history-item">
              <div className="history-item-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="7 17 17 7" />
                  <polyline points="7 7 17 7 17 17" />
                </svg>
              </div>
              <div className="history-item-info">
                <span className="history-number">{call.phone_number}</span>
                <span className="history-time">{formatTime(call.started_at)}</span>
              </div>
              <div className="history-item-meta">
                <span className={`badge ${statusBadge(call.status)}`}>{call.status}</span>
                <span className="history-duration">{formatDuration(call.duration)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
