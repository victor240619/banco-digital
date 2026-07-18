export const APK_DOWNLOAD_URL =
  import.meta.env.VITE_APK_DOWNLOAD_URL || '/downloads/bravus-bank-mobile.apk';

export const BRAVUS_PRODUCTION_API_URL =
  'https://bravusbank.com/api';

export const APK_DEFAULT_API_URL =
  import.meta.env.VITE_APK_API_URL || BRAVUS_PRODUCTION_API_URL;

export const MOBILE_APP_API_URL =
  import.meta.env.VITE_MOBILE_API_URL || APK_DEFAULT_API_URL;

export function getNativePlatform() {
  if (typeof window === 'undefined') return 'web';
  const capacitor = window.Capacitor;
  if (capacitor?.getPlatform) return capacitor.getPlatform();
  if (window.location.protocol === 'capacitor:') return 'native';
  return 'web';
}

export function isMobileApp() {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.DEV && import.meta.env.VITE_MOBILE_PREVIEW === 'true') return true;
  const capacitor = window.Capacitor;
  const platform = getNativePlatform();
  if (platform === 'android' || platform === 'ios' || platform === 'native') return true;
  if (capacitor?.isNativePlatform?.()) return true;
  return window.location.protocol === 'capacitor:';
}

export function isAndroidApk() {
  return getNativePlatform() === 'android';
}

export function isIosApp() {
  return getNativePlatform() === 'ios';
}

export function getAppClientChannel() {
  const platform = getNativePlatform();
  if (platform === 'android') return 'ANDROID_APK';
  if (platform === 'ios') return 'IOS_APP';
  if (isMobileApp()) return 'MOBILE_APP';
  return 'WEB';
}

export function getAppClientHeader() {
  const platform = getNativePlatform();
  if (platform === 'android') return 'android-apk';
  if (platform === 'ios') return 'ios-app';
  if (isMobileApp()) return 'mobile-app';
  return null;
}
