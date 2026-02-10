'use client';

import { useState } from 'react';
import type { MediaFolder } from '@/lib/api/strapi';
import { buildFolderTree } from './utils';
import { FolderTreeItem } from './FolderTreeItem';

// =============================================================================
// Left Sidebar Component
// =============================================================================

export interface FolderSidebarProps {
  folders: MediaFolder[];
  selectedFolderId: number | null;
  onSelectFolder: (folderId: number | null) => void;
  onAddMedia: () => void;
  onAddFolder: () => void;
  onRenameFolder: (folder: MediaFolder) => void;
  onMoveFolder: (folder: MediaFolder) => void;
  onDeleteFolder: (folder: MediaFolder) => void;
}

export function FolderSidebar({
  folders,
  selectedFolderId,
  onSelectFolder,
  onAddMedia,
  onAddFolder,
  onRenameFolder,
  onMoveFolder,
  onDeleteFolder,
}: FolderSidebarProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const folderTree = buildFolderTree(folders);

  const handleToggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="w-56 flex-shrink-0 flex flex-col h-full">
      <div className="p-6 pb-2">
        {/* 媒體庫標題 */}
        <h1 className="text-xl font-bold text-gray-900 mb-6">媒體庫</h1>

        {/* Add New 區塊 */}
        <div className="mb-4 flex flex-col gap-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Add New</p>
          <button
            onClick={onAddMedia}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 transition-colors py-1"
          >
            <span className="text-lg leading-none">+</span> Media
          </button>
          <button
            onClick={onAddFolder}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 transition-colors py-1"
          >
            <span className="text-lg leading-none">+</span> Folder
          </button>
        </div>
      </div>

      {/* 導覽列表 */}
      <nav className="flex-1 overflow-y-auto">
        {/* 全部檔案 */}
        <button
          onClick={() => onSelectFolder(null)}
          className={`w-full flex items-center gap-3 px-6 py-2.5 text-left transition-colors ${
            selectedFolderId === null
              ? 'border-l-2 border-blue-500 bg-blue-50 text-blue-700'
              : 'border-l-2 border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm">全部檔案</span>
        </button>

        {/* 未分類 */}
        <button
          onClick={() => onSelectFolder(0)}
          className={`w-full flex items-center gap-3 px-6 py-2.5 text-left transition-colors ${
            selectedFolderId === 0
              ? 'border-l-2 border-blue-500 bg-blue-50 text-blue-700'
              : 'border-l-2 border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm">未分類</span>
        </button>

        {/* 資料夾列表 */}
        {folderTree.length > 0 && (
          <div className="mt-2">
            {folderTree.map((folder) => (
              <FolderTreeItem
                key={folder.id}
                folder={folder}
                selectedFolderId={selectedFolderId}
                expandedIds={expandedIds}
                onSelect={onSelectFolder}
                onToggleExpand={handleToggleExpand}
                onRename={onRenameFolder}
                onMove={onMoveFolder}
                onDelete={onDeleteFolder}
                depth={0}
              />
            ))}
          </div>
        )}
      </nav>
    </div>
  );
}
