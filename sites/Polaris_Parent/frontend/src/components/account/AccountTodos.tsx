'use client';

/** 會員中心最上方「需要你處理」：待付款、設計你的書、確認打樣、預約解讀等，按下直接去做。 */
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { Todo } from './orderModel';

const SHOW = 4;

export default function AccountTodos({ todos }: { todos: Todo[] }) {
  const [all, setAll] = useState(false);
  const actions = todos.filter((t) => t.tone === 'action').length;

  if (!todos.length) {
    return (
      <p className="flex items-center gap-2 rounded-card bg-white px-5 py-4 text-sm text-text">
        <CheckCircle2 className="h-5 w-5 text-success-fg" strokeWidth={2} aria-hidden="true" />
        目前沒有需要你處理的事項。
      </p>
    );
  }

  const shown = all ? todos : todos.slice(0, SHOW);
  return (
    <section aria-labelledby="todo-title">
      <h2 id="todo-title" className="mb-3 font-heading text-[18px] font-normal text-ink md:text-h4">
        {actions ? <>需要你處理<span className="ml-2 font-latin text-blue-500">{actions}</span></> : '最新動態'}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((t) => (
          <li key={t.key}>
            <Link href={t.href}
              className={clsx(
                'group flex h-full flex-col rounded-card p-5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100',
                t.tone === 'action' ? 'bg-blue-50' : 'bg-white',
              )}>
              <span className={clsx('text-[13px] font-medium', t.tone === 'action' ? 'text-blue-700' : 'text-muted')}>{t.label}</span>
              <span className="mt-1 line-clamp-1 font-medium text-ink">{t.title}</span>
              <span className="mt-1 flex-1 text-sm text-text">{t.detail}</span>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-500 group-hover:underline">
                {t.cta}<ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {todos.length > SHOW && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 min-h-[44px] text-sm text-blue-500 hover:underline">
          {all ? '收合' : `還有 ${todos.length - SHOW} 項`}
        </button>
      )}
    </section>
  );
}
