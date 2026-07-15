import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const RECEIPT_DIRECTORY = 'Bravus';
const SHARE_DIRECTORY = 'bravus-receipts';

const requireNativePlugins = () => {
  const available = Capacitor.isNativePlatform()
    && Capacitor.isPluginAvailable('Filesystem')
    && Capacitor.isPluginAvailable('Share');

  if (!available) {
    const error = new Error('Os recursos nativos de comprovante nao estao disponiveis.');
    error.code = 'NATIVE_RECEIPT_PLUGINS_UNAVAILABLE';
    throw error;
  }
};

export const blobToBase64 = async (blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
};

export async function saveNativeReceiptPdf({ filename, pdf }) {
  requireNativePlugins();
  const path = `${RECEIPT_DIRECTORY}/${filename}`;
  const data = await blobToBase64(pdf);
  const result = await Filesystem.writeFile({
    path,
    data,
    directory: Directory.Documents,
    recursive: true,
  });

  return {
    path,
    uri: result.uri,
    message: `PDF salvo em Documentos/${path}.`,
  };
}

export async function shareNativeReceiptPdf({ filename, pdf, title, text }) {
  requireNativePlugins();
  const path = `${SHARE_DIRECTORY}/${Date.now()}-${filename}`;
  const data = await blobToBase64(pdf);
  const result = await Filesystem.writeFile({
    path,
    data,
    directory: Directory.Cache,
    recursive: true,
  });

  await Share.share({
    title,
    text,
    files: [result.uri],
    dialogTitle: 'Compartilhar comprovante',
  });

  return 'Opcoes de compartilhamento abertas.';
}
