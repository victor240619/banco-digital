// Local support diagnostic only. Never imported by the production frontend.
const API = 'https://bravusbank.com/api';
export async function probeOriginalLogin(identifier, password, fetchImpl = fetch) {
  let response;
  let data;
  try {
    response = await fetchImpl(`${API}/auth/login`, {
      method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: identifier.trim(), password, clientChannel: 'WEB' }),
      signal: AbortSignal.timeout(180000),
    });
    data = await response.json();
  } catch {
    return { result: 'unavailable' };
  }
  const credentialMatchedCodes = new Set([
    'INITIAL_PASSWORD_CHANGE_REQUIRED', 'INITIAL_PASSWORD_EXPIRED',
    'ACCOUNT_BLOCKED', 'ACCOUNT_IDENTITY_REJECTED',
  ]);
  if (!response.ok) {
    if (credentialMatchedCodes.has(data?.code)) return { result: 'matched_restricted' };
    return { result: response.status === 400 || response.status === 401 ? 'rejected' : 'unavailable' };
  }
  if (!data?.token) return { result: 'unavailable' };
  const administrator = Array.isArray(data.roles) && data.roles.includes('ROLE_ADMIN');
  let sessionClosed = false;
  try {
    const logout = await fetchImpl(`${API}/auth/logout`, {
      method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
      body: JSON.stringify({ reason: 'MANUAL' }),
      signal: AbortSignal.timeout(20000), keepalive: true,
    });
    sessionClosed = logout.ok;
  } catch { /* Report the unclosed test session; never silently retry. */ }
  return { result: 'matched', administrator, sessionClosed };
}
