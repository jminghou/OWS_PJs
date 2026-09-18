'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { newsletterApi } from '../api';

export interface SubscribeFormLabels {
  /** 給報讀器的欄位名稱（畫面上不顯示） */
  emailLabel: string;
  placeholder: string;
  button: string;
  submitting: string;
  /** 送出成功後取代整個表單的訊息（請提醒讀者去收確認信） */
  success: string;
  invalid: string;
  error: string;
}

interface SubscribeFormProps {
  locale: string;
  /** 表單位置，寫進訂閱紀錄供後台分辨來源，例如 home-hero */
  source: string;
  labels: SubscribeFormLabels;
  /** 表單下方的小字（寄送頻率、隱私權連結…），由站台決定內容 */
  note?: ReactNode;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const DEFAULT_INPUT =
  'w-full min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900';
const DEFAULT_BUTTON =
  'rounded-lg bg-gray-900 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60';

export default function SubscribeForm({
  locale, source, labels, note, className = '', inputClassName = DEFAULT_INPUT, buttonClassName = DEFAULT_BUTTON,
}: SubscribeFormProps) {
  const inputId = useId();
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError(labels.invalid);
      return;
    }
    setError('');
    setState('submitting');
    try {
      await newsletterApi.subscribe({ email: value, locale, source, website });
      setState('done');
    } catch (err) {
      setState('idle');
      setError((err as { status?: number }).status === 400 ? labels.invalid : labels.error);
    }
  };

  if (state === 'done') {
    return (
      <div role="status" className={`rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800 ${className}`}>
        {labels.success}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={className}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor={inputId} className="sr-only">{labels.emailLabel}</label>
        <input
          id={inputId}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={labels.placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={inputClassName}
        />
        {/* honeypot：對真人隱藏（含報讀器與 Tab 順序），機器人會填 */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>
        <button type="submit" disabled={state === 'submitting'} className={buttonClassName}>
          {state === 'submitting' ? labels.submitting : labels.button}
        </button>
      </div>
      {error && (
        <p id={`${inputId}-error`} role="alert" className="mt-2 text-sm text-red-600">{error}</p>
      )}
      {note && <div className="mt-3 text-sm text-gray-500">{note}</div>}
    </form>
  );
}
