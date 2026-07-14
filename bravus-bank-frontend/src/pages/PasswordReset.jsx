import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Camera, CheckCircle2, KeyRound, Loader2, RefreshCw, RotateCcw, ShieldCheck,
} from 'lucide-react';
import Logo from '../components/Logo';
import { passwordResetService } from '../services/api';

const PASSWORD_MESSAGE = 'Use no minimo 8 caracteres, com letra maiuscula, minuscula e numero.';
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const STORAGE_KEY = 'bravus-password-reset-session';

const randomSecret = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
};

const readSession = () => {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'); }
  catch { return null; }
};

const apiMessage = (error, fallback) => {
  const payload = error?.response?.data;
  return payload?.message || (typeof payload === 'string' ? payload : fallback);
};

export default function PasswordReset() {
  const existing = readSession();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [session, setSession] = useState(existing);
  const [identifier, setIdentifier] = useState('');
  const [faceImage, setFaceImage] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [status, setStatus] = useState(existing?.status || (existing ? 'FACE_PENDING' : 'START'));
  const [instruction, setInstruction] = useState(existing?.instruction || '');
  const [passwords, setPasswords] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => stopCamera(), []);

  const persistSession = (next) => {
    setSession(next);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const clearSession = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setSession(null);
  };

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  const startCamera = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este aparelho nao oferece captura segura pela camera. Use outro dispositivo para continuar.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setError('Nao foi possivel acessar a camera. Confirme a permissao do aplicativo e tente novamente.');
    }
  };

  const captureFace = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setError('A camera ainda nao esta pronta para a captura.');
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    setFaceImage(canvas.toDataURL('image/jpeg', 0.9));
    stopCamera();
  };

  const startRecovery = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const clientSecret = randomSecret();
      const idempotencyKey = `password-reset-${crypto.randomUUID()}`;
      const { data } = await passwordResetService.start({ identifier: identifier.trim(), clientSecret, idempotencyKey });
      const next = {
        requestId: data.requestId,
        challenge: data.challenge,
        instruction: data.instruction,
        clientSecret,
        status: 'FACE_PENDING',
      };
      persistSession(next);
      setInstruction(data.instruction);
      setStatus('FACE_PENDING');
    } catch (requestError) {
      setError(apiMessage(requestError, 'Nao foi possivel iniciar a recuperacao agora.'));
    } finally {
      setLoading(false);
    }
  };

  const submitFace = async () => {
    if (!faceImage || !session) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await passwordResetService.submitFace({
        requestId: session.requestId,
        clientSecret: session.clientSecret,
        challenge: session.challenge,
        faceImage,
      });
      persistSession({ ...session, status: data.status });
      setStatus(data.status);
      setFaceImage('');
    } catch (requestError) {
      setError(apiMessage(requestError, 'Nao foi possivel enviar a captura facial.'));
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async () => {
    if (!session) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await passwordResetService.status({
        requestId: session.requestId,
        clientSecret: session.clientSecret,
      });
      if (data.status === 'UNAVAILABLE') {
        clearSession();
      } else {
        persistSession({ ...session, status: data.status });
      }
      setStatus(data.status);
    } catch (requestError) {
      setError(apiMessage(requestError, 'Nao foi possivel consultar a verificacao.'));
    } finally {
      setLoading(false);
    }
  };

  const completeRecovery = async (event) => {
    event.preventDefault();
    setError('');
    if (passwords.password !== passwords.confirm) {
      setError('As senhas nao coincidem.');
      return;
    }
    if (!STRONG_PASSWORD.test(passwords.password)) {
      setError(PASSWORD_MESSAGE);
      return;
    }
    setLoading(true);
    try {
      await passwordResetService.complete({
        requestId: session.requestId,
        clientSecret: session.clientSecret,
        newPassword: passwords.password,
      });
      clearSession();
      setPasswords({ password: '', confirm: '' });
      setStatus('CONSUMED');
    } catch (requestError) {
      setError(apiMessage(requestError, 'Nao foi possivel redefinir a senha.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container-app py-8 sm:py-12">
      <section className="card-premium mx-auto max-w-xl p-6 sm:p-8">
        <Logo />
        <div className="mt-6 pill-gold w-fit">
          <ShieldCheck className="h-3.5 w-3.5" />
          Recuperacao protegida
        </div>
        <h1 className="title-md mt-4">Redefinir senha</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">
          A alteracao exige captura facial e aprovacao autorizada antes da nova senha.
        </p>

        {error && <div className="alert-error mt-5" role="alert">{error}</div>}

        {status === 'START' && (
          <form onSubmit={startRecovery} className="mt-6 space-y-5">
            <div>
              <label className="form-label" htmlFor="recovery-identifier">CPF, e-mail ou usuario</label>
              <input
                id="recovery-identifier"
                className="form-input"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Informe os dados da conta"
                autoComplete="username"
                required
              />
            </div>
            <button className="btn-primary w-full !py-3" disabled={loading || !identifier.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Iniciar verificacao
            </button>
          </form>
        )}

        {status === 'FACE_PENDING' && (
          <div className="mt-6 space-y-5">
            <div className="rounded-lg border border-gold-400/25 bg-gold-400/10 p-4 text-sm text-gold-100">
              <strong>Desafio de captura:</strong> {instruction || 'Siga a orientacao exibida e capture sua face.'}
            </div>
            <div className="aspect-video overflow-hidden rounded-lg border border-white/10 bg-ink-950">
              {cameraActive ? (
                <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
              ) : faceImage ? (
                <img src={faceImage} alt="Captura facial pronta para envio" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-ink-400">
                  <Camera className="mr-2 h-5 w-5" /> Camera aguardando
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <div className="grid gap-3 sm:grid-cols-2">
              {!cameraActive && !faceImage && (
                <button type="button" className="btn-secondary" onClick={startCamera} disabled={loading}>
                  <Camera className="h-4 w-4" /> Abrir camera
                </button>
              )}
              {cameraActive && (
                <button type="button" className="btn-primary" onClick={captureFace} disabled={loading}>
                  <Camera className="h-4 w-4" /> Capturar
                </button>
              )}
              {faceImage && (
                <button type="button" className="btn-secondary" onClick={() => setFaceImage('')} disabled={loading}>
                  <RotateCcw className="h-4 w-4" /> Refazer
                </button>
              )}
              <button type="button" className="btn-primary" onClick={submitFace} disabled={loading || !faceImage}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Enviar para verificacao
              </button>
            </div>
          </div>
        )}

        {status === 'REVIEW_PENDING' && (
          <div className="mt-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-gold-400/15 text-gold-200">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">Verificacao em analise</h2>
            <p className="mt-2 text-sm text-ink-300">A captura sera comparada com a evidencia protegida da abertura da conta.</p>
            <button type="button" className="btn-primary mt-6 w-full" onClick={refreshStatus} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar verificacao
            </button>
          </div>
        )}

        {status === 'VERIFIED' && (
          <form onSubmit={completeRecovery} className="mt-6 space-y-5">
            <div className="pill-green w-fit"><CheckCircle2 className="h-3.5 w-3.5" /> Identidade confirmada</div>
            <div>
              <label className="form-label" htmlFor="new-password">Nova senha</label>
              <input id="new-password" type="password" className="form-input" autoComplete="new-password" required
                value={passwords.password} onChange={(event) => setPasswords((value) => ({ ...value, password: event.target.value }))} />
            </div>
            <div>
              <label className="form-label" htmlFor="confirm-password">Confirmar nova senha</label>
              <input id="confirm-password" type="password" className="form-input" autoComplete="new-password" required
                value={passwords.confirm} onChange={(event) => setPasswords((value) => ({ ...value, confirm: event.target.value }))} />
            </div>
            <p className="text-xs text-ink-400">{PASSWORD_MESSAGE}</p>
            <button className="btn-primary w-full !py-3" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Redefinir senha
            </button>
          </form>
        )}

        {status === 'UNAVAILABLE' && (
          <div className="mt-6 text-center">
            <h2 className="text-lg font-semibold text-white">Nao foi possivel confirmar a identidade</h2>
            <p className="mt-2 text-sm text-ink-300">A solicitacao foi encerrada com seguranca. Procure o atendimento Bravus.</p>
          </div>
        )}

        {status === 'CONSUMED' && (
          <div className="mt-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
            <h2 className="mt-4 text-lg font-semibold text-white">Senha redefinida</h2>
            <p className="mt-2 text-sm text-ink-300">As sessoes anteriores foram encerradas.</p>
          </div>
        )}

        <Link to="/login" className="btn-secondary mt-6 w-full">
          <ArrowLeft className="h-4 w-4" /> Voltar para o login
        </Link>
      </section>
    </main>
  );
}
