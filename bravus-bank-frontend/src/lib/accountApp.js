// Presentation only: never use this flag as authentication or API authorization.
const ACCOUNT_APP_KEY = 'vantyx.account-app';

export function createAccountAppDetector() {
  let accountApp = false;
  return (browser, native = false) => {
    if (!browser) return false;
    let remembered = false;
    try {
      remembered = browser.sessionStorage?.getItem(ACCOUNT_APP_KEY) === '1';
    } catch { /* Storage may be disabled in a WebView. */ }
    const installed = browser.matchMedia?.('(display-mode: standalone)')?.matches
      || browser.matchMedia?.('(display-mode: fullscreen)')?.matches
      || browser.navigator?.standalone === true;
    const userAgent = browser.navigator?.userAgent || '';
    // Older distributed Android wrappers have no custom user-agent marker.
    const webView = /\bVantyxBankApp\b/i.test(userAgent) || /; wv\)/.test(userAgent);
    accountApp = accountApp || native || installed || webView || remembered
      || /^\/app\/?$/i.test(browser.location?.pathname || '');
    if (accountApp) {
      try {
        browser.sessionStorage?.setItem(ACCOUNT_APP_KEY, '1');
      } catch { /* The in-memory flag still survives SPA navigation. */ }
    }
    return Boolean(accountApp);
  };
}

export function accountDestination({ authenticated, admin, identityEvidenceRequired }) {
  if (!authenticated) return '/login';
  if (admin) return '/admin';
  return identityEvidenceRequired ? '/completar-identidade' : '/dashboard';
}
