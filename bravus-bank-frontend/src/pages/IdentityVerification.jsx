import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, CheckCircle2, FileText, Loader2, RotateCcw, ShieldCheck,
} from 'lucide-react';
import Logo from '../components/Logo';
import { authService, userService } from '../services/api';
import { isMobileApp } from '../lib/appChannel';

const readImageAsDataUrl = (file) => new Promise((resolve, reject) => {
  if (!file) return resolve('');
  if (!['image/jpeg', 'image/png'].includes(file.type)) return reject(new Error('Use imagem JPEG ou PNG.'));
  if (file.size > 5 * 1024 * 1024) return reject(new Error('Imagem acima de 5 MB.'));
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
  reader.readAsDataURL(file);
});

const createIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `kyc-${crypto.randomUUID()}`;
  return `kyc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

function EvidenceStatus({ ready, label }) {
  return (
    <span className={ready ? 'pill-green' : 'pill-red'}>
      {ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

export default function IdentityVerification() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const idempotencyKeyRef = useRef('');
  const [evidence, setEvidence] = useState({ documentFrontImage: '', documentBackImage: '', faceImage: '' });
  const [cameraActive, setCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => stopCamera(), []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const setEvidenceValue = (name, value) => {
    idempotencyKeyRef.current = '';
    setEvidence((current) => ({ ...current, [name]: value }));
  };

  const chooseDocument = (name) => async (event) => {
    setError('');
    try {
      setEvidenceValue(name, await readImageAsDataUrl(event.target.files?.[0]));
    } catch (readError) {
      setError(readError.message);
    }
  };

  const startCamera = async () => {
    setError('');
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setError('Nao foi possivel abrir a camera. Autorize o acesso e tente novamente.');
    }
  };

  const captureFace = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth < 240 || video.videoHeight < 240) {
      setError('A camera ainda nao esta pronta. Aguarde e tente novamente.');
      return;
    }
    const width = Math.min(720, video.videoWidth);
    const height = Math.round(width * (video.videoHeight / video.videoWidth));
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(video, 0, 0, width, height);
    setEvidenceValue('faceImage', canvas.toDataURL('image/jpeg', 0.9));
    stopCamera();
  };

  const submit = async () => {
    if (!evidence.documentFrontImage || !evidence.documentBackImage || !evidence.faceImage) {
      setError('Envie frente, verso do documento e capture o rosto.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data: faceCheck } = await userService.verifyIdentityFace(evidence.faceImage);
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = createIdempotencyKey();
      await userService.submitIdentityEvidence({
        ...evidence,
        faceVerificationToken: faceCheck.faceVerificationToken,
      }, idempotencyKeyRef.current);
      authService.updateCurrentUser({ identityEvidenceRequired: false });
      navigate('/dashboard', { replace: true, state: { identityEvidenceSubmitted: true } });
    } catch (submitError) {
      const payload = submitError?.response?.data;
      if (payload?.code === 'KYC_EVIDENCE_ALREADY_SUBMITTED') {
        authService.updateCurrentUser({ identityEvidenceRequired: false });
        navigate('/dashboard', { replace: true, state: { identityEvidenceSubmitted: true } });
        return;
      }
      setError(payload?.message || 'Nao foi possivel enviar as evidencias. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (!isMobileApp()) {
    return (
      <main className="container-app py-12">
        <section className="card-premium mx-auto max-w-lg p-7 text-center">
          <Logo className="mx-auto w-fit" />
          <h1 className="title-md mt-6">Conclua sua identidade pelo app</h1>
          <p className="mt-3 text-sm text-ink-300">Documento e captura facial ficam disponiveis somente no aplicativo Bravus Bank.</p>
          <button type="button" className="btn-secondary mt-6" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="container-app native-safe-bottom py-4 sm:py-8">
      <section className="card-premium mx-auto max-w-xl p-5 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gold-400/15 text-gold-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold">Confirmar identidade</h1>
            <p className="mt-1 text-sm leading-relaxed text-ink-300">
              As imagens sao protegidas e usadas somente na analise da abertura da conta.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <EvidenceStatus ready={Boolean(evidence.documentFrontImage)} label="Frente" />
          <EvidenceStatus ready={Boolean(evidence.documentBackImage)} label="Verso" />
          <EvidenceStatus ready={Boolean(evidence.faceImage)} label="Face" />
        </div>

        {error && <div className="alert-error mt-5" role="alert">{error}</div>}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <span className="text-sm font-medium">Frente do documento</span>
            <input className="mt-3 block w-full text-sm" type="file" accept="image/jpeg,image/png" capture="environment" onChange={chooseDocument('documentFrontImage')} />
          </label>
          <label className="block rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <span className="text-sm font-medium">Verso do documento</span>
            <input className="mt-3 block w-full text-sm" type="file" accept="image/jpeg,image/png" capture="environment" onChange={chooseDocument('documentBackImage')} />
          </label>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-black/30">
          {evidence.faceImage && !cameraActive
            ? <img src={evidence.faceImage} alt="Captura facial" className="aspect-video w-full object-cover" />
            : <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" />}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {!cameraActive ? (
            <button type="button" className="btn-secondary" onClick={startCamera} disabled={loading}>
              {evidence.faceImage ? <RotateCcw className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {evidence.faceImage ? 'Refazer captura' : 'Abrir camera'}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={captureFace}>
              <Camera className="h-4 w-4" /> Capturar rosto
            </button>
          )}
          <button type="button" className="btn-primary flex-1" onClick={submit} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : <><ShieldCheck className="h-4 w-4" /> Enviar para analise</>}
          </button>
        </div>
      </section>
    </main>
  );
}
