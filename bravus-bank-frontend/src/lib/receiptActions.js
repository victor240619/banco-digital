import { saveNativeReceiptPdf, shareNativeReceiptPdf } from './nativeReceiptDocuments.js';

export function downloadReceiptBlob({ filename, pdf }, environment = globalThis) {
  const url = environment.URL.createObjectURL(pdf);
  const link = environment.document.createElement('a');
  link.href = url;
  link.download = filename;
  environment.document.body.appendChild(link);
  link.click();
  link.remove();
  // Mobile browsers may consume the object URL asynchronously.
  environment.setTimeout(() => environment.URL.revokeObjectURL(url), 60000);
}

export async function downloadReceiptDocument(document, options = {}) {
  const native = options.native ?? (await import('./appChannel.js')).isMobileApp();
  if (native) return (options.saveNative || saveNativeReceiptPdf)(document);
  (options.download || downloadReceiptBlob)(document);
  return { message: 'Comprovante em PDF baixado.' };
}

export async function shareReceiptDocument(document, options = {}) {
  const native = options.native ?? (await import('./appChannel.js')).isMobileApp();
  if (native) return (options.shareNative || shareNativeReceiptPdf)(document);
  const browser = options.navigator || navigator;
  const file = new File([document.pdf], document.filename, { type: 'application/pdf' });
  if (browser.share && browser.canShare?.({ files: [file] })) {
    await browser.share({ files: [file], title: document.title, text: document.text });
    return 'PDF compartilhado.';
  }
  // A dashboard URL is not a receipt. Always retain the actual updated PDF.
  (options.download || downloadReceiptBlob)(document);
  return 'Este navegador não compartilha arquivos. O mesmo PDF foi baixado para você enviar.';
}
