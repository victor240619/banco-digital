import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, FileText, Loader2, ShieldCheck,
} from 'lucide-react';
import Logo from '../components/Logo';
import { authService, userService } from '../services/api';

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
  const idempotencyKeyRef = useRef('');
  const [evidence, setEvidence] = useState({ documentFrontImage: '', documentBackImage: '' });
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const reconcileIdentityStatus = async () => {
      try {
        const { data } = await userService.getProfile();
        if (!active) return;
        if (data?.identityEvidenceRequired === false) {
          authService.updateCurrentUser({ identityEvidenceRequired: false });
          navigate('/dashboard', { replace: true });
          return;
        }
      } catch {
        // Keep the enrollment page available when profile refresh is temporarily unavailable.
      }
      if (active) setCheckingProfile(false);
    };
    void reconcileIdentityStatus();
    return () => {
      active = false;
    };
  }, [navigate]);

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

  const submit = async () => {
    if (!evidence.documentFrontImage || !evidence.documentBackImage) {
      setError('Envie frente e verso do documento.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = createIdempotencyKey();
      await userService.submitIdentityEvidence(evidence, idempotencyKeyRef.current);
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

  if (checkingProfile) {
    return (
      <main className="container-app native-safe-bottom py-4 sm:py-8">
        <section className="card-premium mx-auto flex max-w-xl items-center justify-center gap-3 p-8 text-sm text-ink-200">
          <Loader2 className="h-4 w-4 animate-spin text-gold-300" />
          Verificando documentos enviados...
        </section>
      </main>
    );
  }

  return (
    <main className="container-app native-safe-bottom py-4 sm:py-8">
      <section className="card-premium mx-auto max-w-xl p-5 sm:p-8">
        <Logo className="mb-6 w-fit" />
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gold-400/15 text-gold-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold">Confirmar identidade</h1>
            <p className="mt-1 text-sm leading-relaxed text-ink-300">
              Envie frente e verso do documento para analise administrativa. A biometria facial foi removida deste fluxo.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <EvidenceStatus ready={Boolean(evidence.documentFrontImage)} label="Frente" />
          <EvidenceStatus ready={Boolean(evidence.documentBackImage)} label="Verso" />
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

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="btn-secondary" onClick={() => navigate('/dashboard')} disabled={loading}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <button type="button" className="btn-primary flex-1" onClick={submit} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : <><ShieldCheck className="h-4 w-4" /> Enviar para analise</>}
          </button>
        </div>
      </section>
    </main>
  );
}
