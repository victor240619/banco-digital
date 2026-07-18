export const DOCUMENT_CAMERA_CONSTRAINTS = Object.freeze({
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
});

export function documentCameraErrorMessage(error) {
  if (error?.name === 'NotSupportedError') {
    return 'Este dispositivo nao oferece camera ao navegador. Use a camera do aparelho abaixo.';
  }
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
    return 'Permita o acesso a camera para fotografar o documento.';
  }
  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') {
    return 'Nenhuma camera compativel foi encontrada. Use a camera do aparelho abaixo.';
  }
  return 'Nao foi possivel abrir a camera. Verifique a permissao e tente novamente.';
}

export function documentCaptureDimensions(width, height, maxEdge = 1600) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const scale = Math.min(1, maxEdge / Math.max(safeWidth, safeHeight));
  return {
    width: Math.round(safeWidth * scale),
    height: Math.round(safeHeight * scale),
  };
}
