'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { newsletterApi } from '../api';

export interface TokenActionLabels {
  title: string;
  working: string;
  success: string;
  /** 連結過期（僅確認流程會發生）：請讀者重新訂閱 */
  expired: string;
  invalid: string;
  error: string;
  /** 退訂流程：按下前的說明與按鈕文字 */
  prompt?: string;
  button?: string;
}

interface TokenActionProps {
  /** confirm：載入即送出。unsubscribe：讀者按下按鈕才送出。 */
  mode: 'confirm' | 'unsubscribe';
  labels: TokenActionLabels;
  /** 結果下方的連結（回首頁…） */
  footer?: ReactNode;
}

type State = 'idle' | 'working' | 'success' | 'expired' | 'invalid' | 'error';

/**
 * 處理信件裡 ?token= 連結的頁面主體。後端的 confirm / unsubscribe 都是 POST：
 * 信箱的安全掃描會預抓信裡的 GET 連結，所以連結只開頁面，真正的動作由這裡送出。
 * 使用 useSearchParams，掛載處需包一層 <Suspense>。
 */
export default function TokenAction({ mode, labels, footer }: TokenActionProps) {
  const token = useSearchParams().get('token') || '';
  const [state, setState] = useState<State>(token ? (mode === 'confirm' ? 'working' : 'idle') : 'invalid');
  const started = useRef(false);

  const run = async () => {
    setState('working');
    try {
      await (mode === 'confirm' ? newsletterApi.confirm(token) : newsletterApi.unsubscribe(token));
      setState('success');
    } catch (err) {
      const status = (err as { status?: number }).status;
      setState(status === 410 ? 'expired' : status === 404 ? 'invalid' : 'error');
    }
  };

  useEffect(() => {
    // started：React StrictMode 在開發模式會跑兩次 effect
    if (mode !== 'confirm' || !token || started.current) return;
    started.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, token]);

  const message: Record<Exclude<State, 'idle'>, string> = {
    working: labels.working,
    success: labels.success,
    expired: labels.expired,
    invalid: labels.invalid,
    error: labels.error,
  };

  return (
    <div className="mx-auto max-w-[680px] px-5 py-24 text-center">
      <h1 className="text-3xl font-semibold text-gray-900">{labels.title}</h1>
      {state === 'idle' ? (
        <>
          {labels.prompt && <p className="mt-6 text-lg text-gray-600">{labels.prompt}</p>}
          <button
            type="button"
            onClick={run}
            className="mt-8 rounded-lg bg-gray-900 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-gray-700"
          >
            {labels.button}
          </button>
        </>
      ) : (
        <p role="status" className={`mt-6 text-lg ${state === 'success' || state === 'working' ? 'text-gray-600' : 'text-red-600'}`}>
          {message[state]}
        </p>
      )}
      {footer && state !== 'working' && <div className="mt-10 text-base">{footer}</div>}
    </div>
  );
}
