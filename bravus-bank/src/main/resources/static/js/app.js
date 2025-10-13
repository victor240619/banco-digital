// Basic auth utilities and UI helpers
const API_BASE = '';

function setToken(token) {
  localStorage.setItem('bb_token', token);
}

function getToken() {
  return localStorage.getItem('bb_token');
}

async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    options.headers || {},
    token ? { Authorization: `Bearer ${token}` } : {}
  );
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    window.location.href = '/login.html';
    return Promise.reject(new Error('unauthorized'));
  }
  return res;
}

function neonToast(message, kind = 'info') {
  const el = document.createElement('div');
  el.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl text-sm text-white ${
    kind === 'success'
      ? 'bg-emerald-500/90'
      : kind === 'error'
      ? 'bg-red-500/90'
      : 'bg-cyan-500/90'
  }`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

window.BB = { setToken, getToken, authFetch, neonToast };
