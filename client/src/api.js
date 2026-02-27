const API_BASE = '/api';

function getToken() {
  return sessionStorage.getItem('accessToken');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('agent');
    window.location.reload();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Request failed');
  }

  return res.json();
}

export const api = {
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getTwilioToken: () => request('/token/twilio-token'),

  logCall: (data) =>
    request('/calls', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCall: (callSid, data) =>
    request(`/calls/${callSid}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteCall: (callSid) =>
    request(`/calls/${callSid}`, {
      method: 'DELETE',
    }),

  getCallHistory: () => request('/calls/history'),

  getInboundHistory: () => request('/calls/inbound-history'),

  getBilling: () => request('/calls/billing'),

  getRecordingUrl: (callSid) => `${API_BASE}/calls/${callSid}/recording?token=${getToken()}`,
};
