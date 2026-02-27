import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useSocket } from '../contexts/SocketContext';
import { parsePhone } from '../utils/phoneFormat';

export default function InboundHistory() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  const fetchHistory = useCallback(() => {
    api.getInboundHistory()
      .then(setCalls)
      .catch((err) => console.error('Failed to fetch inbound history:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (!socket) return;
    socket.on('call:logged', fetchHistory);
    socket.on('call:updated', fetchHistory);
    return () => {
      socket.off('call:logged', fetchHistory);
      socket.off('call:updated', fetchHistory);
    };
  }, [socket, fetchHistory]);

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
      voicemail: 'badge-warn',
    };
    return colors[status] || 'badge-info';
  };

  if (loading) {
    return (
      <div className="history-container">
        <div className="history-loading">Loading inbound call history...</div>
      </div>
    );
  }

  return (
    <div className="history-container">
      <div className="history-header">
        <h2>Inbound Calls</h2>
        <span className="history-count">{calls.length} calls</span>
      </div>

      {calls.length === 0 ? (
        <div className="history-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 7 7 17" />
            <polyline points="17 17 7 17 7 7" />
          </svg>
          <p>No inbound calls yet.</p>
        </div>
      ) : (
        <div className="history-list">
          {calls.map((call) => {
            const phone = parsePhone(call.phone_number);
            return (
              <div key={call.id} className="history-item">
                <div className="history-item-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 7 7 17" />
                    <polyline points="17 17 7 17 7 7" />
                  </svg>
                </div>
                <div className="history-item-info">
                  <span className="history-number">{phone.flag} {phone.formatted}</span>
                  <span className="history-time">{formatTime(call.started_at)}</span>
                </div>
                <div className="history-item-meta">
                  <span className={`badge ${statusBadge(call.status)}`}>
                    {call.status}
                    <span
                      className="dev-delete-call"
                      onDoubleClick={() => {
                        api.deleteCall(call.call_sid).catch((err) => console.error('Failed to delete call:', err));
                      }}
                    />
                  </span>
                  <span className="history-duration">{formatDuration(call.duration)}</span>
                  {call.recording_url && (
                    <a
                      href={api.getRecordingUrl(call.call_sid)}
                      title="Download recording"
                      className="recording-download-btn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
