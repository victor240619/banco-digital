import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, RotateCcw, X } from 'lucide-react';
import {
  DOCUMENT_CAMERA_CONSTRAINTS,
  documentCameraErrorMessage,
  documentCaptureDimensions,
} from '../lib/documentCamera';

export default function DocumentCameraCapture({ label, onCapture, onClose, onFallbackFileChange }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const requestRef = useRef(0);
  const onCaptureRef = useRef(onCapture);
  const onCloseRef = useRef(onClose);
  const [status, setStatus] = useState('starting');
  const [message, setMessage] = useState('Abrindo a camera traseira...');

  useEffect(() => { onCaptureRef.current = onCapture; }, [onCapture]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const stopCamera = useCallback(() => {
    requestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const closeCamera = useCallback(() => {
    stopCamera();
    onCloseRef.current?.();
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    stopCamera();
    const requestId = requestRef.current;
    setStatus('starting');
    setMessage('Abrindo a camera traseira...');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('Camera indisponivel', 'NotSupportedError');
      const stream = await navigator.mediaDevices.getUserMedia(DOCUMENT_CAMERA_CONSTRAINTS);
      if (requestId !== requestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (!videoRef.current) throw new Error('Visualizacao da camera indisponivel.');
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      if (requestId !== requestRef.current) return;
      setStatus('ready');
      setMessage('Enquadre todo o documento e toque em capturar.');
    } catch (error) {
      if (requestId !== requestRef.current) return;
      stopCamera();
      setStatus('error');
      setMessage(documentCameraErrorMessage(error));
    }
  }, [stopCamera]);

  useEffect(() => {
    void startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      setStatus('error');
      setMessage('A camera ainda nao esta pronta. Tente novamente.');
      return;
    }
    const dimensions = documentCaptureDimensions(video.videoWidth, video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCaptureRef.current?.(canvas.toDataURL('image/jpeg', 0.9));
    closeCamera();
  };

  return (
    <div className="fixed inset-0 z-[340] overflow-y-auto bg-white text-slate-950" role="dialog" aria-modal="true" aria-label={`Camera para ${label}`}>
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <header className="mb-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-slate-500">Documento do titular</p>
            <h2 className="truncate text-lg font-semibold">{label}</h2>
          </div>
          <button type="button" onClick={closeCamera} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-300 bg-white" aria-label="Fechar camera">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="relative mx-auto aspect-[3/4] w-full max-w-lg overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-300 sm:aspect-[4/3]">
          <video ref={videoRef} muted playsInline autoPlay controls={false} disablePictureInPicture className="h-full w-full object-cover" />
          {status === 'starting' && (
            <div className="absolute inset-0 grid place-items-center bg-white">
              <Loader2 className="h-10 w-10 animate-spin text-slate-700" />
            </div>
          )}
          {status === 'error' && <div className="absolute inset-0 bg-white" />}
          {status === 'ready' && <div className="pointer-events-none absolute inset-4 rounded-lg border-2 border-emerald-400 shadow-[0_0_0_999px_rgba(0,0,0,0.22)]" />}
        </div>

        <p className={`mt-4 rounded-lg px-4 py-3 text-center text-sm font-medium ${status === 'ready' ? 'bg-emerald-50 text-emerald-800' : status === 'error' ? 'bg-red-50 text-red-800' : 'bg-slate-100 text-slate-700'}`} role="status" aria-live="polite">
          {message}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {status === 'ready' ? (
            <button type="button" onClick={capture} className="btn-primary min-h-12 w-full">
              <Camera className="h-5 w-5" /> Capturar documento
            </button>
          ) : (
            <button type="button" onClick={startCamera} className="btn-primary min-h-12 w-full">
              <RotateCcw className="h-5 w-5" /> Tentar novamente
            </button>
          )}

          {status === 'error' && (
            <label className="btn-secondary min-h-12 cursor-pointer justify-center bg-white !text-slate-900">
              <Camera className="h-5 w-5" /> Camera do aparelho
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                capture="environment"
                aria-label={`${label}: camera do aparelho`}
                onChange={(event) => {
                  onFallbackFileChange?.(event);
                  closeCamera();
                }}
              />
            </label>
          )}

          <button type="button" onClick={closeCamera} className="btn-secondary min-h-12 w-full bg-white !text-slate-900">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
