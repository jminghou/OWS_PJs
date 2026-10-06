/**
 * 提示框（docs/BRAND_GUIDELINES.md §6.4）：底和字依語意色，開頭放 Lucide 圖示。
 * 錯誤一律走 error（橘紅），禁止用品牌粉表示錯誤。
 */
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { clsx } from 'clsx';

export type AlertTone = 'success' | 'warning' | 'error' | 'info';

const TONES: Record<AlertTone, { box: string; Icon: typeof Info }> = {
  success: { box: 'bg-success-bg text-success-fg', Icon: CheckCircle2 },
  warning: { box: 'bg-warning-bg text-warning-fg', Icon: AlertTriangle },
  error: { box: 'bg-error-bg text-error-fg', Icon: XCircle },
  info: { box: 'bg-blue-50 text-blue-800', Icon: Info },
};

interface AlertProps {
  tone?: AlertTone;
  children: ReactNode;
  className?: string;
  /** error 預設 role="alert"，其餘 role="status" */
  role?: string;
}

export default function Alert({ tone = 'info', children, className, role }: AlertProps) {
  const { box, Icon } = TONES[tone];
  return (
    <div
      role={role ?? (tone === 'error' ? 'alert' : 'status')}
      className={clsx('flex gap-3 rounded-inner px-[18px] py-[14px] text-sm leading-relaxed', box, className)}
    >
      <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
