'use client';

import Link from 'next/link';
import { FLOW_STEPS, STUDIO_ROUTES } from '../constants';
import type { FlowStep } from '../constants';

interface Props {
  counts?: Partial<Record<FlowStep, number>>;
  active?: FlowStep | null;
  /** 不給就用連結導到專案列表；給了就改成按鈕回呼（專案頁自己切篩選用） */
  onSelect?: (step: FlowStep) => void;
}

/** 收集 → 整理 → 寫作 → 改編 → 發布 的五步流程列。 */
export function FlowBar({ counts = {}, active, onSelect }: Props) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {FLOW_STEPS.map((step, idx) => {
        const isActive = active === step.key;
        const n = counts[step.key];
        const cls = `flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium border transition ${
          isActive
            ? 'bg-admin-accent-100 border-admin-accent-200 text-admin-accent-800 dark:bg-admin-accent-800/40 dark:border-admin-accent-700 dark:text-admin-accent-100'
            : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted'
        }`;
        const inner = (
          <>
            <span className="tabular-nums opacity-70">{idx + 1}</span>
            <span>{step.label}</span>
            {typeof n === 'number' && n > 0 && (
              <span className={`ml-1 tabular-nums text-xs px-1.5 py-0.5 rounded-md ${isActive ? 'bg-admin-accent-200/70 dark:bg-admin-accent-700/60' : 'bg-muted'}`}>{n}</span>
            )}
          </>
        );
        return onSelect ? (
          <button key={step.key} type="button" onClick={() => onSelect(step.key)} className={cls} title={step.hint}>{inner}</button>
        ) : (
          <Link key={step.key} href={STUDIO_ROUTES.projectsByFlow(step.key)} className={cls} title={step.hint}>{inner}</Link>
        );
      })}
    </div>
  );
}
