import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

const REQUIRED_STABLE_FRAMES = 8;

export default function LiveFaceCapture({ onCapture, autoStart = false, onSuccessComplete }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const animationRef = useRef(0);
  const stableFramesRef = useRef(0);
  const completedRef = useRef(false);
  const startingRef = useRef(false);
  const onCaptureRef = useRef(onCapture);
  const onSuccessCompleteRef = useRef(onSuccessComplete);
  const successTimerRef = useRef(0);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('Posicione o rosto dentro do oval.');

  useEffect(() => { onCaptureRef.current = onCapture; }, [onCapture]);
  useEffect(() => { onSuccessCompleteRef.current = onSuccessComplete; }, [onSuccessComplete]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animationRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => {
    clearTimeout(successTimerRef.current);
    stopCamera();
    detectorRef.current?.close?.();
  }, [stopCamera]);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCaptureRef.current(canvas.toDataURL('image/jpeg', 0.92));
    completedRef.current = true;
    setStatus('success');
    setMessage('Rosto centralizado e selfie capturada com sucesso.');
    stopCamera();
    successTimerRef.current = window.setTimeout(() => onSuccessCompleteRef.current?.(), 1400);
  }, [stopCamera]);

  const detect = useCallback(() => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector || completedRef.current || video.readyState < 2) {
      if (!completedRef.current) animationRef.current = requestAnimationFrame(detect);
      return;
    }

    const result = detector.detectForVideo(video, performance.now());
    const box = result.detections?.length === 1 ? result.detections[0].boundingBox : null;
    if (!box) {
      stableFramesRef.current = 0;
      setStatus('scanning');
      setMessage('Mantenha apenas um rosto visivel dentro do oval.');
    } else {
      const faceCenterX = (box.originX + box.width / 2) / video.videoWidth;
      const faceCenterY = (box.originY + box.height / 2) / video.videoHeight;
      const faceWidth = box.width / video.videoWidth;
      const centered = Math.abs(faceCenterX - 0.5) < 0.12
        && Math.abs(faceCenterY - 0.48) < 0.14
        && faceWidth > 0.26 && faceWidth < 0.68;
      stableFramesRef.current = centered ? stableFramesRef.current + 1 : 0;
      setStatus(centered ? 'aligned' : 'scanning');
      setMessage(centered ? 'Perfeito. Mantenha o rosto centralizado.' : 'Aproxime e centralize o rosto no oval.');
      if (stableFramesRef.current >= REQUIRED_STABLE_FRAMES) {
        captureFrame();
        return;
      }
    }
    animationRef.current = requestAnimationFrame(detect);
  }, [captureFrame]);

  const initializeDetector = async () => {
    if (detectorRef.current) return detectorRef.current;
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm',
    );
    const options = {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
      },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.7,
    };
    detectorRef.current = await FaceDetector.createFromOptions(vision, options);
    return detectorRef.current;
  };

  const startCamera = async () => {
    if (startingRef.current || streamRef.current) return;
    startingRef.current = true;
    setStatus('loading');
    setMessage('Preparando verificacao facial...');
    completedRef.current = false;
    stableFramesRef.current = 0;
    onCaptureRef.current('');
    try {
      await initializeDetector();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setStatus('scanning');
      setMessage('Centralize o rosto dentro do oval.');
      animationRef.current = requestAnimationFrame(detect);
    } catch (error) {
      stopCamera();
      setStatus('error');
      setMessage(error?.name === 'NotAllowedError'
        ? 'Permita o acesso a camera para concluir a verificacao facial.'
        : 'Nao foi possivel iniciar a camera. Verifique a permissao e tente novamente.');
    } finally {
      startingRef.current = false;
    }
  };

  useEffect(() => {
    if (autoStart) void startCamera();
  }, [autoStart]);

  const ovalClass = status === 'success' || status === 'aligned'
    ? 'border-emerald-400 shadow-[0_0_0_999px_rgba(255,255,255,0.38),0_0_22px_rgba(52,211,153,0.7)]'
    : 'border-gold-400 shadow-[0_0_0_999px_rgba(255,255,255,0.48)]';

  return (
    <section className="w-full bg-white p-4 text-slate-900 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Verificacao facial em tempo real</h3>
          <p className="mt-1 text-sm text-slate-600">Use um ambiente iluminado e retire oculos escuros ou chapeu.</p>
        </div>
        {status === 'success' && <CheckCircle2 className="h-7 w-7 text-emerald-600" />}
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
        <video ref={videoRef} muted playsInline autoPlay controls={false} disablePictureInPicture className="h-full w-full scale-x-[-1] bg-white object-cover" />
        {status !== 'idle' && status !== 'error' && (
          <div className={`pointer-events-none absolute left-1/2 top-1/2 h-[72%] w-[54%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-4 transition-colors duration-200 ${ovalClass}`} />
        )}
        {(status === 'idle' || status === 'error') && <div className="absolute inset-0 bg-white" />}
        {status === 'loading' && (
          <div className="absolute inset-0 grid place-items-center bg-white/80">
            <Loader2 className="h-10 w-10 animate-spin text-slate-700" />
          </div>
        )}
      </div>

      <div className={`mt-4 rounded-lg px-4 py-3 text-center text-sm font-medium ${
        status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
      }`} role="status" aria-live="polite">
        {message}
      </div>

      {status === 'error' && (
        <button type="button" onClick={startCamera} className="btn-primary mt-4 w-full">Tentar novamente</button>
      )}
    </section>
  );
}
