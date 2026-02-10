'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import Button from '@/components/ui/Button';
import { mediaApi } from '@/lib/api/media';
import { tagApi as mediaTagApi } from '@/lib/api/media';
import type { MediaItem, MediaFolder, MediaTag } from '@/lib/api/strapi';
import { getImageUrl } from '@/lib/utils';
import MediaBrowser from '@/components/admin/MediaBrowser';
import {
  AdminPagination,
  AdminEmptyState,
  AdminLoadingSkeleton,
  AdminSearchToolbar,
  AdminBatchActions,
  AdminListLayout,
  AdminContentGrid,
} from '@/components/admin/shared';

import {
  getSmallUrl,
  buildFolderTree,
  flattenFolderTree,
  EditableDescription,
  FolderSidebar,
  RenameFolderModal,
  MoveFolderModal,
  CreateFolderModal,
  UploadModal,
  EditModal,
  ImportModal,
  SubFolderSection,
  InlineUploadZone,
} from './_components';

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
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [editingFile, setEditingFile] = useState<MediaItem | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFoldersDropdown, setShowFoldersDropdown] = useState(false);
  const [showThumbnailBrowser, setShowThumbnailBrowser] = useState(false);
  const [thumbnailTargetFolderId, setThumbnailTargetFolderId] = useState<number | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<MediaFolder | null>(null);
  const [movingFolder, setMovingFolder] = useState<MediaFolder | null>(null);

  // 搜尋防抖
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 載入所有資料夾
  const fetchFolders = useCallback(async () => {
    const result = await mediaApi.getFolders({ all: true });
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
      const params: any = { page: currentPage, per_page: 20 };
      if (selectedFolderId !== null) {
        params.folder_id = selectedFolderId;
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

  useEffect(() => { fetchFolders(); fetchTags(); }, [fetchFolders, fetchTags]);
  useEffect(() => { fetchFiles(); }, [fetchFiles]);
  useEffect(() => { setCurrentPage(1); }, [selectedFolderId, debouncedSearch]);

  // 建立資料夾
  const handleCreateFolder = async (name: string, parentId?: number) => {
    await mediaApi.createFolder({ name, parent_id: parentId });
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

  // 批量移動
  const handleMoveSelected = async (targetFolderId: number | null) => {
    if (selectedIds.length === 0) return;
    try {
      await mediaApi.moveMedia(selectedIds, targetFolderId);
      setSelectedIds([]);
      setShowMoveDropdown(false);
      await fetchFiles();
      await fetchFolders();
    } catch (error) {
      alert(`移動失敗: ${(error as Error).message}`);
    }
  };

  // 更新檔案
  const handleUpdateFile = async (
    id: number,
    data: { alt_text?: string; caption?: string; folder_id?: number | null; tag_ids?: number[] }
  ) => {
    await mediaApi.updateMedia(id, data);
    await fetchFiles();
    await fetchFolders();
  };

  // 選擇項目
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  // 設定資料夾縮圖
  const handleSetFolderThumbnail = async (media: MediaItem) => {
    if (!thumbnailTargetFolderId) return;
    try {
      await mediaApi.updateFolder(thumbnailTargetFolderId, { thumbnail_id: media.id });
      await fetchFolders();
      setShowThumbnailBrowser(false);
      setThumbnailTargetFolderId(null);
    } catch (error) {
      alert(`設定縮圖失敗: ${(error as Error).message}`);
    }
  };

  // 重新命名資料夾
  const handleRenameFolder = async (id: number, name: string) => {
    await mediaApi.updateFolder(id, { name });
    await fetchFolders();
  };

  // 移動資料夾
  const handleMoveFolder = async (folderId: number, newParentId: number | null) => {
    await mediaApi.updateFolder(folderId, { parent_id: newParentId });
    await fetchFolders();
  };

  // 刪除資料夾
  const handleDeleteFolder = async (folder: MediaFolder) => {
    if (!confirm(`確定要刪除資料夾「${folder.name}」嗎？（資料夾必須為空）`)) return;
    try {
      await mediaApi.deleteFolder(folder.id);
      if (selectedFolderId === folder.id) setSelectedFolderId(null);
      await fetchFolders();
      await fetchFiles();
    } catch (error) {
      alert(`刪除失敗: ${(error as Error).message}`);
    }
  };

  // 取得當前選中的資料夾物件
  const selectedFolder = selectedFolderId !== null && selectedFolderId > 0
    ? folders.find((f) => f.id === selectedFolderId)
    : null;

  // 取得當前資料夾的子資料夾
  const folderTree = buildFolderTree(folders);
  const getChildFolders = (parentId: number): MediaFolder[] => {
    const findInTree = (nodes: MediaFolder[]): MediaFolder[] => {
      for (const node of nodes) {
        if (node.id === parentId) return node.children || [];
        if (node.children) {
          const found = findInTree(node.children);
          if (found.length > 0) return found;
        }
      }
      return [];
    };
    return findInTree(folderTree);
  };

  const childFolders = selectedFolder ? getChildFolders(selectedFolder.id) : [];

  // 取得第一層資料夾（供 Folders 下拉選單用）
  const topLevelFolders = folders.filter((f) => !f.parent_id);

  // 取得資料夾的縮圖 URL
  const getFolderThumbnailUrl = (folder: MediaFolder): string | null => {
    if (folder.thumbnail) {
      if (folder.thumbnail.formats?.thumbnail?.url) return folder.thumbnail.formats.thumbnail.url;
      return folder.thumbnail.url;
    }
    return null;
  };

  // 媒體項目渲染函式（資料夾內檢視）
  const renderFolderMediaItem = (item: MediaItem) => (
    <div
      key={item.id}
      className="w-[180px] h-[180px] relative group rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => setEditingFile(item)}
    >
      <img
        src={getImageUrl(getSmallUrl(item))}
        alt={item.alt_text || item.original_filename}
        className="w-full h-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder.svg'; }}
      />
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity" />
      <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <input
          type="checkbox"
          checked={selectedIds.includes(item.id)}
          onChange={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
        />
      </div>
    </div>
  );

  // 媒體項目渲染函式（全部檔案檢視）
  const renderAllFilesMediaItem = (item: MediaItem) => (
    <div
      key={item.id}
      className={`w-[180px] h-[180px] relative group rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${
        selectedIds.includes(item.id) ? 'ring-2 ring-blue-500' : ''
      }`}
      onClick={() => setEditingFile(item)}
    >
      <img
        src={getImageUrl(getSmallUrl(item))}
        alt={item.alt_text || item.original_filename}
        className="w-full h-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder.svg'; }}
      />
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity" />
      <div className="absolute top-1.5 left-1.5">
        <input
          type="checkbox"
          checked={selectedIds.includes(item.id)}
          onChange={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
        />
      </div>
      {item.tags && item.tags.length > 0 && (
        <div className="absolute bottom-1.5 right-1.5 flex gap-1">
          {item.tags.slice(0, 2).map((tag) => (
            <span key={tag.id} className="px-1.5 py-0.5 text-[10px] text-white rounded" style={{ backgroundColor: tag.color }} title={tag.name}>
              {tag.name.slice(0, 4)}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <AdminLayout>
      <AdminListLayout
        sidebar={
          <FolderSidebar
            folders={folders}
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
            onAddMedia={() => setShowUploadModal(true)}
            onAddFolder={() => setShowCreateFolderModal(true)}
            onRenameFolder={(f) => setRenamingFolder(f)}
            onMoveFolder={(f) => setMovingFolder(f)}
            onDeleteFolder={handleDeleteFolder}
          />
        }
      >
        {/* 頂部工具列：搜尋 + 全選 + 批次操作 */}
        <AdminSearchToolbar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search"
          variant="underline"
          className="px-8 pt-6"
          actions={
            <AdminBatchActions
              totalCount={mediaItems.length}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              allIds={mediaItems.map((f) => f.id)}
            >
              <div className="relative">
                <Button variant="secondary" size="sm" onClick={() => setShowMoveDropdown(!showMoveDropdown)}>
                  移至
                </Button>
                {showMoveDropdown && (
                  <div className="absolute top-full right-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
                    <button onClick={() => handleMoveSelected(null)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 text-gray-700">
                      未分類（根目錄）
                    </button>
                    {flattenFolderTree(buildFolderTree(folders)).map(({ folder: f, depth: d }) => (
                      <button key={f.id} onClick={() => handleMoveSelected(f.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 text-gray-700">
                        {d > 0 ? '\u00A0\u00A0'.repeat(d) + '└ ' : ''}{f.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>刪除選中</Button>
            </AdminBatchActions>
          }
        />

        {/* Folders 下拉選單 */}
        <div className="px-8 pt-4 pb-2">
          <div className="relative inline-block">
            <button
              onClick={() => setShowFoldersDropdown(!showFoldersDropdown)}
              className="flex items-center gap-2 text-lg font-medium text-gray-900 hover:text-blue-600 transition-colors"
            >
              Folders
              <svg className={`w-4 h-4 transition-transform ${showFoldersDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showFoldersDropdown && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-40 py-1 max-h-64 overflow-y-auto">
                {topLevelFolders.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => { setSelectedFolderId(f.id); setShowFoldersDropdown(false); }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                      selectedFolderId === f.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
                {topLevelFolders.length === 0 && (
                  <p className="px-4 py-2 text-sm text-gray-400">尚無資料夾</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 內容區域 */}
        <div className="px-8 pb-8">
          {/* ===== 選中特定資料夾時的檢視 ===== */}
          {selectedFolder ? (
            <div>
              {/* 資料夾標頭 */}
              <div className="flex items-start gap-4 mb-6">
                {/* 縮圖 */}
                <div
                  className="w-[77px] h-[77px] flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center"
                  onClick={() => {
                    setThumbnailTargetFolderId(selectedFolder.id);
                    setShowThumbnailBrowser(true);
                  }}
                  title="點擊更換縮圖"
                >
                  {getFolderThumbnailUrl(selectedFolder) ? (
                    <img
                      src={getImageUrl(getFolderThumbnailUrl(selectedFolder)!)}
                      alt={selectedFolder.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900">{selectedFolder.name}</h2>
                  <EditableDescription
                    folderId={selectedFolder.id}
                    description={selectedFolder.description || ''}
                    placeholder={`點擊輸入 ${selectedFolder.name} 的描述`}
                    onSave={async (desc) => {
                      await mediaApi.updateFolder(selectedFolder.id, { description: desc });
                      fetchFolders();
                    }}
                  />
                </div>
              </div>

              {/* 上傳區 + 媒體網格 */}
              <div className="flex gap-4 mb-3">
                {/* 上傳拖曳區 */}
                <div className="w-[372px] flex-shrink-0">
                  <InlineUploadZone
                    folderId={selectedFolderId}
                    onUploadComplete={() => { fetchFiles(); fetchFolders(); }}
                  />
                </div>

                {/* 媒體網格 */}
                <div className="flex-1">
                  {loading ? (
                    <AdminLoadingSkeleton variant="grid" count={5} />
                  ) : (
                    <AdminContentGrid items={mediaItems} renderItem={renderFolderMediaItem} />
                  )}
                </div>
              </div>

              {/* 空狀態 */}
              {!loading && mediaItems.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <p>此資料夾中沒有媒體文件，拖曳檔案到上方區域開始上傳</p>
                </div>
              )}

              {/* 分頁 */}
              {pagination && (
                <AdminPagination
                  pagination={pagination}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  className="mt-4"
                />
              )}

              {/* 分隔線 */}
              {childFolders.length > 0 && <hr className="my-6 border-gray-200" />}

              {/* 次資料夾區塊 */}
              {childFolders.map((childFolder) => (
                <SubFolderSection
                  key={childFolder.id}
                  folder={childFolder}
                  onEditFile={setEditingFile}
                />
              ))}
            </div>
          ) : (
            /* ===== 全部檔案 / 未分類 檢視 ===== */
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedFolderId === null ? '全部媒體文件' : '未分類的媒體文件'}
                </h2>
              </div>

              {/* 媒體網格 */}
              {loading ? (
                <AdminLoadingSkeleton variant="grid" count={14} />
              ) : mediaItems.length > 0 ? (
                <>
                  <AdminContentGrid items={mediaItems} renderItem={renderAllFilesMediaItem} />

                  {/* 分頁 */}
                  {pagination && (
                    <AdminPagination
                      pagination={pagination}
                      currentPage={currentPage}
                      onPageChange={setCurrentPage}
                      className="mt-6"
                    />
                  )}
                </>
              ) : (
                <AdminEmptyState
                  title="沒有媒體文件"
                  description={
                    debouncedSearch
                      ? `沒有找到包含 "${debouncedSearch}" 的媒體文件`
                      : '開始上傳您的第一個媒體文件'
                  }
                  action={<Button onClick={() => setShowUploadModal(true)}>上傳文件</Button>}
                />
              )}
            </div>
          )}
        </div>
      </AdminListLayout>

      {/* ===================== Modals ===================== */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={() => { fetchFiles(); fetchFolders(); }}
        currentFolderId={selectedFolderId}
      />

      <CreateFolderModal
        isOpen={showCreateFolderModal}
        folders={folders}
        selectedFolderId={selectedFolderId}
        onClose={() => setShowCreateFolderModal(false)}
        onCreateFolder={handleCreateFolder}
      />

      <EditModal
        file={editingFile}
        folders={folders}
        tags={tags}
        onClose={() => setEditingFile(null)}
        onSave={handleUpdateFile}
        onTagCreated={fetchTags}
      />

      <ImportModal
        isOpen={showImportModal}
        folders={folders}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => { fetchFiles(); fetchFolders(); }}
      />

      {/* 縮圖選擇器 - 複用 MediaBrowser */}
      <MediaBrowser
        isOpen={showThumbnailBrowser}
        onClose={() => { setShowThumbnailBrowser(false); setThumbnailTargetFolderId(null); }}
        onSelect={handleSetFolderThumbnail}
      />

      {/* 重新命名資料夾 Modal */}
      <RenameFolderModal
        folder={renamingFolder}
        onClose={() => setRenamingFolder(null)}
        onRename={handleRenameFolder}
      />

      {/* 移動資料夾 Modal */}
      <MoveFolderModal
        folder={movingFolder}
        allFolders={folders}
        onClose={() => setMovingFolder(null)}
        onMove={handleMoveFolder}
      />
    </AdminLayout>
  );
}
