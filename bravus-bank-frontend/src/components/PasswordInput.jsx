import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function PasswordInput({ className = 'form-input', ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`${className} !pr-14`} />
      <button
        type="button"
        className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-ink-300 hover:text-gold-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300"
        aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${props.id === 'confirm-new-password' ? 'confirmação da senha' : props.autoComplete === 'new-password' ? 'nova senha' : 'senha'}`}
        aria-pressed={visible}
        aria-controls={props.id}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
      </button>
    </div>
  );
}
