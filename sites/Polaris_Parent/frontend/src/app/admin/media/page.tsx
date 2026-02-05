'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { getImageUrl } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface StrapiFile {
  id: number;
  documentId: string;
  name: string;
  alternativeText: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  formats: {
    thumbnail?: { url: string; width: number; height: number; size: number };
    small?: { url: string; width: number; height: number; size: number };
    medium?: { url: string; width: number; height: number; size: number };
    large?: { url: string; width: number; height: number; size: number };
  } | null;
  hash: string;
  ext: string;
  mime: string;
  size: number;
  url: string;
  createdAt: string;
  updatedAt: string;
}

interface Category {
  id: number;
  documentId: string;
  name: string;
  description?: string;
}

interface MediaMeta {
  id: number;
  documentId: string;
  file?: { id: number } | number;
  category?: Category[];
  chartid?: string;
  place?: string;
  copyright?: string;
  isPublic?: boolean;
}

// 擴展 StrapiFile 以包含 MediaMeta 資訊
interface StrapiFileWithMeta extends StrapiFile {
  mediaMeta?: MediaMeta | null;
}

// =============================================================================
// API Functions
// =============================================================================

const api = {
  // 取得檔案列表
  getFiles: async (params?: { page?: number; pageSize?: number; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString());
    if (params?.search) searchParams.set('filters[name][$containsi]', params.search);

    const response = await fetch(`/api/strapi-files?${searchParams.toString()}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to fetch files');
    }
    return response.json() as Promise<StrapiFile[]>;
  },

  // 上傳檔案
  uploadFiles: async (
    files: File[],
    onProgress?: (filename: string, progress: number) => void
  ): Promise<StrapiFile[]> => {
    const results: StrapiFile[] = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('files', file);

      const uploadedFiles = await new Promise<StrapiFile[]>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(file.name, percent);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error('Invalid response'));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.error || 'Upload failed'));
            } catch {
              reject(new Error('Upload failed'));
            }
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.open('POST', '/api/strapi-upload');
        xhr.send(formData);
      });

      results.push(...uploadedFiles);
    }

    return results;
  },

  // 更新檔案資訊
  updateFile: async (id: number, data: { alternativeText?: string; caption?: string }) => {
    const response = await fetch(`/api/strapi-upload?fileId=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Update failed');
    }
    return response.json();
  },

  // 刪除檔案
  deleteFile: async (id: number) => {
    const response = await fetch(`/api/strapi-upload?fileId=${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Delete failed');
    }
  },

  // 批量刪除
  deleteFiles: async (ids: number[]) => {
    await Promise.all(ids.map((id) => api.deleteFile(id)));
  },

  // 取得分類列表
  getCategories: async (): Promise<Category[]> => {
    const response = await fetch('/api/strapi-categories');
    if (!response.ok) return [];
    const data = await response.json();
    return data.data || [];
  },

  // 建立分類
  createCategory: async (name: string, description?: string): Promise<Category | null> => {
    const response = await fetch('/api/strapi-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.data;
  },

  // 取得所有 MediaMeta（用於建立 file-category 對應）
  getAllMediaMetas: async (): Promise<MediaMeta[]> => {
    const response = await fetch('/api/strapi-media-meta/all');
    if (!response.ok) return [];
    const data = await response.json();
    return data.data || [];
  },

  // 取得單一檔案的 MediaMeta
  getMediaMeta: async (fileId: number): Promise<MediaMeta | null> => {
    const response = await fetch(`/api/strapi-media-meta?fileId=${fileId}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.data;
  },

  // 更新 MediaMeta（包含分類）
  updateMediaMeta: async (
    fileId: number,
    documentId: string | undefined,
    data: { category?: number[] }
  ): Promise<MediaMeta | null> => {
    const response = await fetch('/api/strapi-media-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId,
        documentId,
        ...data,
      }),
    });
    if (!response.ok) return null;
    const result = await response.json();
    return result.data;
  },
};

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

const getThumbnailUrl = (file: StrapiFile): string => {
  if (file.formats?.thumbnail?.url) return file.formats.thumbnail.url;
  if (file.formats?.small?.url) return file.formats.small.url;
  return file.url;
};

const getFullUrl = (url: string): string => {
  if (url.startsWith('http')) return url;
  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
  return `${strapiUrl}${url}`;
};

// =============================================================================
// Category Sidebar Component
// =============================================================================

interface CategorySidebarProps {
  categories: Category[];
  selectedCategoryId: number | null;
  onSelectCategory: (categoryId: number | null) => void;
  onCreateCategory: (name: string) => Promise<void>;
  fileCounts: Record<number, number>;
  totalFileCount: number;
}

function CategorySidebar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onCreateCategory,
  fileCounts,
  totalFileCount,
}: CategorySidebarProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newCategoryName.trim()) return;
    setCreating(true);
    try {
      await onCreateCategory(newCategoryName.trim());
      setNewCategoryName('');
      setShowCreateForm(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="w-64 flex-shrink-0 border-r bg-gray-50">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">分類資料夾</h3>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
            title="新增分類"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* 新增分類表單 */}
        {showCreateForm && (
          <div className="mb-4 p-3 bg-white rounded-lg border">
            <input
              type="text"
              placeholder="分類名稱..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded mb-2"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating || !newCategoryName.trim()}
                className="flex-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {creating ? '建立中...' : '建立'}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewCategoryName('');
                }}
                className="flex-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 分類列表 */}
        <nav className="space-y-1">
          {/* 全部檔案 */}
          <button
            onClick={() => onSelectCategory(null)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
              selectedCategoryId === null
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

          {/* 未分類 */}
          <button
            onClick={() => onSelectCategory(0)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
              selectedCategoryId === 0
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
            <span className="flex-1 truncate">未分類</span>
            <span className="text-xs text-gray-500">{fileCounts[0] || 0}</span>
          </button>

          {/* 分類資料夾 */}
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => onSelectCategory(category.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                selectedCategoryId === category.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
              </svg>
              <span className="flex-1 truncate">{category.name}</span>
              <span className="text-xs text-gray-500">{fileCounts[category.id] || 0}</span>
            </button>
          ))}

          {categories.length === 0 && (
            <p className="px-3 py-4 text-sm text-gray-500 text-center">
              尚未建立任何分類
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
  selectedCategoryId: number | null;
}

function UploadModal({ isOpen, onClose, onUploadComplete, selectedCategoryId }: UploadModalProps) {
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
    if (files.length > 0) {
      await handleUpload(files);
    }
  }, [selectedCategoryId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await handleUpload(files);
    }
  };

  const handleUpload = async (files: File[]) => {
    setIsUploading(true);
    const initialProgress: Record<string, number> = {};
    files.forEach((f) => (initialProgress[f.name] = 0));
    setUploadProgress(initialProgress);

    try {
      const uploadedFiles = await api.uploadFiles(files, (filename, progress) => {
        setUploadProgress((prev) => ({ ...prev, [filename]: progress }));
      });

      // 如果有選擇分類，自動將上傳的檔案加入該分類
      if (selectedCategoryId && selectedCategoryId > 0) {
        for (const file of uploadedFiles) {
          await api.updateMediaMeta(file.id, undefined, {
            category: [selectedCategoryId],
          });
        }
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
          {/* 拖放區域 */}
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

          {/* 上傳進度 */}
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
  file: StrapiFileWithMeta | null;
  categories: Category[];
  onClose: () => void;
  onSave: (id: number, data: { alternativeText?: string; caption?: string }, categoryIds?: number[]) => Promise<void>;
}

function EditModal({ file, categories, onClose, onSave }: EditModalProps) {
  const [altText, setAltText] = useState('');
  const [caption, setCaption] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSizes, setShowSizes] = useState(false);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (file) {
      setAltText(file.alternativeText || '');
      setCaption(file.caption || '');
      // 從 MediaMeta 取得已選擇的分類
      const categoryIds = file.mediaMeta?.category?.map((c) => c.id) || [];
      setSelectedCategoryIds(categoryIds);
    }
  }, [file]);

  if (!file) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(file.id, { alternativeText: altText, caption }, selectedCategoryIds);
      onClose();
    } catch (error) {
      alert(`儲存失敗: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (categoryId: number) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const fullUrl = getFullUrl(file.url);

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
              src={getImageUrl(getFullUrl(file.formats?.large?.url || file.url))}
              alt={file.alternativeText || file.name}
              className="max-w-full max-h-48 rounded-lg shadow-sm"
            />
          </div>

          {/* 基本資訊 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">檔案名稱</label>
              <input type="text" value={file.name} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">檔案大小</label>
              <input type="text" value={formatFileSize(file.size * 1024)} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50" />
            </div>
          </div>

          {/* 分類選擇 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">分類資料夾</label>
            <div className="flex flex-wrap gap-2">
              {categories.length > 0 ? (
                categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      selectedCategoryIds.includes(category.id)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category.name}
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-500">尚未建立任何分類</p>
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
                  <div className="text-xs text-gray-500">{file.width && file.height ? `${file.width} × ${file.height} px` : '未知'}</div>
                  <div className="text-xs text-gray-400 mt-1">{formatFileSize(file.size * 1024)}</div>
                </div>
                {file.formats?.large && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-700">Large</div>
                    <div className="text-xs text-gray-500">{file.formats.large.width} × {file.formats.large.height} px</div>
                    <div className="text-xs text-gray-400 mt-1">{formatFileSize(file.formats.large.size * 1024)}</div>
                  </div>
                )}
                {file.formats?.medium && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-700">Medium</div>
                    <div className="text-xs text-gray-500">{file.formats.medium.width} × {file.formats.medium.height} px</div>
                    <div className="text-xs text-gray-400 mt-1">{formatFileSize(file.formats.medium.size * 1024)}</div>
                  </div>
                )}
                {file.formats?.small && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-700">Small</div>
                    <div className="text-xs text-gray-500">{file.formats.small.width} × {file.formats.small.height} px</div>
                    <div className="text-xs text-gray-400 mt-1">{formatFileSize(file.formats.small.size * 1024)}</div>
                  </div>
                )}
                {file.formats?.thumbnail && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-700">Thumbnail</div>
                    <div className="text-xs text-gray-500">{file.formats.thumbnail.width} × {file.formats.thumbnail.height} px</div>
                    <div className="text-xs text-gray-400 mt-1">{formatFileSize(file.formats.thumbnail.size * 1024)}</div>
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
                    <input type="text" value={fullUrl} readOnly className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg bg-gray-50 text-sm" />
                    <button
                      onClick={() => { navigator.clipboard.writeText(fullUrl); alert('已複製'); }}
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
                        value={`<img src="${fullUrl}" alt="${altText || file.name}" />`}
                        readOnly
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-xs font-mono"
                      />
                      <button
                        onClick={() => { navigator.clipboard.writeText(`<img src="${fullUrl}" alt="${altText || file.name}" />`); alert('已複製'); }}
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
                        value={`![${altText || file.name}](${fullUrl})`}
                        readOnly
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-xs font-mono"
                      />
                      <button
                        onClick={() => { navigator.clipboard.writeText(`![${altText || file.name}](${fullUrl})`); alert('已複製'); }}
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
  const [files, setFiles] = useState<StrapiFile[]>([]);
  const [filesWithMeta, setFilesWithMeta] = useState<StrapiFileWithMeta[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mediaMetas, setMediaMetas] = useState<MediaMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingFile, setEditingFile] = useState<StrapiFileWithMeta | null>(null);

  // 搜尋防抖
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 載入分類
  const fetchCategories = useCallback(async () => {
    const result = await api.getCategories();
    setCategories(result);
  }, []);

  // 載入所有 MediaMeta
  const fetchMediaMetas = useCallback(async () => {
    const result = await api.getAllMediaMetas();
    setMediaMetas(result);
  }, []);

  // 載入檔案
  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getFiles({
        search: debouncedSearch || undefined,
      });
      setFiles(result);
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  // 合併 files 和 mediaMetas
  useEffect(() => {
    const merged = files.map((file) => {
      const meta = mediaMetas.find((m) => {
        const fileRef = m.file;
        if (typeof fileRef === 'number') return fileRef === file.id;
        return fileRef?.id === file.id;
      });
      return { ...file, mediaMeta: meta || null };
    });
    setFilesWithMeta(merged);
  }, [files, mediaMetas]);

  // 初始載入
  useEffect(() => {
    fetchCategories();
    fetchMediaMetas();
  }, [fetchCategories, fetchMediaMetas]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // 計算各分類的檔案數量
  const fileCounts = useCallback(() => {
    const counts: Record<number, number> = { 0: 0 };

    filesWithMeta.forEach((file) => {
      const categoryIds = file.mediaMeta?.category?.map((c) => c.id) || [];
      if (categoryIds.length === 0) {
        counts[0] = (counts[0] || 0) + 1;
      } else {
        categoryIds.forEach((id) => {
          counts[id] = (counts[id] || 0) + 1;
        });
      }
    });

    return counts;
  }, [filesWithMeta]);

  // 根據選擇的分類過濾檔案
  const filteredFiles = useCallback(() => {
    if (selectedCategoryId === null) {
      // 全部檔案
      return filesWithMeta;
    }
    if (selectedCategoryId === 0) {
      // 未分類
      return filesWithMeta.filter((file) => {
        const categoryIds = file.mediaMeta?.category?.map((c) => c.id) || [];
        return categoryIds.length === 0;
      });
    }
    // 特定分類
    return filesWithMeta.filter((file) => {
      const categoryIds = file.mediaMeta?.category?.map((c) => c.id) || [];
      return categoryIds.includes(selectedCategoryId);
    });
  }, [filesWithMeta, selectedCategoryId]);

  // 建立分類
  const handleCreateCategory = async (name: string) => {
    await api.createCategory(name);
    await fetchCategories();
  };

  // 批量刪除
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`確定要刪除選中的 ${selectedIds.length} 個項目嗎？`)) return;

    try {
      await api.deleteFiles(selectedIds);
      setSelectedIds([]);
      await fetchFiles();
      await fetchMediaMetas();
    } catch (error) {
      alert(`刪除失敗: ${(error as Error).message}`);
    }
  };

  // 更新檔案
  const handleUpdateFile = async (
    id: number,
    data: { alternativeText?: string; caption?: string },
    categoryIds?: number[]
  ) => {
    await api.updateFile(id, data);

    // 更新 MediaMeta 分類
    if (categoryIds !== undefined) {
      const file = filesWithMeta.find((f) => f.id === id);
      await api.updateMediaMeta(id, file?.mediaMeta?.documentId, {
        category: categoryIds,
      });
    }

    await fetchFiles();
    await fetchMediaMetas();
  };

  // 選擇項目
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // 全選
  const displayedFiles = filteredFiles();
  const toggleSelectAll = () => {
    if (selectedIds.length === displayedFiles.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayedFiles.map((f) => f.id));
    }
  };

  return (
    <AdminLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* 分類側邊欄 */}
        <CategorySidebar
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          onCreateCategory={handleCreateCategory}
          fileCounts={fileCounts()}
          totalFileCount={files.length}
        />

        {/* 主內容區 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">媒體庫</h1>
                <p className="text-gray-600">
                  {selectedCategoryId === null
                    ? '全部媒體文件'
                    : selectedCategoryId === 0
                    ? '未分類的媒體文件'
                    : `${categories.find((c) => c.id === selectedCategoryId)?.name || ''} 分類中的媒體文件`}
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

            {/* 批量操作 */}
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
              {/* 全選 checkbox */}
              {displayedFiles.length > 0 && (
                <div className="mb-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === displayedFiles.length && displayedFiles.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">全選</span>
                  <span className="text-sm text-gray-400">({displayedFiles.length} 個檔案)</span>
                </div>
              )}

              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : displayedFiles.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {displayedFiles.map((file) => (
                    <div
                      key={file.id}
                      className={`relative group border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer ${
                        selectedIds.includes(file.id) ? 'ring-2 ring-blue-500' : ''
                      }`}
                    >
                      <div className="aspect-square relative bg-gray-100">
                        <img
                          src={getImageUrl(getFullUrl(getThumbnailUrl(file)))}
                          alt={file.alternativeText || file.name}
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
                              setEditingFile(file);
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
                            checked={selectedIds.includes(file.id)}
                            onChange={() => toggleSelect(file.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                          />
                        </div>
                        {/* 分類標籤 */}
                        {file.mediaMeta?.category && file.mediaMeta.category.length > 0 && (
                          <div className="absolute bottom-2 right-2 flex gap-1">
                            {file.mediaMeta.category.slice(0, 2).map((cat) => (
                              <span
                                key={cat.id}
                                className="px-1.5 py-0.5 text-[10px] bg-blue-500 text-white rounded"
                                title={cat.name}
                              >
                                {cat.name.slice(0, 4)}
                              </span>
                            ))}
                            {file.mediaMeta.category.length > 2 && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-gray-500 text-white rounded">
                                +{file.mediaMeta.category.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium truncate" title={file.name}>{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size * 1024)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">沒有媒體文件</h3>
                  <p className="text-gray-500 mb-4">
                    {debouncedSearch
                      ? `沒有找到包含 "${debouncedSearch}" 的媒體文件`
                      : selectedCategoryId !== null
                      ? '此分類中沒有媒體文件'
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
          fetchMediaMetas();
        }}
        selectedCategoryId={selectedCategoryId}
      />

      <EditModal
        file={editingFile}
        categories={categories}
        onClose={() => setEditingFile(null)}
        onSave={handleUpdateFile}
      />
    </AdminLayout>
  );
}
