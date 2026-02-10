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

export function EditModal({ file, folders, tags, onClose, onSave, onTagCreated }: EditModalProps) {
  const [altText, setAltText] = useState('');
  const [caption, setCaption] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSizes, setShowSizes] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-medium">媒體詳情</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex justify-center">
            <img
              src={previewUrl}
              alt={file.alt_text || file.original_filename}
              className="max-w-full max-h-48 rounded-lg shadow-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">檔案名稱</label>
              <input type="text" value={file.original_filename} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">檔案大小</label>
              <input type="text" value={formatFileSize(file.file_size)} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">資料夾</label>
            <select
              value={selectedFolderId ?? ''}
              onChange={(e) => setSelectedFolderId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">未分類（根目錄）</option>
              {flattenFolderTree(buildFolderTree(folders)).map(({ folder: f, depth: d }) => (
                <option key={f.id} value={f.id}>
                  {d > 0 ? '\u00A0\u00A0'.repeat(d) + '└ ' : ''}{f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">標籤</label>
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

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">替代文字 (Alt Text)</label>
              <input
                type="text"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="描述圖片內容..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">說明文字 (Caption)</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="圖片說明..."
              />
            </div>
          </div>

          {/* 圖片尺寸 */}
          <div className="border-t pt-4">
            <button type="button" onClick={() => setShowSizes(!showSizes)} className="w-full flex items-center justify-between text-left">
              <h4 className="text-md font-medium text-gray-900">圖片尺寸</h4>
              <svg className={`w-5 h-5 text-gray-500 transition-transform ${showSizes ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showSizes && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-700">原始尺寸</div>
                  <div className="text-xs text-gray-500">{file.width && file.height ? `${file.width} x ${file.height} px` : '未知'}</div>
                  <div className="text-xs text-gray-400 mt-1">{formatFileSize(file.file_size)}</div>
                </div>
                {file.formats?.large && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-700">Large</div>
                    <div className="text-xs text-gray-500">{file.formats.large.width} x {file.formats.large.height} px</div>
                  </div>
                )}
                {file.formats?.medium && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-700">Medium</div>
                    <div className="text-xs text-gray-500">{file.formats.medium.width} x {file.formats.medium.height} px</div>
                  </div>
                )}
                {file.formats?.small && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-700">Small</div>
                    <div className="text-xs text-gray-500">{file.formats.small.width} x {file.formats.small.height} px</div>
                  </div>
                )}
                {file.formats?.thumbnail && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-700">Thumbnail</div>
                    <div className="text-xs text-gray-500">{file.formats.thumbnail.width} x {file.formats.thumbnail.height} px</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="border-t pt-4">
            <button type="button" onClick={() => setShowMetadata(!showMetadata)} className="w-full flex items-center justify-between text-left">
              <h4 className="text-md font-medium text-gray-900">Metadata</h4>
              <svg className={`w-5 h-5 text-gray-500 transition-transform ${showMetadata ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showMetadata && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">命盤ID</label>
                    <input type="text" value={metaChartId} onChange={(e) => setMetaChartId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="紫微命盤 ID..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">地點</label>
                    <input type="text" value={metaLocation} onChange={(e) => setMetaLocation(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="拍攝/相關地點..." />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">評級</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" onClick={() => setMetaRating(metaRating === star ? null : star)} className="p-0.5">
                        <svg className={`w-6 h-6 ${(metaRating ?? 0) >= star ? 'text-yellow-400' : 'text-gray-300'} transition-colors`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </button>
                    ))}
                    {metaRating && <span className="ml-2 text-sm text-gray-500 self-center">{metaRating} 星</span>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">狀態</label>
                    <select value={metaStatus} onChange={(e) => setMetaStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="draft">草稿</option>
                      <option value="published">已發布</option>
                      <option value="archived">已封存</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">來源</label>
                    <input type="text" value={metaSource} onChange={(e) => setMetaSource(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="攝影師/網站..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">授權</label>
                    <input type="text" value={metaLicense} onChange={(e) => setMetaLicense(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="授權類型..." />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
                  <textarea value={metaNotes} onChange={(e) => setMetaNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="內部備註..." />
                </div>
              </div>
            )}
          </div>

          {/* 引用代碼 */}
          <div className="border-t pt-4">
            <button type="button" onClick={() => setShowCode(!showCode)} className="w-full flex items-center justify-between text-left">
              <h4 className="text-md font-medium text-gray-900">引用代碼</h4>
              <svg className={`w-5 h-5 text-gray-500 transition-transform ${showCode ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showCode && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">圖片路徑</label>
                  <div className="relative">
                    <input type="text" value={file.file_path} readOnly className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg bg-gray-50 text-sm" />
                    <button onClick={() => navigator.clipboard.writeText(file.file_path)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">HTML</label>
                    <div className="relative">
                      <textarea value={`<img src="${file.file_path}" alt="${altText || file.original_filename}" />`} readOnly rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-xs font-mono" />
                      <button onClick={() => navigator.clipboard.writeText(`<img src="${file.file_path}" alt="${altText || file.original_filename}" />`)} className="absolute right-2 top-2 p-1 text-gray-500 hover:text-gray-700">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Markdown</label>
                    <div className="relative">
                      <textarea value={`![${altText || file.original_filename}](${file.file_path})`} readOnly rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-xs font-mono" />
                      <button onClick={() => navigator.clipboard.writeText(`![${altText || file.original_filename}](${file.file_path})`)} className="absolute right-2 top-2 p-1 text-gray-500 hover:text-gray-700">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <Button variant="outline" onClick={onClose}>關閉</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '儲存中...' : '儲存變更'}</Button>
        </div>
      </div>
    </div>
  );
}
