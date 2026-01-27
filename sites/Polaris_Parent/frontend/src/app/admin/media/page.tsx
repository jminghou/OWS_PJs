'use client';

import { useState, useEffect, useRef } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import Button from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { mediaApi } from '@/lib/api';

interface MediaItem {
  id: number;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  alt_text?: string;
  caption?: string;
  folder_id?: number;
  created_at: string;
}

interface MediaFolder {
  id: number;
  name: string;
  parent_id?: number;
  path: string;
  created_at: string;
}

export default function MediaPage() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showEditFolderModal, setShowEditFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<MediaFolder | null>(null);
  const [editFolderName, setEditFolderName] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, [currentFolder, currentPage, searchQuery]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [mediaResponse, foldersResponse] = await Promise.all([
        mediaApi.getMediaList({
          page: currentPage,
          per_page: 20,
          folder_id: currentFolder || undefined,
          search: searchQuery || undefined,
        }),
        mediaApi.getFolders(),
      ]);

      setMediaItems(mediaResponse.media);
      setPagination(mediaResponse.pagination);
      setFolders(foldersResponse);
    } catch (error) {
      console.error('Error fetching media:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map((file) =>
        mediaApi.uploadMedia(file, currentFolder || undefined)
      );

      await Promise.all(uploadPromises);
      await fetchData();
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('上傳失敗，請稍後再試');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await mediaApi.createFolder({
        name: newFolderName,
        parent_id: currentFolder || undefined,
      });
      setNewFolderName('');
      setShowNewFolderModal(false);
      await fetchData();
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('創建資料夾失敗');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedItems.length === 0) return;
    if (!confirm(`確定要刪除選中的 ${selectedItems.length} 個項目嗎？`)) return;

    try {
      await Promise.all(selectedItems.map((id) => mediaApi.deleteMedia(id)));
      setSelectedItems([]);
      await fetchData();
    } catch (error) {
      console.error('Error deleting items:', error);
      alert('刪除失敗');
    }
  };

  const handleEditItem = async () => {
    if (!editingItem) return;

    try {
      await mediaApi.updateMedia(editingItem.id, {
        alt_text: editingItem.alt_text,
        caption: editingItem.caption,
      });
      setShowEditModal(false);
      setEditingItem(null);
      await fetchData();
    } catch (error) {
      console.error('Error updating item:', error);
      alert('更新失敗');
    }
  };

  const handleMoveToFolder = async (targetFolderId?: number) => {
    if (selectedItems.length === 0) return;

    try {
      const response = await mediaApi.moveMedia(selectedItems, targetFolderId);
      alert(response.message);
      setSelectedItems([]);
      setShowMoveModal(false);
      await fetchData();
    } catch (error) {
      console.error('Error moving items:', error);
      alert('移動失敗');
    }
  };

  const handleEditFolder = (folder: MediaFolder) => {
    setEditingFolder(folder);
    setEditFolderName(folder.name);
    setShowEditFolderModal(true);
  };

  const handleUpdateFolder = async () => {
    if (!editingFolder || !editFolderName.trim()) return;

    try {
      const response = await mediaApi.updateFolder(editingFolder.id, {
        name: editFolderName.trim()
      });
      alert(response.message);
      setShowEditFolderModal(false);
      setEditingFolder(null);
      setEditFolderName('');
      await fetchData();
    } catch (error) {
      console.error('Error updating folder:', error);
      alert('更新資料夾失敗');
    }
  };

  const handleDeleteFolder = async (folder: MediaFolder) => {
    if (!confirm(`確定要刪除資料夾 "${folder.name}" 嗎？`)) return;

    try {
      const response = await mediaApi.deleteFolder(folder.id);
      alert(response.message);
      await fetchData();
    } catch (error) {
      console.error('Error deleting folder:', error);
      alert('刪除資料夾失敗');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getCurrentFolderPath = () => {
    if (!currentFolder) return '根目錄';
    const folder = folders.find((f) => f.id === currentFolder);
    return folder ? folder.path : '根目錄';
  };

  const getCurrentFolderSubfolders = () => {
    return folders.filter((folder) => folder.parent_id === currentFolder);
  };

  const getParentFolder = () => {
    if (!currentFolder) return null;
    const folder = folders.find((f) => f.id === currentFolder);
    return folder?.parent_id || null;
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">媒體庫</h1>
              <p className="text-gray-600">管理您的圖片和媒體文件</p>
              <div className="mt-2 text-sm text-gray-500">
                當前位置：{getCurrentFolderPath()}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowNewFolderModal(true)}
                variant="outline"
                size="sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                新增資料夾
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                size="sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {uploading ? '上傳中...' : '上傳文件'}
              </Button>
            </div>
          </div>

          {/* Navigation Bar */}
          <div className="mt-4 flex items-center gap-2">
            {currentFolder && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentFolder(getParentFolder())}
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                返回上級
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentFolder(null)}
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2v0" />
              </svg>
              根目錄
            </Button>
          </div>

          {/* Search and Actions */}
          <div className="mt-4 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="搜尋媒體文件..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {selectedItems.length > 0 && (
              <div className="flex gap-2">
                <span className="px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg">
                  已選擇 {selectedItems.length} 個項目
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMoveModal(true)}
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8" />
                  </svg>
                  移動到
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelected}
                >
                  刪除選中
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Folders */}
        {getCurrentFolderSubfolders().length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">資料夾</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                {getCurrentFolderSubfolders().map((folder) => (
                  <div
                    key={folder.id}
                    className="relative group flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setCurrentFolder(folder.id)}
                  >
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex gap-2">
                        <button
                          className="p-2 bg-white rounded-full shadow-md hover:bg-blue-50 hover:shadow-lg transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditFolder(folder);
                          }}
                          title="編輯資料夾"
                        >
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          className="p-2 bg-white rounded-full shadow-md hover:bg-red-50 hover:shadow-lg transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(folder);
                          }}
                          title="刪除資料夾"
                        >
                          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <svg className="w-12 h-12 text-blue-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2v0" />
                    </svg>
                    <span className="text-sm font-medium text-center truncate w-full">
                      {folder.name}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Media Grid */}
        <Card>
          <CardContent className="p-6">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse"></div>
                ))}
              </div>
            ) : mediaItems.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {mediaItems.map((item) => (
                    <div
                      key={item.id}
                      className={`relative group border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer ${
                        selectedItems.includes(item.id) ? 'ring-2 ring-blue-500' : ''
                      }`}
                    >
                      <div className="aspect-square relative">
                        <img
                          src={`${process.env.NEXT_PUBLIC_BACKEND_URL}${item.file_path}`}
                          alt={item.alt_text || item.original_filename}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/placeholder.svg';
                          }}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 flex gap-2 transition-opacity">
                            <button
                              className="p-2 bg-white rounded-full hover:bg-gray-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingItem(item);
                                setShowEditModal(true);
                              }}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="absolute top-2 left-2">
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(item.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItems([...selectedItems, item.id]);
                              } else {
                                setSelectedItems(selectedItems.filter((id) => id !== item.id));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium truncate" title={item.original_filename}>
                          {item.original_filename}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(item.file_size)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
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
                  {searchQuery ? `沒有找到包含 "${searchQuery}" 的媒體文件` : '開始上傳您的第一個媒體文件'}
                </p>
                <Button onClick={() => fileInputRef.current?.click()}>
                  上傳文件
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
          className="hidden"
        />

        {/* New Folder Modal */}
        {showNewFolderModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-medium mb-4">新增資料夾</h3>
              <input
                type="text"
                placeholder="資料夾名稱"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNewFolderModal(false);
                    setNewFolderName('');
                  }}
                >
                  取消
                </Button>
                <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                  創建
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && editingItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
              <h3 className="text-lg font-medium mb-4">媒體詳情</h3>

              {/* 圖片預覽 */}
              <div className="mb-6">
                <img
                  src={`${process.env.NEXT_PUBLIC_BACKEND_URL}${editingItem.file_path}`}
                  alt={editingItem.alt_text || editingItem.original_filename}
                  className="max-w-full max-h-64 mx-auto rounded-lg shadow-sm"
                />
              </div>

              <div className="space-y-4">
                {/* 基本資訊 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      檔案名稱
                    </label>
                    <input
                      type="text"
                      value={editingItem.original_filename}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      檔案大小
                    </label>
                    <input
                      type="text"
                      value={formatFileSize(editingItem.file_size)}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                    />
                  </div>
                </div>

                {/* 圖片路徑 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    圖片路徑
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={`${process.env.NEXT_PUBLIC_BACKEND_URL}${editingItem.file_path}`}
                      readOnly
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 text-sm"
                    />
                    <button
                      onClick={() => {
                        const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}${editingItem.file_path}`;
                        navigator.clipboard.writeText(url);
                        alert('圖片路徑已複製到剪貼板');
                      }}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                      title="複製路徑"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* HTML 代碼 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    HTML 引用代碼
                  </label>
                  <div className="relative">
                    <textarea
                      value={`<img src="${process.env.NEXT_PUBLIC_BACKEND_URL}${editingItem.file_path}" alt="${editingItem.alt_text || editingItem.original_filename}" className="w-full h-auto rounded-lg" />`}
                      readOnly
                      rows={3}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 text-sm font-mono"
                    />
                    <button
                      onClick={() => {
                        const htmlCode = `<img src="${process.env.NEXT_PUBLIC_BACKEND_URL}${editingItem.file_path}" alt="${editingItem.alt_text || editingItem.original_filename}" className="w-full h-auto rounded-lg" />`;
                        navigator.clipboard.writeText(htmlCode);
                        alert('HTML 代碼已複製到剪貼板');
                      }}
                      className="absolute right-2 top-2 p-1 text-gray-500 hover:text-gray-700"
                      title="複製 HTML 代碼"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Markdown 代碼 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Markdown 引用代碼
                  </label>
                  <div className="relative">
                    <textarea
                      value={`![${editingItem.alt_text || editingItem.original_filename}](${process.env.NEXT_PUBLIC_BACKEND_URL}${editingItem.file_path})`}
                      readOnly
                      rows={2}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 text-sm font-mono"
                    />
                    <button
                      onClick={() => {
                        const markdownCode = `![${editingItem.alt_text || editingItem.original_filename}](${process.env.NEXT_PUBLIC_BACKEND_URL}${editingItem.file_path})`;
                        navigator.clipboard.writeText(markdownCode);
                        alert('Markdown 代碼已複製到剪貼板');
                      }}
                      className="absolute right-2 top-2 p-1 text-gray-500 hover:text-gray-700"
                      title="複製 Markdown 代碼"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* 可編輯欄位 */}
                <div className="border-t pt-4">
                  <h4 className="text-md font-medium text-gray-900 mb-3">編輯資訊</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        替代文字 (Alt Text)
                      </label>
                      <input
                        type="text"
                        value={editingItem.alt_text || ''}
                        onChange={(e) =>
                          setEditingItem({ ...editingItem, alt_text: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        說明文字
                      </label>
                      <textarea
                        value={editingItem.caption || ''}
                        onChange={(e) =>
                          setEditingItem({ ...editingItem, caption: e.target.value })
                        }
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingItem(null);
                  }}
                >
                  關閉
                </Button>
                <Button onClick={handleEditItem}>
                  保存變更
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Folder Modal */}
        {showEditFolderModal && editingFolder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-medium mb-4">編輯資料夾</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    資料夾名稱
                  </label>
                  <input
                    type="text"
                    value={editFolderName}
                    onChange={(e) => setEditFolderName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateFolder()}
                    autoFocus
                  />
                </div>
                <div className="text-sm text-gray-500">
                  當前路徑：{editingFolder.path}
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditFolderModal(false);
                    setEditingFolder(null);
                    setEditFolderName('');
                  }}
                >
                  取消
                </Button>
                <Button
                  onClick={handleUpdateFolder}
                  disabled={!editFolderName.trim() || editFolderName.trim() === editingFolder.name}
                >
                  保存
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Move Modal */}
        {showMoveModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-lg">
              <h3 className="text-lg font-medium mb-4">
                移動 {selectedItems.length} 個項目到
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {/* 根目錄選項 */}
                <div
                  className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                    currentFolder === null ? 'bg-blue-50 border-blue-300' : 'border-gray-200'
                  }`}
                  onClick={() => handleMoveToFolder(undefined)}
                >
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-blue-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2v0" />
                    </svg>
                    <span className="font-medium">根目錄</span>
                    {currentFolder === null && (
                      <span className="ml-2 text-xs text-blue-600">(當前位置)</span>
                    )}
                  </div>
                </div>

                {/* 所有資料夾選項 */}
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                      currentFolder === folder.id ? 'bg-blue-50 border-blue-300' : 'border-gray-200'
                    }`}
                    onClick={() => handleMoveToFolder(folder.id)}
                  >
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-blue-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2v0" />
                      </svg>
                      <div>
                        <div className="font-medium">{folder.name}</div>
                        <div className="text-xs text-gray-500">{folder.path}</div>
                      </div>
                      {currentFolder === folder.id && (
                        <span className="ml-auto text-xs text-blue-600">(當前位置)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowMoveModal(false)}
                >
                  取消
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}