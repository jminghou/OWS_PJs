import type { CardKind, Platform, Stage } from './types';

export const STAGES: Stage[] = [
  'collect', 'organize', 'ideate', 'write', 'edit', 'scheduled', 'published', 'archived',
];

export const STAGE_META: Record<Stage, { label: string; className: string }> = {
  collect:   { label: '收集',   className: 'bg-gray-100 text-gray-600' },
  organize:  { label: '整理',   className: 'bg-slate-100 text-slate-700' },
  ideate:    { label: '構思',   className: 'bg-violet-50 text-violet-700' },
  write:     { label: '撰寫',   className: 'bg-blue-50 text-blue-700' },
  edit:      { label: '編輯',   className: 'bg-amber-50 text-amber-700' },
  scheduled: { label: '待發布', className: 'bg-orange-50 text-orange-700' },
  published: { label: '已發布', className: 'bg-emerald-50 text-emerald-700' },
  archived:  { label: '封存',   className: 'bg-gray-100 text-gray-400' },
};

export const PLATFORMS: Platform[] = ['blog', 'facebook', 'instagram', 'threads', 'newsletter', 'video_script'];

export interface PlatformMeta {
  label: string;
  short: string;
  /** 富文字（TipTap）或純文字 */
  editor: 'rich' | 'plain' | 'script';
  /** 字數上限（純文字平台），undefined = 不限 */
  maxChars?: number;
  hint?: string;
}

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  blog:         { label: '部落格', short: 'Blog', editor: 'rich', hint: '正式版存在文章管理的 contents；此處為工作草稿' },
  facebook:     { label: 'Facebook', short: 'FB', editor: 'plain', maxChars: 63206, hint: '建議 600 字內，前 3 行決定點開率' },
  instagram:    { label: 'Instagram', short: 'IG', editor: 'plain', maxChars: 2200, hint: '上限 2,200 字，hashtag 最多 30 個' },
  threads:      { label: 'Threads', short: 'Threads', editor: 'plain', maxChars: 500, hint: '單則上限 500 字' },
  newsletter:   { label: '電子報', short: 'Email', editor: 'rich', hint: '主旨行放在標題欄' },
  video_script: { label: '影片腳本', short: 'Script', editor: 'script', hint: '開場鉤子 → 主體 → 收尾 CTA' },
};

export const CARD_KINDS: CardKind[] = ['viewpoint', 'case', 'research', 'ziwei', 'brand_principle'];

export const CARD_KIND_META: Record<CardKind, { label: string; className: string }> = {
  viewpoint:       { label: '觀點',     className: 'bg-blue-50 text-blue-700' },
  case:            { label: '案例',     className: 'bg-emerald-50 text-emerald-700' },
  research:        { label: '研究資料', className: 'bg-amber-50 text-amber-700' },
  ziwei:           { label: '紫微概念', className: 'bg-violet-50 text-violet-700' },
  brand_principle: { label: '品牌原則', className: 'bg-rose-50 text-rose-700' },
};

/** 今天頁五步流程列 ↔ 專案 stage（與後端 constants.FLOW_STEPS 同一份）。adapt 由後端以「有非 blog 版本」判斷。 */
export type FlowStep = 'capture' | 'organize' | 'write' | 'adapt' | 'publish';
export const FLOW_STEPS: Array<{ key: FlowStep; label: string; stages: Stage[]; hint: string }> = [
  { key: 'capture',  label: '捕捉', stages: ['collect'],                hint: '收集箱待整理 + 收集階段的專案' },
  { key: 'organize', label: '整理', stages: ['organize', 'ideate'],     hint: '整理與構思中的專案' },
  { key: 'write',    label: '寫作', stages: ['write', 'edit'],          hint: '撰寫與編輯中的專案' },
  { key: 'adapt',    label: '改編', stages: [],                         hint: '已有部落格以外版本的專案' },
  { key: 'publish',  label: '發布', stages: ['scheduled', 'published'], hint: '待發布與已發布的專案' },
];

export const STUDIO_ROUTES = {
  today: '/admin/studio/today',
  inbox: '/admin/studio/inbox',
  projects: '/admin/studio/projects',
  projectsByFlow: (flow: FlowStep) => `/admin/studio/projects?flow=${flow}`,
  project: (id: number) => `/admin/studio/projects?id=${id}`,
  workspace: (docId: number) => `/admin/studio/workspace?doc=${docId}`,
  cards: '/admin/studio/cards',
  card: (id: number) => `/admin/studio/cards?id=${id}`,
  cardKinds: '/admin/studio/card-kinds',
  publishing: '/admin/studio/publishing',
  tags: '/admin/studio/tags',
  tag: (id: number) => `/admin/studio/tags?id=${id}`,
  article: (id: number) => `/admin/articles?id=${id}`,
};
