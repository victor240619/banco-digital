import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { authService } from '../services/api';

const errorMessage = (error) => {
  const data = error?.response?.data;
  if (typeof data?.message === 'string') return data.message;
  if (typeof data === 'string') return data;
  return 'Não foi possível alterar a senha.';
};

export default function PasswordChangePanel({ onSuccess, onError }) {
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmation: '' });
  const [submitting, setSubmitting] = useState(false);
  const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

  const updatePassword = (field, value) => setPasswords((current) => ({ ...current, [field]: value }));

  const submitPasswordChange = async (event) => {
    event.preventDefault();
    onError('');
    onSuccess('');
    if (!passwords.currentPassword) {
      onError('Informe sua senha atual.');
      return;
    }
    if (!strongPassword.test(passwords.newPassword)) {
      onError('A nova senha deve ter no mínimo 8 caracteres, com letra maiúscula, minúscula e número.');
      return;
    }
    if (passwords.newPassword !== passwords.confirmation) {
      onError('A confirmação da nova senha não confere.');
      return;
    }
    try {
      setSubmitting(true);
      await authService.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: '', newPassword: '', confirmation: '' });
      onSuccess('Senha alterada com segurança. As outras sessões da conta foram encerradas.');
    } catch (error) {
      onError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card-premium max-w-2xl p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-300/15 text-amber-200">
          <KeyRound className="h-5 w-5" />
        </span>
        <div>
          <h2 className="title-md">Trocar senha</h2>
          <p className="mt-1 text-sm text-ink-400">Confirme a senha atual e defina uma nova senha forte.</p>
        </div>
      </div>

      <form className="mt-6 space-y-4" onSubmit={submitPasswordChange}>
        <div>
          <label className="form-label" htmlFor="current-password">Senha atual</label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            className="form-input"
            value={passwords.currentPassword}
            onChange={(event) => updatePassword('currentPassword', event.target.value)}
            maxLength={128}
            required
          />
        </div>
        <div>
          <label className="form-label" htmlFor="new-password">Nova senha</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            className="form-input"
            value={passwords.newPassword}
            onChange={(event) => updatePassword('newPassword', event.target.value)}
            minLength={8}
            maxLength={128}
            required
          />
          <p className="mt-2 text-xs text-ink-400">Use 8 ou mais caracteres, com maiúscula, minúscula e número.</p>
        </div>
        <div>
          <label className="form-label" htmlFor="confirm-password">Confirmar nova senha</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            className="form-input"
            value={passwords.confirmation}
            onChange={(event) => updatePassword('confirmation', event.target.value)}
            minLength={8}
            maxLength={128}
            required
          />
        </div>
        <button type="submit" className="btn-primary w-full justify-center" disabled={submitting}>
          <KeyRound className="h-4 w-4" />
          {submitting ? 'Alterando senha...' : 'Alterar senha'}
        </button>
      </form>
    </section>
  );
}
