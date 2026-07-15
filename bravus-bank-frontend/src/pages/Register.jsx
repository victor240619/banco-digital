import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Camera, CheckCircle2, Download, FileText, Loader2, RotateCcw,
  ShieldCheck, Smartphone, UserPlus,
} from 'lucide-react';
import { authService } from '../services/api';
import { APK_DOWNLOAD_URL, isMobileApp } from '../lib/appChannel';
import { clearRegistrationDraft, loadRegistrationDraft, saveRegistrationDraft } from '../lib/registrationDraft';

const PASSWORD_MESSAGE = 'Use no mínimo 8 caracteres, com letra maiúscula, minúscula e número.';
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const BIOMETRIC_CHALLENGE = 'FACE_CAMERA_CAPTURE_V1';

const onlyDigits = (value) => value.replace(/\D/g, '');

const formatCpf = (value) => {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const formatPhone = (value) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/[-\s]+$/, '');
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/[-\s]+$/, '');
};

const readImageAsDataUrl = (file) => new Promise((resolve, reject) => {
  if (!file) {
    resolve('');
    return;
  }
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    reject(new Error('Use imagem JPEG ou PNG.'));
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    reject(new Error('Imagem acima de 5 MB.'));
    return;
  }
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Falha ao ler imagem.'));
  reader.readAsDataURL(file);
});

function Field({
  label,
  name,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
  minLength,
  autoComplete,
  onBlur,
}) {
  return (
    <div>
      <label className="form-label" htmlFor={name}>
        {label}{required && ' *'}
      </label>
      <input
        id={name}
        type={type}
        name={name}
        className="form-input"
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onBlur={onBlur}
      />
    </div>
  );
}

function EvidenceBadge({ ready, label }) {
  return (
    <span className={ready ? 'pill-green' : 'pill-red'}>
      {ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

function DownloadAppGate() {
  return (
    <main className="container-app py-12 sm:py-16">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mx-auto max-w-3xl"
      >
        <div className="card-premium p-8 sm:p-10 text-center">
          <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-gold text-[#05122f]">
            <Smartphone className="h-8 w-8" />
          </div>
          <div className="pill-gold mx-auto mb-4 w-fit">
            <ShieldCheck className="h-3.5 w-3.5" />
            Cadastro protegido no app
          </div>
          <h1 className="title-md">Abra sua conta pelo app Bravus Bank</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-300">
            Por seguranca, a criacao de conta com documento e biometria facial fica disponivel somente no app mobile.
            No Android, baixe o APK. No iPhone, use a versao iOS gerada para instalacao via Apple Developer/TestFlight.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a href={APK_DOWNLOAD_URL} download className="btn-primary !py-3 !px-6">
              <Download className="h-4 w-4" />
              Baixar APK Android
            </a>
            <a href="/login" className="btn-secondary !py-3 !px-6">
              Ja sou cliente
            </a>
          </div>
          <p className="mt-5 text-xs text-ink-500">
            Se o Android bloquear a instalacao, libere temporariamente a origem do arquivo nas configuracoes do aparelho.
          </p>
        </div>
      </motion.div>
    </main>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const availabilityRequestRef = useRef(0);
  const [formData, setFormData] = useState(() => ({
    ...loadRegistrationDraft(),
    password: '',
    confirmPassword: '',
  }));
  const [kyc, setKyc] = useState({
    documentFrontImage: '',
    documentBackImage: '',
    faceImage: '',
  });
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState({ status: 'idle', accountExists: false, message: '' });
  const [faceVerification, setFaceVerification] = useState({ status: 'idle', token: '', message: '' });
  const nativeApp = isMobileApp();

  useEffect(() => () => stopCamera(), []);
  useEffect(() => {
    if (nativeApp) saveRegistrationDraft(formData);
  }, [formData, nativeApp]);

  if (!nativeApp) {
    return <DownloadAppGate />;
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  const registrationPayload = () => ({
    username: formData.username.trim(),
    email: formData.email.trim(),
    cpf: onlyDigits(formData.cpf),
  });

  const checkAvailability = async ({ requireComplete = false } = {}) => {
    const requestId = availabilityRequestRef.current + 1;
    availabilityRequestRef.current = requestId;
    const identity = registrationPayload();
    if (requireComplete && (identity.username.length < 3 || !identity.email || identity.cpf.length !== 11)) {
      setError('Preencha usuario, e-mail e CPF antes da verificacao facial.');
      return false;
    }
    setAvailability({ status: 'checking', accountExists: false, message: 'Verificando dados...' });
    try {
      const result = await authService.checkRegistration(identity);
      if (requestId !== availabilityRequestRef.current) return false;
      const hasConflict = ['ACCOUNT_ALREADY_EXISTS', 'USERNAME_ALREADY_EXISTS', 'EMAIL_ALREADY_EXISTS'].includes(result.code);
      setAvailability({
        status: result.available ? 'available' : (hasConflict ? 'conflict' : 'idle'),
        accountExists: Boolean(result.accountExists),
        message: result.message || '',
      });
      if (hasConflict || (requireComplete && !result.available)) setError(result.message || 'Revise os dados antes de continuar.');
      return Boolean(result.available);
    } catch (err) {
      if (requestId !== availabilityRequestRef.current) return false;
      const payload = err?.response?.data;
      const message = typeof payload === 'string' ? payload : payload?.message;
      setAvailability({ status: 'error', accountExists: false, message: message || 'Falha ao verificar os dados.' });
      if (requireComplete) setError(message || 'Falha ao verificar os dados.');
      return false;
    }
  };

  const verifyFaceImage = async (faceImage) => {
    setError('');
    setCameraError('');
    const available = await checkAvailability({ requireComplete: true });
    if (!available) return false;
    setFaceVerification({ status: 'checking', token: '', message: 'Validando a captura...' });
    try {
      const result = await authService.verifyRegistrationFace({
        ...registrationPayload(),
        faceImage,
        biometricChallenge: BIOMETRIC_CHALLENGE,
      });
      if (result.status !== 'CAPTURE_VALIDATED' || !result.faceVerificationToken) {
        throw new Error('A captura facial nao foi validada.');
      }
      setKyc((current) => ({ ...current, faceImage }));
      setFaceVerification({
        status: 'validated',
        token: result.faceVerificationToken,
        message: result.message || 'Captura facial validada automaticamente.',
      });
      return true;
    } catch (err) {
      const payload = err?.response?.data;
      const message = typeof payload === 'string' ? payload : payload?.message || err.message;
      setKyc((current) => ({ ...current, faceImage: '' }));
      setFaceVerification({ status: 'error', token: '', message: message || 'Falha ao validar a captura.' });
      setCameraError(message || 'Falha ao validar a captura.');
      return false;
    }
  };

  const startCamera = async () => {
    setCameraError('');
    setError('');
    if (!await checkAvailability({ requireComplete: true })) return;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera direta indisponivel neste aparelho. Use a captura de selfie pelo seletor abaixo.');
        return;
      }
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
    } catch (err) {
      setCameraError('Não foi possível acessar a câmera.');
    }
  };

  const captureFace = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setCameraError('Câmera ainda não está pronta.');
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const faceImage = canvas.toDataURL('image/jpeg', 0.9);
    stopCamera();
    await verifyFaceImage(faceImage);
  };

  const handleFileChange = async (event) => {
    const { name, files } = event.target;
    setError('');
    try {
      const dataUrl = await readImageAsDataUrl(files?.[0]);
      if (name === 'faceImage') await verifyFaceImage(dataUrl);
      else setKyc((current) => ({ ...current, [name]: dataUrl }));
    } catch (err) {
      event.target.value = '';
      setKyc((current) => ({ ...current, [name]: '' }));
      setError(err.message || 'Falha ao carregar imagem.');
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    const nextValue =
      name === 'cpf' ? formatCpf(value) :
      name === 'phone' ? formatPhone(value) :
      value;

    setFormData((current) => ({ ...current, [name]: nextValue }));
    if (['username', 'email', 'cpf'].includes(name)) {
      availabilityRequestRef.current += 1;
      setAvailability({ status: 'idle', accountExists: false, message: '' });
      setFaceVerification({ status: 'idle', token: '', message: '' });
      setKyc((current) => ({ ...current, faceImage: '' }));
    }
  };

  const handleIdentityBlur = () => {
    const identity = registrationPayload();
    if (identity.username || identity.email || identity.cpf) checkAvailability();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (onlyDigits(formData.cpf).length !== 11) {
      setError('Informe CPF com 11 dígitos.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (!STRONG_PASSWORD.test(formData.password)) {
      setError(PASSWORD_MESSAGE);
      return;
    }

    if (!kyc.documentFrontImage || !kyc.documentBackImage || !kyc.faceImage) {
      setError('Envie frente, verso do documento e capture a biometria facial.');
      return;
    }

    if (faceVerification.status !== 'validated' || !faceVerification.token) {
      setError('Capture novamente a biometria para concluir a validacao automatica.');
      return;
    }

    setLoading(true);

    try {
      if (!await checkAvailability({ requireComplete: true })) return;
      const { confirmPassword, ...payload } = formData;
      const registered = await authService.register({
        ...payload,
        cpf: onlyDigits(payload.cpf),
        phone: onlyDigits(payload.phone),
        documentFrontImage: kyc.documentFrontImage,
        documentBackImage: kyc.documentBackImage,
        faceImage: kyc.faceImage,
        biometricChallenge: BIOMETRIC_CHALLENGE,
        faceVerificationToken: faceVerification.token,
      });
      if (!registered?.token) throw new Error('Cadastro concluido sem sessao valida.');
      clearRegistrationDraft();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const payload = err?.response?.data;
      const message = typeof payload === 'string' ? payload : payload?.message || err.message;
      if (payload?.accountExists || payload?.code === 'ACCOUNT_ALREADY_EXISTS') {
        setAvailability({ status: 'conflict', accountExists: true, message });
      }
      setError(message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container-app py-12 sm:py-16">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mx-auto max-w-4xl"
      >
        <div className="card-premium p-8 sm:p-10">
          <div className="mb-7">
            <div className="pill-gold mb-3">
              <UserPlus className="h-3.5 w-3.5" />
              Abertura de conta
            </div>
            <h1 className="title-md">Crie sua conta Bravus</h1>
            <p className="mt-1.5 text-sm text-ink-300">Cadastro com documento e biometria facial.</p>
          </div>

          {error && <div className="alert-error mb-5" role="alert">{error}</div>}
          {cameraError && <div className="alert-error mb-5" role="alert">{cameraError}</div>}
          {availability.accountExists && (
            <div className="mb-5 flex flex-wrap gap-3" aria-label="Acoes para conta existente">
              <Link to="/login" className="btn-primary !py-2 !px-4">Entrar na conta</Link>
              <Link to="/redefinir-senha" className="btn-secondary !py-2 !px-4">Redefinir senha</Link>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Usuário" name="username" value={formData.username} onChange={handleChange} onBlur={handleIdentityBlur} required placeholder="seu.usuario" minLength={3} autoComplete="username" />
              <Field label="E-mail" name="email" type="email" value={formData.email} onChange={handleChange} onBlur={handleIdentityBlur} required placeholder="voce@email.com" autoComplete="email" />
              <Field label="Nome completo" name="fullName" value={formData.fullName} onChange={handleChange} required placeholder="Seu nome completo" autoComplete="name" />
              <Field label="CPF" name="cpf" value={formData.cpf} onChange={handleChange} onBlur={handleIdentityBlur} required placeholder="000.000.000-00" autoComplete="off" />
              <Field label="Telefone" name="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="(00) 00000-0000" autoComplete="tel" />
            </div>

            {availability.status === 'available' && (
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200" role="status">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {availability.message}
                </span>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Senha" name="password" type="password" value={formData.password} onChange={handleChange} required minLength={8} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
              <Field label="Confirmar senha" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} required placeholder="Repita a senha" autoComplete="new-password" />
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-ink-300">
              <span className="inline-flex items-center gap-2 text-ink-200">
                <CheckCircle2 className="h-4 w-4 text-gold-300" />
                {PASSWORD_MESSAGE}
              </span>
            </div>

            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 font-semibold text-white">
                  <ShieldCheck className="h-5 w-5 text-gold-300" />
                  Verificação documental
                </div>
                <div className="flex flex-wrap gap-2">
                  <EvidenceBadge ready={!!kyc.documentFrontImage} label="Frente" />
                  <EvidenceBadge ready={!!kyc.documentBackImage} label="Verso" />
                  <EvidenceBadge ready={!!kyc.faceImage} label="Face" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label" htmlFor="documentFrontImage">Documento frente *</label>
                  <input
                    id="documentFrontImage"
                    name="documentFrontImage"
                    type="file"
                    accept="image/jpeg,image/png"
                    className="form-input"
                    onChange={handleFileChange}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="documentBackImage">Documento verso *</label>
                  <input
                    id="documentBackImage"
                    name="documentBackImage"
                    type="file"
                    accept="image/jpeg,image/png"
                    className="form-input"
                    onChange={handleFileChange}
                    required
                  />
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <label className="form-label mb-0">Biometria facial *</label>
                  <div className="flex gap-2">
                    <button type="button" className="btn-secondary !py-2 !px-3" onClick={startCamera} disabled={cameraActive || loading}>
                      <Camera className="h-4 w-4" />
                      Abrir câmera
                    </button>
                    {kyc.faceImage && (
                      <button
                        type="button"
                        className="btn-secondary !py-2 !px-3"
                        onClick={() => {
                          setKyc((current) => ({ ...current, faceImage: '' }));
                          setFaceVerification({ status: 'idle', token: '', message: '' });
                        }}
                        disabled={loading}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Refazer
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="aspect-video overflow-hidden rounded-xl border border-white/10 bg-ink-950">
                    {cameraActive ? (
                      <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
                    ) : kyc.faceImage ? (
                      <img src={kyc.faceImage} alt="Biometria facial capturada" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-ink-400">
                        <Camera className="mr-2 h-5 w-5" />
                        Câmera aguardando
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center gap-3">
                    <button type="button" className="btn-primary w-full" onClick={captureFace} disabled={!cameraActive || loading || faceVerification.status === 'checking'}>
                      {faceVerification.status === 'checking' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      {faceVerification.status === 'checking' ? 'Validando captura...' : 'Capturar biometria'}
                    </button>
                    <label className="btn-secondary w-full cursor-pointer justify-center">
                      <Camera className="h-4 w-4" />
                      Enviar selfie
                      <input
                        name="faceImage"
                        type="file"
                        accept="image/jpeg,image/png,image/*"
                        capture="user"
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={loading}
                      />
                    </label>
                    <button type="button" className="btn-secondary w-full" onClick={stopCamera} disabled={!cameraActive || loading}>
                      Encerrar câmera
                    </button>
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                </div>
                {faceVerification.status === 'validated' && (
                  <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200" role="status">
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {faceVerification.message}
                    </span>
                  </div>
                )}
              </div>
            </section>

            <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Criando conta...
                </>
              ) : (
                <>
                  Abrir minha conta
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-300">
            Já é cliente?{' '}
            <Link to="/login" className="font-medium text-gold-300 hover:text-gold-200">
              Entrar
            </Link>
          </p>
        </div>
      </motion.div>
    </main>
  );
}
