'use client';

import type { MemberColumnDef, MemberRow } from '@ows/platform-api';
import { AdminSheet } from '@ows/ui/admin';
import ExtraValue from './ExtraValue';
import MemberAvatar from './MemberAvatar';
import { formatDateTime, formatRelative } from './format';

interface Props {
  member: MemberRow | null;
  columns: MemberColumnDef[];
  canManage: boolean;
  busy: boolean;
  onClose: () => void;
  onToggleStatus: (member: MemberRow) => void;
}

const btn =
  'inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <dt className="text-sm text-muted-foreground flex-shrink-0">{label}</dt>
      <dd className="text-sm text-foreground text-right min-w-0 break-all">{children}</dd>
    </div>
  );
}

/** 會員詳細資料：一位會員一張卡，手機全螢幕。 */
export default function MemberDetailSheet({ member, columns, canManage, busy, onClose, onToggleStatus }: Props) {
  const name = member ? member.display_name || member.email || member.username : '';
  return (
    <AdminSheet
      open={!!member}
      onClose={onClose}
      title="會員資料"
      size="md"
      mobile="full"
      footer={
        member && canManage ? (
          <div className="flex justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => onToggleStatus(member)}
              className={`${btn} ${
                member.is_active
                  ? 'border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950'
                  : 'border-border text-foreground hover:bg-muted'
              }`}
            >
              {busy ? '處理中…' : member.is_active ? '停用此會員' : '重新啟用'}
            </button>
          </div>
        ) : undefined
      }
    >
      {member && (
        <div>
          <div className="flex items-center gap-3 pb-4">
            <MemberAvatar src={member.avatar} name={name} size={56} />
            <div className="min-w-0">
              <div className="text-base font-semibold text-foreground truncate">{name}</div>
              {member.display_name && <div className="text-sm text-muted-foreground break-all">{member.email}</div>}
              <div className="mt-1">
                {member.is_active ? (
                  <span className="inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">啟用中</span>
                ) : (
                  <span className="inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200">已停用</span>
                )}
              </div>
            </div>
          </div>
          <dl>
            <Field label="Email">{member.email}</Field>
            <Field label="會員編號"><span className="tabular-nums">{member.id}</span></Field>
            {columns.map((c) => (
              <Field key={c.key} label={c.label}><ExtraValue kind={c.kind} value={member.extras[c.key]} /></Field>
            ))}
            <Field label="密碼登入">{member.password_set ? '已設定密碼' : '未設定（只用社群帳號登入）'}</Field>
            <Field label="註冊時間">{formatDateTime(member.created_at)}</Field>
            <Field label="最近登入">
              {member.last_login ? `${formatDateTime(member.last_login)}（${formatRelative(member.last_login)}）` : '從未登入'}
            </Field>
          </dl>
          {canManage && member.is_active && (
            <p className="mt-3 text-xs text-muted-foreground">停用後這位會員無法登入；訂單與資料都會保留，之後可以重新啟用。</p>
          )}
        </div>
      )}
    </AdminSheet>
  );
}
