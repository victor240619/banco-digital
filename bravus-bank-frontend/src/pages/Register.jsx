import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, CheckCircle2, FileText, Loader2, ShieldCheck, UserPlus,
} from 'lucide-react';
import { authService } from '../services/api';
import { clearRegistrationDraft, loadRegistrationDraft, saveRegistrationDraft } from '../lib/registrationDraft';
import LiveFaceCapture from '../components/LiveFaceCapture';

const onlyDigits = (value) => value.replace(/\D/g, '');

const readImageAsDataUrl = (file) => new Promise((resolve, reject) => {
  if (!file) return resolve('');
  if (!['image/jpeg', 'image/png'].includes(file.type)) return reject(new Error('Use imagem JPEG ou PNG.'));
  if (file.size > 5 * 1024 * 1024) return reject(new Error('Imagem acima de 5 MB.'));
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
  reader.readAsDataURL(file);
});

const formatCpf = (value) => {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const formatPhone = (value) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/[-\s]+$/, '');
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/[-\s]+$/, '');
};

function Field({ label, name, value, onChange, type = 'text', required, placeholder, minLength, maxLength, autoComplete, onBlur, inputMode, pattern }) {
  return (
    <div>
      <label className="form-label" htmlFor={name}>{label}{required && ' *'}</label>
      <input
        id={name}
        type={type}
        name={name}
        className="form-input"
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onBlur={onBlur}
        inputMode={inputMode}
        pattern={pattern}
      />
    </div>
  );
}

export default function Register() {
  const location = useLocation();
  const navigate = useNavigate();
  const availabilityRequestRef = useRef(0);
  const validatedIdentityRef = useRef('');
  const requestKeyRef = useRef('');
  const [formData, setFormData] = useState(() => loadRegistrationDraft());
  const [documents, setDocuments] = useState({ documentFrontImage: '', documentBackImage: '', faceImage: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [availability, setAvailability] = useState({ status: 'idle', accountExists: false, message: '' });

  useEffect(() => { saveRegistrationDraft(formData); }, [formData]);

  const registrationPayload = () => ({
    username: String(formData.username || '').trim().toLowerCase(),
    email: String(formData.email || '').trim().toLowerCase(),
    cpf: onlyDigits(String(formData.cpf || '')),
  });

  const checkAvailability = async ({ requireComplete = false } = {}) => {
    const requestId = availabilityRequestRef.current + 1;
    availabilityRequestRef.current = requestId;
    const identity = registrationPayload();
    const identityKey = JSON.stringify(identity);
    if (requireComplete && validatedIdentityRef.current === identityKey) return true;
    if (requireComplete && (identity.username.length < 3 || !identity.email || identity.cpf.length !== 11)) {
      setError('Preencha usuario, e-mail e CPF antes de abrir a conta.');
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
      validatedIdentityRef.current = result.available ? identityKey : '';
      if (hasConflict || (requireComplete && !result.available)) setError(result.message || 'Revise os dados antes de continuar.');
      return Boolean(result.available);
    } catch (err) {
      if (requestId !== availabilityRequestRef.current) return false;
      const payload = err?.response?.data;
      const message = typeof payload === 'string' ? payload : payload?.message;
      setAvailability({ status: 'error', accountExists: false, message: message || 'Falha ao verificar os dados.' });
      validatedIdentityRef.current = '';
      if (requireComplete) setError(message || 'Falha ao verificar os dados.');
      return false;
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    const nextValue =
      name === 'cpf' ? formatCpf(value) :
      name === 'phone' ? formatPhone(value) :
      name === 'numericPassword' ? onlyDigits(value).slice(0, 8) :
      value;
    setFormData((current) => ({ ...current, [name]: nextValue }));
    if (['username', 'email', 'cpf'].includes(name)) {
      requestKeyRef.current = '';
      validatedIdentityRef.current = '';
      availabilityRequestRef.current += 1;
      setAvailability({ status: 'idle', accountExists: false, message: '' });
    }
  };

  const handleIdentityBlur = () => {
    const identity = registrationPayload();
    if (identity.username || identity.email || identity.cpf) checkAvailability();
  };

  const handleDocumentChange = (name) => async (event) => {
    setError('');
    try {
      const dataUrl = await readImageAsDataUrl(event.target.files?.[0]);
      setDocuments((current) => ({ ...current, [name]: dataUrl }));
      requestKeyRef.current = '';
    } catch (readError) {
      event.target.value = '';
      setDocuments((current) => ({ ...current, [name]: '' }));
      setError(readError.message || 'Falha ao carregar imagem.');
    }
  };

  const beginBiometrics = async () => {
    setError('');
    if (onlyDigits(String(formData.cpf || '')).length !== 11) {
      setError('Informe CPF com 11 digitos.');
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,64}$/.test(String(formData.password || ''))) {
      setError('A senha alfanumerica deve ter pelo menos 8 caracteres, com letra maiuscula, minuscula e numero.');
      return;
    }
    if (onlyDigits(String(formData.numericPassword || '')).length !== 8) {
      setError('Crie uma senha numerica com exatamente 8 digitos.');
      return;
    }
    if (!documents.documentFrontImage || !documents.documentBackImage) {
      setError('Envie a frente e o verso do documento antes da biometria.');
      return;
    }
    if (!await checkAvailability({ requireComplete: true })) return;
    navigate('/register/biometria');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (onlyDigits(String(formData.cpf || '')).length !== 11) {
      setError('Informe CPF com 11 digitos.');
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,64}$/.test(String(formData.password || ''))) {
      setError('A senha alfanumerica deve ter pelo menos 8 caracteres, com letra maiuscula, minuscula e numero.');
      return;
    }
    if (onlyDigits(String(formData.numericPassword || '')).length !== 8) {
      setError('Crie uma senha numerica com exatamente 8 digitos.');
      return;
    }
    if (!globalThis.crypto?.randomUUID) {
      setError('Este dispositivo precisa de suporte seguro para gerar o protocolo.');
      return;
    }
    if (!documents.documentFrontImage || !documents.documentBackImage || !documents.faceImage) {
      setError('Envie a frente, o verso do documento e a selfie facial.');
      return;
    }
    setLoading(true);
    try {
      if (!await checkAvailability({ requireComplete: true })) return;
      if (!requestKeyRef.current) requestKeyRef.current = `public-account-${globalThis.crypto.randomUUID()}`;
      const registered = await authService.register({
        ...formData,
        cpf: onlyDigits(String(formData.cpf || '')),
        phone: onlyDigits(String(formData.phone || '')),
        password: String(formData.password || ''),
        numericPassword: onlyDigits(String(formData.numericPassword || '')),
        documentFrontImage: documents.documentFrontImage,
        documentBackImage: documents.documentBackImage,
        faceImage: documents.faceImage,
        biometricChallenge: 'FACE_CAMERA_CAPTURE_V1',
        idempotencyKey: requestKeyRef.current,
      });
      clearRegistrationDraft();
      setSubmitted(registered);
    } catch (err) {
      const payload = err?.response?.data;
      const message = typeof payload === 'string' ? payload : payload?.message || err.message;
      if (payload?.accountExists || payload?.code === 'ACCOUNT_ALREADY_EXISTS') {
        setAvailability({ status: 'conflict', accountExists: true, message });
      }
      setError(message || 'Erro ao enviar solicitacao. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const biometricPage = location.pathname.endsWith('/biometria');
  if (biometricPage && (!documents.documentFrontImage || !documents.documentBackImage)) {
    return <Navigate to="/register" replace />;
  }
  if (biometricPage) {
    return (
      <main className="fixed inset-0 z-[100] overflow-y-auto bg-white">
        <div className="mx-auto flex min-h-full w-full max-w-xl items-center justify-center px-4 py-8">
          <LiveFaceCapture
            autoStart
            onCapture={(faceImage) => {
              setDocuments((current) => ({ ...current, faceImage }));
              requestKeyRef.current = '';
            }}
            onSuccessComplete={() => navigate('/register', { replace: true })}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="container-app py-12 sm:py-16">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mx-auto max-w-3xl"
      >
        <div className="card-premium p-8 sm:p-10">
          <div className="mb-7">
            <div className="pill-gold mb-3">
              <UserPlus className="h-3.5 w-3.5" />
              Abertura de conta
            </div>
            <h1 className="title-md">Criar conta Bravus</h1>
            <p className="mt-1.5 text-sm text-ink-300">
              Crie suas duas senhas de acesso. O numero da conta sera gerado automaticamente.
            </p>
          </div>

          {error && <div className="alert-error mb-5" role="alert">{error}</div>}

          {availability.accountExists && (
            <div className="mb-5 flex flex-wrap gap-3" aria-label="Acoes para conta existente">
              <Link to="/login" className="btn-primary !py-2 !px-4">Entrar na conta</Link>
              <Link to="/redefinir-senha" className="btn-secondary !py-2 !px-4">Esqueci minha senha</Link>
            </div>
          )}

          {submitted ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
              <h2 className="mt-4 text-lg font-semibold text-white">Conta criada com sucesso</h2>
              <p className="mt-2 text-sm text-ink-300">
                Sua conta {submitted.accountNumber} foi criada com sucesso. Voce ja pode entrar.
              </p>
              <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-xs text-ink-400">
                Conta: <span className="font-mono text-ink-100">{submitted.accountNumber}</span>
              </div>
              <Link to="/login" className="btn-primary mt-6 w-full">
                Ir para login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Usuario desejado" name="username" value={formData.username || ''} onChange={handleChange} onBlur={handleIdentityBlur} required placeholder="seu.usuario" minLength={3} autoComplete="username" />
                <Field label="E-mail" name="email" type="email" value={formData.email || ''} onChange={handleChange} onBlur={handleIdentityBlur} required placeholder="voce@email.com" autoComplete="email" />
                <Field label="Nome completo" name="fullName" value={formData.fullName || ''} onChange={handleChange} required placeholder="Seu nome completo" autoComplete="name" />
                <Field label="CPF" name="cpf" value={formData.cpf || ''} onChange={handleChange} onBlur={handleIdentityBlur} required placeholder="000.000.000-00" autoComplete="off" />
                <Field label="Telefone" name="phone" type="tel" value={formData.phone || ''} onChange={handleChange} placeholder="(00) 00000-0000" autoComplete="tel" />
                <Field label="Senha alfanumerica" name="password" type="password" value={formData.password || ''} onChange={handleChange} required placeholder="Ex.: Bravus123" minLength={8} maxLength={64} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])[A-Za-z0-9]{8,64}" autoComplete="new-password" />
                <Field label="Senha numerica de 8 digitos" name="numericPassword" type="password" value={formData.numericPassword || ''} onChange={handleChange} required placeholder="00000000" minLength={8} maxLength={8} inputMode="numeric" pattern="[0-9]{8}" autoComplete="off" />
              </div>

              {availability.status === 'available' && (
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200" role="status">
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {availability.message}
                  </span>
                </div>
              )}

              <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 font-semibold text-white">
                    <ShieldCheck className="h-5 w-5 text-gold-300" />
                    Documento do titular
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={documents.documentFrontImage ? 'pill-green' : 'pill-red'}>
                      {documents.documentFrontImage ? <CheckCircle2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                      Frente
                    </span>
                    <span className={documents.documentBackImage ? 'pill-green' : 'pill-red'}>
                      {documents.documentBackImage ? <CheckCircle2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                      Verso
                    </span>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block rounded-lg border border-white/10 bg-black/10 p-4">
                    <span className="text-sm font-medium text-ink-100">Foto da frente *</span>
                    <input
                      className="mt-3 block w-full text-sm text-ink-300"
                      type="file"
                      accept="image/jpeg,image/png"
                      capture="environment"
                      onChange={handleDocumentChange('documentFrontImage')}
                      required
                    />
                  </label>
                  <label className="block rounded-lg border border-white/10 bg-black/10 p-4">
                    <span className="text-sm font-medium text-ink-100">Foto do verso *</span>
                    <input
                      className="mt-3 block w-full text-sm text-ink-300"
                      type="file"
                      accept="image/jpeg,image/png"
                      capture="environment"
                      onChange={handleDocumentChange('documentBackImage')}
                      required
                    />
                  </label>
                </div>
              </section>

              {!documents.faceImage ? (
                <button type="button" onClick={beginBiometrics} className="btn-primary w-full !py-3">
                  Continuar para verificacao facial
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                    <span className="inline-flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      Captura facial concluida com sucesso. Continue para criar a conta.
                    </span>
                  </div>

                  <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Criando conta...
                      </>
                    ) : (
                      <>
                        Continuar e criar minha conta
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          )}

          <p className="mt-6 text-center text-sm text-ink-300">
            Ja e cliente?{' '}
            <Link to="/login" className="font-medium text-gold-300 hover:text-gold-200">
              Entrar
            </Link>
          </p>
        </div>
      </motion.div>
    </main>
  );
}
