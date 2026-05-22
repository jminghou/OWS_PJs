'use client';

import { useMemo, useState } from 'react';
import { Check, X, Sparkles, ChevronDown, ChevronUp, FilePlus2 } from 'lucide-react';
import { extractToc, extractKeyTakeaways } from '@/lib/articleContent';
import { extractFaqFromMarkdown, extractHowToSteps } from '@/lib/seo';

/**
 * 開新文章可插入的 AEO 結構骨架（HTML，與 TipTap 相容）。填空即可觸發各項功能。
 */
export const AEO_TEMPLATE = `<h2>重點整理</h2>
<ul><li>（填入 3–5 個核心重點，每點一句話）</li><li></li><li></li></ul>
<h2>（第一個小標：把它寫成讀者會問的問題）</h2>
<p>（這一段「開頭就直接回答」，再展開說明細節。）</p>
<h2>（第二個小標）</h2>
<p>（內容…）</p>
<h2>操作步驟</h2>
<ol><li>（第一步）</li><li>（第二步）</li><li>（第三步）</li></ol>
<h2>常見問題</h2>
<h3>（問題一？）</h3>
<p>（答案一）</p>
<h3>（問題二？）</h3>
<p>（答案二）</p>`;

interface CheckItem {
  label: string;
  ok: boolean;
  detail?: string; // 偵測到的數量
  hint: string; // 未達成時的提示
}

interface AeoAssistantProps {
  content: string;
  summary: string;
  onInsertTemplate: () => void;
}

export default function AeoAssistant({ content, summary, onInsertTemplate }: AeoAssistantProps) {
  const [open, setOpen] = useState(true);

  const checks: CheckItem[] = useMemo(() => {
    const { takeaways, body } = extractKeyTakeaways(content);
    const toc = extractToc(body); // 與正式頁一致：目錄跑在「重點整理已移除」的內文上
    const faqs = extractFaqFromMarkdown(content);
    const howto = extractHowToSteps(content);
    return [
      {
        label: '文章摘要',
        ok: summary.trim().length > 0,
        hint: '在上方摘要欄填 1–2 句總結（會成為 AI 抓取的 TL;DR）',
      },
      {
        label: '重點整理',
        ok: takeaways.length > 0,
        detail: takeaways.length ? `偵測到 ${takeaways.length} 點` : undefined,
        hint: '加一個「重點整理」標題2，下面用項目清單列重點',
      },
      {
        label: '目錄（標題錨點）',
        ok: toc.length >= 3,
        detail: toc.length ? `偵測到 ${toc.length} 個標題` : undefined,
        hint: '用標題2／標題3 分段（至少 3 個才會顯示目錄）',
      },
      {
        label: '常見問題 FAQ',
        ok: faqs.length > 0,
        detail: faqs.length ? `偵測到 ${faqs.length} 題` : undefined,
        hint: '「常見問題」標題2 + 每個問題用標題3、答案用段落',
      },
      {
        label: '操作步驟 HowTo',
        ok: howto.steps.length >= 2,
        detail: howto.steps.length ? `偵測到 ${howto.steps.length} 步` : undefined,
        hint: '「操作步驟」標題2 + 用「編號清單」列步驟（至少 2 步）',
      },
    ];
  }, [content, summary]);

  const done = checks.filter((c) => c.ok).length;
  const total = checks.length;

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      {/* 標題列 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/70">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-gray-800"
        >
          <Sparkles size={15} className="text-amber-500" />
          AEO 結構助手
          <span
            className={`text-xs font-normal px-1.5 py-0.5 rounded-full ${
              done === total ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
            }`}
          >
            {done}/{total}
          </span>
          {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </button>

        <button
          type="button"
          onClick={onInsertTemplate}
          className="flex items-center gap-1 text-xs font-medium text-brand-purple-700 hover:text-brand-purple-900 bg-brand-purple-50 hover:bg-brand-purple-100 px-2.5 py-1 rounded-lg transition-colors"
          title="插入一份含重點整理／常見問題／操作步驟的結構骨架"
        >
          <FilePlus2 size={13} />
          插入 AEO 範本
        </button>
      </div>

      {/* 檢查清單 */}
      {open && (
        <ul className="divide-y divide-gray-50">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2.5 px-4 py-2">
              <span className={`mt-0.5 flex-shrink-0 ${c.ok ? 'text-green-600' : 'text-gray-300'}`}>
                {c.ok ? <Check size={16} /> : <X size={16} />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${c.ok ? 'text-gray-900' : 'text-gray-500'}`}>{c.label}</span>
                  {c.detail && <span className="text-xs text-green-600">{c.detail}</span>}
                </div>
                {!c.ok && <p className="text-xs text-gray-400 mt-0.5">{c.hint}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
