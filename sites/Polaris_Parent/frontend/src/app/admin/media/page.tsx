'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { mediaApi, tagApi as mediaTagApi } from '@/lib/api/media';
import type { MediaItem, MediaFolder, MediaTag } from '@/lib/api/strapi';
import { getImageUrl } from '@/lib/utils';

// =============================================================================
// Helper Functions
// =============================================================================

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getThumbnailUrl = (item: MediaItem): string => {
  if (item.formats?.thumbnail?.url) return item.formats.thumbnail.url;
  if (item.formats?.small?.url) return item.formats.small.url;
  return item.file_path;
};

// =============================================================================
// Folder Sidebar Component
// =============================================================================

interface FolderSidebarProps {
  folders: MediaFolder[];
  selectedFolderId: number | null;
  onSelectFolder: (folderId: number | null) => void;
  onCreateFolder: (name: string) => Promise<void>;
  totalFileCount: number;
}

function FolderSidebar({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  totalFileCount,
}: FolderSidebarProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newFolderName.trim()) return;
    setCreating(true);
    try {
      await onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setShowCreateForm(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="w-64 flex-shrink-0 border-r bg-gray-50">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">資料夾</h3>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
            title="新增資料夾"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* 新增資料夾表單 */}
        {showCreateForm && (
          <div className="mb-4 p-3 bg-white rounded-lg border">
            <input
              type="text"
              placeholder="資料夾名稱..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded mb-2"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating || !newFolderName.trim()}
                className="flex-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {creating ? '建立中...' : '建立'}
              </button>
              <button
                onClick={() => { setShowCreateForm(false); setNewFolderName(''); }}
                className="flex-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 資料夾列表 */}
        <nav className="space-y-1">
          {/* 全部檔案 */}
          <button
            onClick={() => onSelectFolder(null)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
              selectedFolderId === null
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="flex-1 truncate">全部檔案</span>
            <span className="text-xs text-gray-500">{totalFileCount}</span>
          </button>

          {/* 未分類（folder_id = 0 代表 root） */}
          <button
            onClick={() => onSelectFolder(0)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
              selectedFolderId === 0
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
            <span className="flex-1 truncate">未分類</span>
          </button>

          {/* 資料夾 */}
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => onSelectFolder(folder.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                selectedFolderId === folder.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
              </svg>
              <span className="flex-1 truncate">{folder.name}</span>
              <span className="text-xs text-gray-500">{folder.file_count || 0}</span>
            </button>
          ))}

          {folders.length === 0 && (
            <p className="px-3 py-4 text-sm text-gray-500 text-center">
              尚未建立任何資料夾
            </p>
          )}
        </nav>
      </div>
    </div>
  );
}

// =============================================================================
// Upload Modal Component
// =============================================================================

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
  currentFolderId: number | null;
}

function UploadModal({ isOpen, onClose, onUploadComplete, currentFolderId }: UploadModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) await handleUpload(files);
  }, [currentFolderId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) await handleUpload(files);
  };

  const handleUpload = async (files: File[]) => {
    setIsUploading(true);
    const initialProgress: Record<string, number> = {};
    files.forEach((f) => (initialProgress[f.name] = 0));
    setUploadProgress(initialProgress);

    try {
      // 使用有效的 folder_id（null 和 0 都不傳）
      const folderId = currentFolderId && currentFolderId > 0 ? currentFolderId : undefined;

      for (const file of files) {
        await mediaApi.uploadMedia(file, folderId, (percent) => {
          setUploadProgress((prev) => ({ ...prev, [file.name]: percent }));
        });
      }

      onUploadComplete();
      onClose();
    } catch (error) {
      alert(`上傳失敗: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-medium">上傳媒體檔案</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" disabled={isUploading}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-600 mb-2">拖放檔案到此處</p>
            <p className="text-gray-400 text-sm mb-4">或</p>
            <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
              選擇檔案
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {Object.keys(uploadProgress).length > 0 && (
            <div className="mt-4 space-y-2">
              {Object.entries(uploadProgress).map(([filename, progress]) => (
                <div key={filename} className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="truncate">{filename}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Edit Modal Component
// =============================================================================

interface EditModalProps {
  file: MediaItem | null;
  tags: MediaTag[];
  onClose: () => void;
  onSave: (id: number, data: { alt_text?: string; caption?: string; tag_ids?: number[] }) => Promise<void>;
}

function EditModal({ file, tags, onClose, onSave }: EditModalProps) {
  const [altText, setAltText] = useState('');
  const [caption, setCaption] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSizes, setShowSizes] = useState(false);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (file) {
      setAltText(file.alt_text || '');
      setCaption(file.caption || '');
      setSelectedTagIds(file.tags?.map((t) => t.id) || []);
    }
  }, [file]);

  if (!file) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(file.id, { alt_text: altText, caption, tag_ids: selectedTagIds });
      onClose();
    } catch (error) {
      alert(`儲存失敗: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const previewUrl = getImageUrl(
    file.formats?.large?.url || file.file_path
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-medium">媒體詳情</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 預覽 */}
          <div className="flex justify-center">
            <img
              src={previewUrl}
              alt={file.alt_text || file.original_filename}
              className="max-w-full max-h-48 rounded-lg shadow-sm"
            />
          </div>

          {/* 基本資訊 */}
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

          {/* 標籤選擇 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">標籤</label>
            <div className="flex flex-wrap gap-2">
              {tags.length > 0 ? (
                tags.map((tag) => (
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
                ))
              ) : (
                <p className="text-sm text-gray-500">尚未建立任何標籤</p>
              )}
            </div>
          </div>

          {/* 編輯資訊 */}
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

          {/* 圖片尺寸 - 可收合 */}
          <div className="border-t pt-4">
            <button
              type="button"
              onClick={() => setShowSizes(!showSizes)}
              className="w-full flex items-center justify-between text-left"
            >
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

          {/* 引用代碼 - 可收合 */}
          <div className="border-t pt-4">
            <button
              type="button"
              onClick={() => setShowCode(!showCode)}
              className="w-full flex items-center justify-between text-left"
            >
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
                    <button
                      onClick={() => { navigator.clipboard.writeText(file.file_path); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">HTML</label>
                    <div className="relative">
                      <textarea
                        value={`<img src="${file.file_path}" alt="${altText || file.original_filename}" />`}
                        readOnly
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-xs font-mono"
                      />
                      <button
                        onClick={() => { navigator.clipboard.writeText(`<img src="${file.file_path}" alt="${altText || file.original_filename}" />`); }}
                        className="absolute right-2 top-2 p-1 text-gray-500 hover:text-gray-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Markdown</label>
                    <div className="relative">
                      <textarea
                        value={`![${altText || file.original_filename}](${file.file_path})`}
                        readOnly
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-xs font-mono"
                      />
                      <button
                        onClick={() => { navigator.clipboard.writeText(`![${altText || file.original_filename}](${file.file_path})`); }}
                        className="absolute right-2 top-2 p-1 text-gray-500 hover:text-gray-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <Button variant="outline" onClick={onClose}>關閉</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '儲存中...' : '儲存變更'}</Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Media Page Component
// =============================================================================

export default function MediaPage() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [tags, setTags] = useState<MediaTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingFile, setEditingFile] = useState<MediaItem | null>(null);
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // 搜尋防抖
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 載入資料夾
  const fetchFolders = useCallback(async () => {
    const result = await mediaApi.getFolders();
    setFolders(result);
  }, []);

  // 載入標籤
  const fetchTags = useCallback(async () => {
    const result = await mediaTagApi.getAll();
    setTags(result);
  }, []);

  // 載入檔案
  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        page: currentPage,
        per_page: 20,
      };

      // 資料夾篩選
      if (selectedFolderId !== null) {
        params.folder_id = selectedFolderId; // 0 = 根目錄（未分類）
      }

      if (debouncedSearch) {
        params.search = debouncedSearch;
      }

      const result = await mediaApi.getMediaList(params);
      setMediaItems(result.media);
      setPagination(result.pagination);
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedFolderId, currentPage]);

  // 初始載入
  useEffect(() => {
    fetchFolders();
    fetchTags();
  }, [fetchFolders, fetchTags]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // 切換資料夾時重置頁碼
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFolderId, debouncedSearch]);

  // 建立資料夾
  const handleCreateFolder = async (name: string) => {
    await mediaApi.createFolder({ name });
    await fetchFolders();
  };

  // 批量刪除
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`確定要刪除選中的 ${selectedIds.length} 個項目嗎？`)) return;

    try {
      await Promise.all(selectedIds.map((id) => mediaApi.deleteMedia(id)));
      setSelectedIds([]);
      await fetchFiles();
      await fetchFolders();
    } catch (error) {
      alert(`刪除失敗: ${(error as Error).message}`);
    }
  };

  // 更新檔案
  const handleUpdateFile = async (
    id: number,
    data: { alt_text?: string; caption?: string; tag_ids?: number[] }
  ) => {
    await mediaApi.updateMedia(id, data);
    await fetchFiles();
  };

  // 選擇項目
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === mediaItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(mediaItems.map((f) => f.id));
    }
  };

  return (
    <AdminLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* 資料夾側邊欄 */}
        <FolderSidebar
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          onCreateFolder={handleCreateFolder}
          totalFileCount={pagination?.total || 0}
        />

        {/* 主內容區 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">媒體庫</h1>
                <p className="text-gray-600">
                  {selectedFolderId === null
                    ? '全部媒體文件'
                    : selectedFolderId === 0
                    ? '未分類的媒體文件'
                    : `${folders.find((f) => f.id === selectedFolderId)?.name || ''} 中的媒體文件`}
                </p>
              </div>
              <Button onClick={() => setShowUploadModal(true)}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                上傳媒體
              </Button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="搜尋媒體文件..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {selectedIds.length > 0 && (
              <div className="flex gap-2 items-center">
                <span className="px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg">
                  已選擇 {selectedIds.length} 個項目
                </span>
                <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                  刪除選中
                </Button>
              </div>
            )}
          </div>

          {/* Media Grid */}
          <Card>
            <CardContent className="p-6">
              {mediaItems.length > 0 && (
                <div className="mb-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === mediaItems.length && mediaItems.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">全選</span>
                  <span className="text-sm text-gray-400">({mediaItems.length} 個檔案)</span>
                </div>
              )}

              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : mediaItems.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {mediaItems.map((item) => (
                      <div
                        key={item.id}
                        className={`relative group border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer ${
                          selectedIds.includes(item.id) ? 'ring-2 ring-blue-500' : ''
                        }`}
                      >
                        <div className="aspect-square relative bg-gray-100">
                          <img
                            src={getImageUrl(getThumbnailUrl(item))}
                            alt={item.alt_text || item.original_filename}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/images/placeholder.svg';
                            }}
                          />
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                            <button
                              className="opacity-0 group-hover:opacity-100 p-2 bg-white rounded-full hover:bg-gray-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingFile(item);
                              }}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                          {/* Checkbox */}
                          <div className="absolute top-2 left-2">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(item.id)}
                              onChange={() => toggleSelect(item.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                            />
                          </div>
                          {/* 標籤 */}
                          {item.tags && item.tags.length > 0 && (
                            <div className="absolute bottom-2 right-2 flex gap-1">
                              {item.tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag.id}
                                  className="px-1.5 py-0.5 text-[10px] text-white rounded"
                                  style={{ backgroundColor: tag.color }}
                                  title={tag.name}
                                >
                                  {tag.name.slice(0, 4)}
                                </span>
                              ))}
                              {item.tags.length > 2 && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-gray-500 text-white rounded">
                                  +{item.tags.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-medium truncate" title={item.original_filename}>{item.original_filename}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(item.file_size)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 分頁 */}
                  {pagination && pagination.pages > 1 && (
                    <div className="mt-6 flex justify-center items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={!pagination.has_prev}
                      >
                        上一頁
                      </Button>
                      <span className="text-sm text-gray-600">
                        第 {pagination.page} 頁，共 {pagination.pages} 頁
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={!pagination.has_next}
                      >
                        下一頁
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">沒有媒體文件</h3>
                  <p className="text-gray-500 mb-4">
                    {debouncedSearch
                      ? `沒有找到包含 "${debouncedSearch}" 的媒體文件`
                      : selectedFolderId !== null
                      ? '此資料夾中沒有媒體文件'
                      : '開始上傳您的第一個媒體文件'}
                  </p>
                  <Button onClick={() => setShowUploadModal(true)}>上傳文件</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={() => {
          fetchFiles();
          fetchFolders();
        }}
        currentFolderId={selectedFolderId}
      />

      <EditModal
        file={editingFile}
        tags={tags}
        onClose={() => setEditingFile(null)}
        onSave={handleUpdateFile}
      />
    </AdminLayout>
  );
}
