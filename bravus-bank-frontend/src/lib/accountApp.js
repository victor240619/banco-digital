// Presentation only: never use this flag as authentication or API authorization.
export function createAccountAppDetector() {
  return (browser, native = false) => {
    if (!browser) return false;
    const installed = browser.matchMedia?.('(display-mode: standalone)')?.matches
      || browser.navigator?.standalone === true;
    const userAgent = browser.navigator?.userAgent || '';
    const brandedWebView = /\bVantyxBankApp\b/i.test(userAgent);
    // A URL, a previous visit, fullscreen, or another app's embedded browser
    // must not turn the public website into the banking application's UI.
    // Legacy banking APKs are recognized through their native Capacitor bridge.
    return Boolean(native || installed || brandedWebView);
  };
}

export function accountDestination({ authenticated, admin, identityEvidenceRequired }) {
  if (!authenticated) return '/login';
  if (admin) return '/admin';
  return identityEvidenceRequired ? '/completar-identidade' : '/dashboard';
}
