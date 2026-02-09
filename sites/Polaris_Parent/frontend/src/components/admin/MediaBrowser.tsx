'use client';

import { useState, useEffect } from 'react';
import { mediaApi } from '@/lib/api/media';
import type { MediaItem, MediaFolder } from '@/lib/api/strapi';
import { getThumbnailUrl } from '@/lib/api/imageUtils';
import Button from '@/components/ui/Button';
import { getImageUrl } from '@/lib/utils';
import { useDebounce } from '@/hooks';

interface MediaBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (media: MediaItem) => void;
  multiple?: boolean;
}

export default function MediaBrowser({ isOpen, onClose, onSelect, multiple = false }: MediaBrowserProps) {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<MediaItem[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, currentFolder, currentPage, debouncedSearchQuery]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [mediaResponse, foldersResponse] = await Promise.all([
        mediaApi.getMediaList({
          page: currentPage,
          per_page: 24,
          folder_id: currentFolder !== null ? currentFolder : undefined,
          search: debouncedSearchQuery || undefined,
        }),
        mediaApi.getFolders({ all: true }),
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

  const handleItemClick = (item: MediaItem) => {
    if (multiple) {
      const isSelected = selectedItems.some((selected) => selected.id === item.id);
      if (isSelected) {
        setSelectedItems(selectedItems.filter((selected) => selected.id !== item.id));
      } else {
        setSelectedItems([...selectedItems, item]);
      }
    } else {
      onSelect(item);
      onClose();
    }
  };

  const handleSelectMultiple = () => {
    if (selectedItems.length > 0) {
      selectedItems.forEach((item) => onSelect(item));
      onClose();
    }
  };

  const resetState = () => {
    setCurrentFolder(null);
    setSearchQuery('');
    setSelectedItems([]);
    setCurrentPage(1);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl h-5/6 flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">選擇媒體</h2>
            <p className="text-sm text-gray-500 mt-1">
              當前位置：{getCurrentFolderPath()}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 border-b">
          <div className="flex items-center gap-2 mb-4">
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

          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="搜尋媒體文件..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {multiple && selectedItems.length > 0 && (
              <Button onClick={handleSelectMultiple}>
                選擇 {selectedItems.length} 個項目
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {getCurrentFolderSubfolders().length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">資料夾</h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                {getCurrentFolderSubfolders().map((folder) => (
                  <div
                    key={folder.id}
                    className="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setCurrentFolder(folder.id)}
                  >
                    <svg className="w-10 h-10 text-blue-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2v0" />
                    </svg>
                    <span className="text-xs font-medium text-center truncate w-full">
                      {folder.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
                  <div className="w-10 h-10 flex-shrink-0 bg-gray-200 rounded animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4" />
                    <div className="h-2.5 bg-gray-200 rounded animate-pulse w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : mediaItems.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
                {mediaItems.map((item) => {
                  const isSelected = multiple && selectedItems.some((selected) => selected.id === item.id);
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${
                        isSelected ? 'bg-blue-50 ring-1 ring-blue-300' : ''
                      }`}
                      onClick={() => handleItemClick(item)}
                    >
                      {multiple && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 flex-shrink-0 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      <div className="w-10 h-10 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                        <img
                          src={getImageUrl(getThumbnailUrl(item))}
                          alt={item.alt_text || item.original_filename}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/placeholder.svg';
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate" title={item.original_filename}>
                          {item.original_filename}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(item.file_size)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

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
              <p className="text-gray-500">
                {searchQuery ? `沒有找到包含 "${searchQuery}" 的媒體文件` : '此資料夾中沒有媒體文件'}
              </p>
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              取消
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
