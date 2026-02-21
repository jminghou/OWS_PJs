'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import { mediaApi, tagApi as mediaTagApi } from '@/lib/api/media';
import type { MediaItem, MediaFolder, MediaTag } from '@/lib/api/strapi';
import { getImageUrl } from '@/lib/utils';
import { formatFileSize, buildFolderTree, flattenFolderTree } from './utils';

// =============================================================================
// Edit Modal Component
// =============================================================================

export interface EditModalProps {
  file: MediaItem | null;
  folders: MediaFolder[];
  tags: MediaTag[];
  onClose: () => void;
  onSave: (id: number, data: { alt_text?: string; caption?: string; folder_id?: number | null; tag_ids?: number[] }) => Promise<void>;
  onTagCreated: () => void;
}

type ActiveTab = 'basic' | 'metadata' | 'code';

export function EditModal({ file, folders, tags, onClose, onSave, onTagCreated }: EditModalProps) {
  const [altText, setAltText] = useState('');
  const [caption, setCaption] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('basic');

  const [metaChartId, setMetaChartId] = useState('');
  const [metaLocation, setMetaLocation] = useState('');
  const [metaRating, setMetaRating] = useState<number | null>(null);
  const [metaStatus, setMetaStatus] = useState('draft');
  const [metaSource, setMetaSource] = useState('');
  const [metaLicense, setMetaLicense] = useState('');
  const [metaNotes, setMetaNotes] = useState('');

  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [creatingTag, setCreatingTag] = useState(false);
  const TAG_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4'];

  useEffect(() => {
    if (file) {
      setAltText(file.alt_text || '');
      setCaption(file.caption || '');
      setSelectedFolderId(file.folder_id ?? null);
      setSelectedTagIds(file.tags?.map((t) => t.id) || []);
      setShowNewTag(false);
      setNewTagName('');
      setActiveTab('basic');
      const m = file.metadata;
      setMetaChartId(m?.chart_id || '');
      setMetaLocation(m?.location || '');
      setMetaRating(m?.rating ?? null);
      setMetaStatus(m?.status || 'draft');
      setMetaSource(m?.source || '');
      setMetaLicense(m?.license || '');
      setMetaNotes(m?.notes || '');
    }
  }, [file]);

  if (!file) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(file.id, {
        alt_text: altText,
        caption,
        folder_id: selectedFolderId,
        tag_ids: selectedTagIds,
      });
      await mediaApi.updateMetadata(file.id, {
        chart_id: metaChartId || undefined,
        location: metaLocation || undefined,
        rating: metaRating ?? undefined,
        status: metaStatus,
        source: metaSource || undefined,
        license: metaLicense || undefined,
        notes: metaNotes || undefined,
      });
      onClose();
    } catch (error) {
      alert(`儲存失敗: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setCreatingTag(true);
    try {
      const created = await mediaTagApi.create({ name: newTagName.trim(), color: newTagColor });
      setSelectedTagIds((prev) => [...prev, created.id]);
      setNewTagName('');
      setShowNewTag(false);
      onTagCreated();
    } catch (error) {
      alert(`建立標籤失敗: ${(error as Error).message}`);
    } finally {
      setCreatingTag(false);
    }
  };

  const previewUrl = getImageUrl(file.formats?.large?.url || file.file_path);

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: 'basic', label: '基本資訊' },
    { key: 'metadata', label: 'Metadata' },
    { key: 'code', label: '引用代碼' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">媒體詳情</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body: two-column layout */}
        <div className="flex flex-1 min-h-0">

          {/* LEFT PANEL: preview + file info */}
          <div className="w-72 flex-shrink-0 flex flex-col bg-gray-50 border-r p-5 gap-4 overflow-y-auto">

            {/* Image preview */}
            <div className="flex items-center justify-center bg-white rounded-lg border border-gray-200 overflow-hidden min-h-40">
              <img
                src={previewUrl}
                alt={file.alt_text || file.original_filename}
                className="max-w-full max-h-[40vh] object-contain"
              />
            </div>

            {/* File info */}
            <div className="space-y-2">
              <div>
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">檔案名稱</div>
                <div className="text-sm text-gray-800 break-all">{file.original_filename}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">大小</div>
                  <div className="text-sm text-gray-800">{formatFileSize(file.file_size)}</div>
                </div>
                {file.width && file.height && (
                  <div>
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">尺寸</div>
                    <div className="text-sm text-gray-800">{file.width} × {file.height}</div>
                  </div>
                )}
              </div>
              {file.mime_type && (
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">類型</div>
                  <div className="text-sm text-gray-800">{file.mime_type}</div>
                </div>
              )}
            </div>

            {/* Size variants */}
            {file.formats && Object.keys(file.formats).length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">尺寸變體</div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">原始</span>
                    <span className="text-gray-800 font-mono text-xs">
                      {file.width && file.height ? `${file.width}×${file.height}` : '—'}
                    </span>
                  </div>
                  {(['large', 'medium', 'small', 'thumbnail'] as const).map((size) => {
                    const fmt = file.formats?.[size];
                    if (!fmt) return null;
                    const labels: Record<string, string> = { large: 'Large', medium: 'Medium', small: 'Small', thumbnail: 'Thumb' };
                    return (
                      <div key={size} className="flex justify-between text-sm">
                        <span className="text-gray-500">{labels[size]}</span>
                        <span className="text-gray-800 font-mono text-xs">{fmt.width}×{fmt.height}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANEL: tabs + form */}
          <div className="flex-1 flex flex-col min-w-0">

            {/* Tab bar */}
            <div className="flex border-b flex-shrink-0 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6">

              {/* Tab 1: 基本資訊 */}
              {activeTab === 'basic' && (
                <div className="space-y-5">

                  {/* 資料夾 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">資料夾</label>
                    <select
                      value={selectedFolderId ?? ''}
                      onChange={(e) => setSelectedFolderId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="">未分類（根目錄）</option>
                      {flattenFolderTree(buildFolderTree(folders)).map(({ folder: f, depth: d }) => (
                        <option key={f.id} value={f.id}>
                          {d > 0 ? '\u00A0\u00A0'.repeat(d) + '└ ' : ''}{f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 標籤 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">標籤</label>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                            selectedTagIds.includes(tag.id)
                              ? 'text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                          style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                        >
                          {tag.name}
                        </button>
                      ))}
                      {!showNewTag && (
                        <button
                          type="button"
                          onClick={() => setShowNewTag(true)}
                          className="px-3 py-1.5 rounded-full text-sm border-2 border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
                        >
                          + 新增標籤
                        </button>
                      )}
                    </div>
                    {showNewTag && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            placeholder="標籤名稱..."
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            autoFocus
                          />
                          <button
                            onClick={handleCreateTag}
                            disabled={creatingTag || !newTagName.trim()}
                            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                          >
                            {creatingTag ? '...' : '建立'}
                          </button>
                          <button
                            onClick={() => { setShowNewTag(false); setNewTagName(''); }}
                            className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                          >
                            取消
                          </button>
                        </div>
                        <div className="flex gap-1.5 items-center">
                          <span className="text-xs text-gray-500 mr-1">顏色:</span>
                          {TAG_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setNewTagColor(color)}
                              className={`w-5 h-5 rounded-full transition-transform ${newTagColor === color ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 替代文字 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">替代文字 (Alt Text)</label>
                    <input
                      type="text"
                      value={altText}
                      onChange={(e) => setAltText(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="描述圖片內容..."
                    />
                  </div>

                  {/* 說明文字 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">說明文字 (Caption)</label>
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="圖片說明..."
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Metadata */}
              {activeTab === 'metadata' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">命盤ID</label>
                      <input type="text" value={metaChartId} onChange={(e) => setMetaChartId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="紫微命盤 ID..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">地點</label>
                      <input type="text" value={metaLocation} onChange={(e) => setMetaLocation(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="拍攝/相關地點..." />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">評級</label>
                    <div className="flex gap-1 items-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} type="button" onClick={() => setMetaRating(metaRating === star ? null : star)} className="p-0.5">
                          <svg className={`w-7 h-7 ${(metaRating ?? 0) >= star ? 'text-yellow-400' : 'text-gray-300'} transition-colors`} fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        </button>
                      ))}
                      {metaRating && <span className="ml-2 text-sm text-gray-500">{metaRating} 星</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">狀態</label>
                      <select value={metaStatus} onChange={(e) => setMetaStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="draft">草稿</option>
                        <option value="published">已發布</option>
                        <option value="archived">已封存</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">來源</label>
                      <input type="text" value={metaSource} onChange={(e) => setMetaSource(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="攝影師/網站..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">授權</label>
                      <input type="text" value={metaLicense} onChange={(e) => setMetaLicense(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="授權類型..." />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">備註</label>
                    <textarea value={metaNotes} onChange={(e) => setMetaNotes(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="內部備註..." />
                  </div>
                </div>
              )}

              {/* Tab 3: 引用代碼 */}
              {activeTab === 'code' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">圖片路徑</label>
                    <div className="relative">
                      <input type="text" value={file.file_path} readOnly className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono" />
                      <button onClick={() => navigator.clipboard.writeText(file.file_path)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 transition-colors" title="複製">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">HTML</label>
                    <div className="relative">
                      <textarea value={`<img src="${file.file_path}" alt="${altText || file.original_filename}" />`} readOnly rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-xs font-mono resize-none" />
                      <button onClick={() => navigator.clipboard.writeText(`<img src="${file.file_path}" alt="${altText || file.original_filename}" />`)} className="absolute right-2 top-2 p-1 text-gray-400 hover:text-gray-700 transition-colors" title="複製">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Markdown</label>
                    <div className="relative">
                      <textarea value={`![${altText || file.original_filename}](${file.file_path})`} readOnly rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-xs font-mono resize-none" />
                      <button onClick={() => navigator.clipboard.writeText(`![${altText || file.original_filename}](${file.file_path})`)} className="absolute right-2 top-2 p-1 text-gray-400 hover:text-gray-700 transition-colors" title="複製">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50 flex-shrink-0 rounded-b-xl">
          <Button variant="outline" onClick={onClose}>關閉</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '儲存中...' : '儲存變更'}</Button>
        </div>

      </div>
    </div>
  );
}
