/** 與 packages/studio/models.py 的 to_dict() 對應。 */

export type Stage =
  | 'collect' | 'organize' | 'ideate' | 'write' | 'edit' | 'scheduled' | 'published' | 'archived';

export type Platform = 'blog' | 'facebook' | 'instagram' | 'threads' | 'linkedin' | 'newsletter' | 'video_script';

/** 卡片類型代碼；清單可在後台「卡片類型」設定，預設五種見 cardKinds.ts。 */
export type CardKind = string;

export type InboxKind = 'text' | 'link' | 'image';
export type InboxStatus = 'new' | 'organized' | 'archived';

export type RevisionKind = 'autosave' | 'named' | 'published';

export type PublishCheckLevel = 'block' | 'warn' | 'pass';

export interface PublishCheck {
  rule: string;
  level: PublishCheckLevel;
  message: string;
  location?: string | null;
}

export interface PublishMedia {
  file_id?: number;
  public_url?: string;
  mime?: string;
}

export interface PublishPayload {
  message?: string;
  link?: string | null;
  media?: PublishMedia[];
  scheduled_for?: string | null;
}

export interface PublishRequest {
  id: number;
  document_id: number;
  target: string;
  state: string;
  payload: PublishPayload;
  content_hash: string;
  check_report: PublishCheck[];
  error_code?: string | null;
  error_message?: string | null;
  external_url?: string | null;
  external_post_id?: string | null;
}

/** 粉專發送開關。不是 live 時畫面要標出來。token 與 Page ID 不在這個型別裡。 */
export type FbPublishMode = 'off' | 'dry_run' | 'fake' | 'live';

export interface FbPublishHealth {
  mode: FbPublishMode | string;
  page_id_configured: boolean;
  token_configured: boolean;
  page_id_matches: boolean;
}

export type TagTargetType = 'project' | 'document' | 'card' | 'inbox_item';

export interface StudioTag {
  id: number;
  name: string;
  created_at?: string | null;
  counts?: Record<string, number>;
  total?: number;
}

export interface Pagination {
  page: number;
  pages: number;
  per_page: number;
  total: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface Project {
  id: number;
  title: string;
  slug: string;
  stage: Stage;
  thesis: string | null;
  description: string | null;
  cover_image: string | null;
  owner_id: number | null;
  attributes: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
  tags?: StudioTag[];
  document_counts?: Record<string, number>;
}

export interface ContentSummary {
  id: number;
  title: string;
  slug: string;
  status: string;
  published_at: string | null;
  updated_at: string | null;
  language?: string;
}

export interface ArticleSettings {
  summary: string | null; slug: string; featured_image: string | null; cover_image: string | null;
  meta_title: string | null; meta_description: string | null; author_id: number | null;
  category_id: number | null; tag_ids: number[];
}
export interface EditorOptions {
  default_language: string; enabled: boolean; languages: string[]; language_names: Record<string,string>;
  authors: {id:number;name:string}[]; categories: {id:number;name:string}[]; tags: {id:number;name:string}[];
}
export interface DocumentRef {
  id: number;
  title: string | null;
  platform: Platform;
  language: string;
}

export interface Document {
  work_id: string;
  language: string;
  translation_source_id?: number | null;
  language_versions?: Document[];
  source_changed?: boolean;
  source_title?: string | null;
  /** 衍生自哪篇主體（只記在原始語言版本上；翻譯沿 translation_source 找） */
  derived_from_id?: number | null;
  /** 主體在上次「依主體更新」之後又改過 */
  derived_changed?: boolean;
  /** 這份文件（或其翻譯來源）所屬的主體 id；專案頁用來畫樹 */
  main_id?: number | null;
  main_document?: DocumentRef | null;
  /** 主體才有：從它散出去的全部版本（含翻譯） */
  derived_documents?: Document[];
  /** 可指定為主體的文件 */
  main_candidates?: DocumentRef[];
  article_settings?: ArticleSettings | null;
  id: number;
  project_id: number;
  platform: Platform;
  title: string | null;
  body?: string | null;
  stage: Stage;
  content_id: number | null;
  scheduled_at: string | null;
  published_at: string | null;
  published_url: string | null;
  current_revision_id: number | null;
  attributes: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
  tags?: StudioTag[];
  project?: { id: number; title: string; stage?: Stage };
  content?: ContentSummary | null;
  cards?: Card[];
  latest_revision?: Revision | null;
  revision_count?: number;
}

export interface Revision {
  id: number;
  document_id: number;
  kind: RevisionKind;
  label: string | null;
  title: string | null;
  body?: string | null;
  body_length: number;
  created_by: number | null;
  created_at: string | null;
}

export interface Card {
  id: number;
  kind: CardKind;
  title: string;
  body: string | null;
  source_url: string | null;
  source_note: string | null;
  status: 'active' | 'archived';
  created_by: number | null;
  attributes: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
  tags?: StudioTag[];
  ref_count?: number;
  refs?: CardRef[];
  related_cards?: Card[];
}

export interface CardRef {
  id: number;
  card_id: number;
  target_type: 'project' | 'document';
  target_id: number;
  created_at: string | null;
  title?: string | null;
  platform?: Platform | null;
  project_id?: number | null;
}

export interface InboxItem {
  id: number;
  kind: InboxKind;
  title: string | null;
  body: string | null;
  url: string | null;
  file_id: number | null;
  file_url: string | null;
  status: InboxStatus;
  project_id: number | null;
  card_id: number | null;
  created_by: number | null;
  created_at: string | null;
  tags?: StudioTag[];
}

export interface Source {
  id: number;
  project_id: number;
  title: string | null;
  url: string | null;
  note: string | null;
  file_id: number | null;
  file_url: string | null;
  inbox_item_id: number | null;
  created_at: string | null;
}

export interface ProjectDetail extends Project {
  documents: Document[];
  sources: Source[];
  cards: Card[];
}

export interface TodayResponse {
  now: string;
  recent: Document[];
  pending: Document[];
  upcoming: Document[];
  inbox: { count: number; items: InboxItem[] };
  project_stage_counts: Record<string, number>;
  flow_counts: Record<'capture' | 'organize' | 'write' | 'adapt' | 'publish', number>;
}

export interface ContentStatus {
  bound: boolean;
  content?: ContentSummary;
  content_newer?: boolean;
  diverged?: boolean;
}

export interface SearchResults {
  q: string;
  total?: number;
  results: {
    projects?: Array<{ id: number; title: string; stage: Stage; snippet: string }>;
    documents?: Array<{ id: number; title: string | null; platform: Platform; stage: Stage; project_id: number; project_title: string; snippet: string }>;
    revisions?: Array<{ id: number; label: string | null; kind: RevisionKind; title: string | null; document_id: number; platform: Platform; created_at: string | null; snippet: string }>;
    cards?: Array<{ id: number; title: string; kind: CardKind; status: string; snippet: string }>;
    tags?: StudioTag[];
    sources?: Array<{ id: number; title: string | null; url: string | null; project_id: number; project_title: string; snippet: string }>;
    inbox?: Array<{ id: number; title: string | null; kind: InboxKind; status: InboxStatus; snippet: string }>;
    files?: Array<{ id: number; filename: string; public_url: string; mime_type: string | null; snippet: string }>;
    articles?: Array<{ id: number; title: string; slug: string; status: string; document_id: number | null; snippet: string }>;
  };
}
