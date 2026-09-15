import { request } from '@ows/platform-api/client';
import type {
  Card, CardKind, CardRef, ContentStatus, Document, InboxItem, InboxStatus, Pagination, Platform,
  Project, ProjectDetail, Revision, SearchResults, Source, Stage, StudioTag, TagTargetType, TodayResponse,
} from '../types';

const BASE = '/studio';

export const todayApi = {
  get: () => request<TodayResponse>(`${BASE}/today`),
};

export const projectApi = {
  list: (params?: { stage?: string; flow?: string; search?: string; page?: number; per_page?: number; include_archived?: 1 }) =>
    request<{ projects: Project[]; pagination: Pagination }>(`${BASE}/projects`, { params }),
  get: (id: number) => request<ProjectDetail>(`${BASE}/projects/${id}`),
  create: (data: Partial<Project> & { title: string; tag_ids?: number[] }) =>
    request<{ id: number; project: Project }>(`${BASE}/projects`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Project> & { tag_ids?: number[] }) =>
    request<{ project: Project }>(`${BASE}/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setStage: (id: number, stage: Stage) =>
    request<{ stage: Stage }>(`${BASE}/projects/${id}/stage`, { method: 'PUT', body: JSON.stringify({ stage }) }),
  delete: (id: number) => request<{ message: string }>(`${BASE}/projects/${id}`, { method: 'DELETE' }),

  listSources: (projectId: number) => request<{ sources: Source[] }>(`${BASE}/projects/${projectId}/sources`),
  createSource: (projectId: number, data: Partial<Source>) =>
    request<{ source: Source }>(`${BASE}/projects/${projectId}/sources`, { method: 'POST', body: JSON.stringify(data) }),
  updateSource: (id: number, data: Partial<Source>) =>
    request<{ source: Source }>(`${BASE}/sources/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSource: (id: number) => request<{ message: string }>(`${BASE}/sources/${id}`, { method: 'DELETE' }),
};

export const documentApi = {
  list: (projectId: number) => request<{ documents: Document[] }>(`${BASE}/projects/${projectId}/documents`),
  create: (projectId: number, data: { platform: Platform; title?: string; body?: string; content_id?: number; stage?: Stage; summary?: string }) =>
    request<{ id: number; document: Document }>(`${BASE}/projects/${projectId}/documents`, { method: 'POST', body: JSON.stringify(data) }),
  get: (id: number) => request<Document>(`${BASE}/documents/${id}`),
  update: (id: number, data: Partial<Document> & { tag_ids?: number[] }) =>
    request<{ document: Document }>(`${BASE}/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request<{ message: string }>(`${BASE}/documents/${id}`, { method: 'DELETE' }),

  autosave: (id: number, data: { title?: string; body?: string }) =>
    request<{ saved_at: string; revision: Revision | null }>(`${BASE}/documents/${id}/autosave`, { method: 'POST', body: JSON.stringify(data) }),
  listRevisions: (id: number, kind?: string) =>
    request<{ revisions: Revision[] }>(`${BASE}/documents/${id}/revisions`, { params: kind ? { kind } : undefined }),
  createRevision: (id: number, data: { label: string; title?: string; body?: string }) =>
    request<{ revision: Revision }>(`${BASE}/documents/${id}/revisions`, { method: 'POST', body: JSON.stringify(data) }),
  getRevision: (revisionId: number) => request<Revision & { body: string | null }>(`${BASE}/revisions/${revisionId}`),
  renameRevision: (revisionId: number, label: string) =>
    request<{ revision: Revision }>(`${BASE}/revisions/${revisionId}`, { method: 'PUT', body: JSON.stringify({ label }) }),
  restoreRevision: (revisionId: number) =>
    request<{ document: Document; backup_revision: Revision }>(`${BASE}/revisions/${revisionId}/restore`, { method: 'POST' }),

  contentStatus: (id: number) => request<ContentStatus>(`${BASE}/documents/${id}/content-status`),
  loadFromContent: (id: number) =>
    request<{ document: Document }>(`${BASE}/documents/${id}/load-from-content`, { method: 'POST' }),
  syncToContent: (id: number, data: { mode: 'save' | 'publish'; title?: string; body?: string; summary?: string; published_at?: string }) =>
    request<{ document: Document; revision: Revision | null }>(`${BASE}/documents/${id}/sync-to-content`, { method: 'POST', body: JSON.stringify(data) }),

  updatePublishing: (id: number, data: { stage?: Stage; scheduled_at?: string | null; published_at?: string | null; published_url?: string | null }) =>
    request<{ document: Document; revision: Revision | null }>(`${BASE}/documents/${id}/publishing`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const cardApi = {
  list: (params?: { kind?: string; status?: string; search?: string; page?: number; per_page?: number }) =>
    request<{ cards: Card[]; pagination: Pagination }>(`${BASE}/cards`, { params }),
  get: (id: number) => request<Card>(`${BASE}/cards/${id}`),
  create: (data: { title: string; kind?: CardKind; body?: string; source_url?: string; source_note?: string; tag_ids?: number[]; refs?: Array<{ target_type: 'project' | 'document'; target_id: number }> }) =>
    request<{ id: number; card: Card }>(`${BASE}/cards`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Card> & { tag_ids?: number[] }) =>
    request<{ card: Card }>(`${BASE}/cards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request<{ message: string }>(`${BASE}/cards/${id}`, { method: 'DELETE' }),
  batch: (ids: number[], action: 'delete' | 'set_kind', kind?: string) =>
    request<{ count: number }>(`${BASE}/cards/batch`, { method: 'POST', body: JSON.stringify({ ids, action, kind }) }),
  addRef: (id: number, target_type: 'project' | 'document', target_id: number) =>
    request<{ ref: CardRef }>(`${BASE}/cards/${id}/refs`, { method: 'POST', body: JSON.stringify({ target_type, target_id }) }),
  removeRef: (id: number, target_type: 'project' | 'document', target_id: number) =>
    request<{ message: string }>(`${BASE}/cards/${id}/refs`, { method: 'DELETE', body: JSON.stringify({ target_type, target_id }) }),
  refsFor: (target_type: 'project' | 'document', target_id: number) =>
    request<{ cards: Card[] }>(`${BASE}/refs`, { params: { target_type, target_id } }),
  link: (id: number, related_card_id: number) =>
    request<{ message: string }>(`${BASE}/cards/${id}/links`, { method: 'POST', body: JSON.stringify({ related_card_id }) }),
  unlink: (id: number, otherId: number) =>
    request<{ message: string }>(`${BASE}/cards/${id}/links/${otherId}`, { method: 'DELETE' }),
};

export const inboxApi = {
  list: (params?: { status?: InboxStatus | 'all'; page?: number; per_page?: number }) =>
    request<{ items: InboxItem[]; pagination: Pagination }>(`${BASE}/inbox`, { params }),
  create: (data: { kind?: string; title?: string; body?: string; url?: string; file_id?: number; tag_ids?: number[] }) =>
    request<{ item: InboxItem }>(`${BASE}/inbox`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<InboxItem> & { tag_ids?: number[] }) =>
    request<{ item: InboxItem }>(`${BASE}/inbox/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request<{ message: string }>(`${BASE}/inbox/${id}`, { method: 'DELETE' }),
  toCard: (id: number, data: { kind?: CardKind; title?: string; body?: string; source_note?: string }) =>
    request<{ card: Card; item: InboxItem }>(`${BASE}/inbox/${id}/to-card`, { method: 'POST', body: JSON.stringify(data) }),
  toProject: (id: number, project_id: number) =>
    request<{ source: Source; item: InboxItem }>(`${BASE}/inbox/${id}/to-project`, { method: 'POST', body: JSON.stringify({ project_id }) }),
  newProject: (id: number, data: { title?: string; thesis?: string }) =>
    request<{ project: Project; item: InboxItem }>(`${BASE}/inbox/${id}/new-project`, { method: 'POST', body: JSON.stringify(data) }),
  archive: (id: number) => request<{ item: InboxItem }>(`${BASE}/inbox/${id}/archive`, { method: 'POST' }),
  restore: (id: number) => request<{ item: InboxItem }>(`${BASE}/inbox/${id}/restore`, { method: 'POST' }),
};

export const tagApi = {
  list: (params?: { search?: string; with_counts?: 1 }) => request<{ tags: StudioTag[] }>(`${BASE}/tags`, { params }),
  create: (name: string) => request<{ tag: StudioTag }>(`${BASE}/tags`, { method: 'POST', body: JSON.stringify({ name }) }),
  rename: (id: number, name: string) =>
    request<{ tag: StudioTag }>(`${BASE}/tags/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  delete: (id: number) => request<{ message: string }>(`${BASE}/tags/${id}`, { method: 'DELETE' }),
  merge: (source_ids: number[], target_id: number) =>
    request<{ tag: StudioTag; moved: number }>(`${BASE}/tags/merge`, { method: 'POST', body: JSON.stringify({ source_ids, target_id }) }),
  items: (id: number) =>
    request<{ tag: StudioTag; projects: Project[]; documents: Document[]; cards: Card[]; inbox_items: InboxItem[] }>(`${BASE}/tags/${id}/items`),
  assign: (target_type: TagTargetType, target_id: number, data: { tag_ids?: number[]; names?: string[] }) =>
    request<{ tags: StudioTag[] }>(`${BASE}/tags/assign`, { method: 'PUT', body: JSON.stringify({ target_type, target_id, ...data }) }),
};

export const publishingApi = {
  list: (params?: { platform?: string; stage?: string; project_id?: number; from?: string; to?: string; page?: number; per_page?: number }) =>
    request<{ items: Document[]; pagination: Pagination }>(`${BASE}/publishing`, { params }),
};

export const searchApi = {
  search: (q: string, types?: string[], limit = 8) =>
    request<SearchResults>(`${BASE}/search`, { params: { q, types: types?.join(','), limit } }),
};

export const studioApi = {
  today: todayApi, projects: projectApi, documents: documentApi, cards: cardApi,
  inbox: inboxApi, tags: tagApi, publishing: publishingApi, search: searchApi,
};
