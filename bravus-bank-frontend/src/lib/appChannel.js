export const APK_DOWNLOAD_URL =
  import.meta.env.VITE_APK_DOWNLOAD_URL || '/downloads/bravus-bank.apk';

export const APK_DEFAULT_API_URL =
  import.meta.env.VITE_APK_API_URL || 'https://bravus-bank-240619.victor2406.chatgpt.site/api';

export const APP_CLIENT_HEADER = 'android-apk';

export function isAndroidApk() {
  if (typeof window === 'undefined') return false;
  const capacitor = window.Capacitor;
  if (capacitor?.isNativePlatform?.()) return true;
  if (capacitor?.getPlatform?.() === 'android') return true;
  return window.location.protocol === 'capacitor:';
}
