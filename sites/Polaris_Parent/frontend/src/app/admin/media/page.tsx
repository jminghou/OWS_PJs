'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import Button from '@/components/ui/Button';
import { mediaApi, tagApi as mediaTagApi, importApi } from '@/lib/api/media';
import type { GcsScanFile } from '@/lib/api/media';
import type { MediaItem, MediaFolder, MediaTag, FileMetadata } from '@/lib/api/strapi';
import { getImageUrl } from '@/lib/utils';
import MediaBrowser from '@/components/admin/MediaBrowser';

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

/** 取得 small 變體 URL（相片列表用） */
const getSmallUrl = (item: MediaItem): string => {
  if (item.formats?.small?.url) return item.formats.small.url;
  if (item.formats?.thumbnail?.url) return item.formats.thumbnail.url;
  return item.file_path;
};

// =============================================================================
// Folder Tree Helpers
// =============================================================================

function buildFolderTree(folders: MediaFolder[]): MediaFolder[] {
  const map = new Map<number, MediaFolder>();
  const roots: MediaFolder[] = [];
  for (const f of folders) {
    map.set(f.id, { ...f, children: [] });
  }
  for (const f of folders) {
    const node = map.get(f.id)!;
    if (f.parent_id && map.has(f.parent_id)) {
      map.get(f.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function flattenFolderTree(tree: MediaFolder[], depth = 0): { folder: MediaFolder; depth: number }[] {
  const result: { folder: MediaFolder; depth: number }[] = [];
  for (const node of tree) {
    result.push({ folder: node, depth });
    if (node.children && node.children.length > 0) {
      result.push(...flattenFolderTree(node.children, depth + 1));
    }
  }
  return result;
}

// =============================================================================
// EditableDescription (可編輯的資料夾描述)
// =============================================================================

function EditableDescription({
  folderId,
  description,
  placeholder,
  onSave,
}: {
  folderId: number;
  description: string;
  placeholder: string;
  onSave: (desc: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(description);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 當外部 description 變化時同步
  useEffect(() => {
    setValue(description);
  }, [description, folderId]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (trimmed === description) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch (e) {
      console.error('Failed to save description:', e);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="mt-1">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSave();
            }
            if (e.key === 'Escape') {
              setValue(description);
              setEditing(false);
            }
          }}
          disabled={saving}
          rows={2}
          className="w-full text-sm text-gray-700 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500 resize-none"
          placeholder={placeholder}
        />
        <p className="text-xs text-gray-400 mt-0.5">Enter 儲存，Esc 取消</p>
      </div>
    );
  }

  return (
    <p
      className="text-sm text-gray-500 mt-1 cursor-pointer hover:text-gray-700 group"
      onClick={() => setEditing(true)}
      title="點擊編輯描述"
    >
      {description || <span className="italic">{placeholder}</span>}
      <svg className="inline-block w-3.5 h-3.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </p>
  );
}

// =============================================================================
// Folder Tree Item (左欄遞迴子元件，含右鍵選單)
// =============================================================================

function FolderTreeItem({
  folder,
  selectedFolderId,
  expandedIds,
  onSelect,
  onToggleExpand,
  onRename,
  onMove,
  onDelete,
  depth,
}: {
  folder: MediaFolder;
  selectedFolderId: number | null;
  expandedIds: Set<number>;
  onSelect: (id: number) => void;
  onToggleExpand: (id: number) => void;
  onRename: (folder: MediaFolder) => void;
  onMove: (folder: MediaFolder) => void;
  onDelete: (folder: MediaFolder) => void;
  depth: number;
}) {
  const hasChildren = folder.children && folder.children.length > 0;
  const isExpanded = expandedIds.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  // 右鍵選單
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  // 點擊外部關閉選單
  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2 cursor-pointer transition-colors ${
          isSelected
            ? 'border-l-2 border-blue-500 bg-blue-50 text-blue-700'
            : 'border-l-2 border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`}
        style={{ paddingLeft: `${16 + depth * 20}px`, paddingRight: '12px' }}
        onClick={() => onSelect(folder.id)}
        onContextMenu={handleContextMenu}
      >
        {/* 展開/收合箭頭 */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(folder.id); }}
            className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="currentColor" viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* 文件圖示 */}
        <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <span className="flex-1 truncate text-sm">{folder.name}</span>
      </div>

      {/* 右鍵選單 */}
      {showMenu && (
        <div
          ref={menuRef}
          className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-[100] min-w-[140px]"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            onClick={() => { setShowMenu(false); onRename(folder); }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            重新命名
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            onClick={() => { setShowMenu(false); onMove(folder); }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            移動至...
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            onClick={() => { setShowMenu(false); onDelete(folder); }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            刪除
          </button>
        </div>
      )}

      {/* 子層遞迴渲染 */}
      {hasChildren && isExpanded && (
        <div>
          {folder.children!.map((child) => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              selectedFolderId={selectedFolderId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onRename={onRename}
              onMove={onMove}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Left Sidebar Component
// =============================================================================

interface FolderSidebarProps {
  folders: MediaFolder[];
  selectedFolderId: number | null;
  onSelectFolder: (folderId: number | null) => void;
  onAddMedia: () => void;
  onAddFolder: () => void;
  onRenameFolder: (folder: MediaFolder) => void;
  onMoveFolder: (folder: MediaFolder) => void;
  onDeleteFolder: (folder: MediaFolder) => void;
}

function FolderSidebar({
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
    <div className="w-56 flex-shrink-0 border-r bg-white flex flex-col">
      <div className="p-6 pb-2">
        {/* 媒體庫標題 */}
        <h1 className="text-xl font-bold text-gray-900 mb-6">媒體庫</h1>

        {/* Add New 區塊 */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Add New</p>
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

// =============================================================================
// Rename Folder Modal (重新命名資料夾)
// =============================================================================

function RenameFolderModal({
  folder,
  onClose,
  onRename,
}: {
  folder: MediaFolder | null;
  onClose: () => void;
  onRename: (id: number, name: string) => Promise<void>;
}) {
  const [name, setName] = useState(folder?.name || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (folder) setName(folder.name);
  }, [folder]);

  if (!folder) return null;

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === folder.name) { onClose(); return; }
    setSaving(true);
    try {
      await onRename(folder.id, trimmed);
      onClose();
    } catch (e: any) {
      alert(e.message || '重新命名失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-medium">重新命名資料夾</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? '儲存中...' : '儲存'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Move Folder Modal (移動資料夾)
// =============================================================================

function MoveFolderModal({
  folder,
  allFolders,
  onClose,
  onMove,
}: {
  folder: MediaFolder | null;
  allFolders: MediaFolder[];
  onClose: () => void;
  onMove: (folderId: number, newParentId: number | null) => Promise<void>;
}) {
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  if (!folder) return null;

  // 取得此資料夾的所有子孫 ID（不可移至自身或子孫）
  const getDescendantIds = (fId: number): Set<number> => {
    const ids = new Set<number>();
    const collect = (parentId: number) => {
      for (const f of allFolders) {
        if (f.parent_id === parentId) {
          ids.add(f.id);
          collect(f.id);
        }
      }
    };
    collect(fId);
    return ids;
  };
  const excludeIds = new Set([folder.id, ...getDescendantIds(folder.id)]);

  // 可選的目標資料夾
  const availableFolders = allFolders.filter((f) => !excludeIds.has(f.id));

  const handleMove = async () => {
    setSaving(true);
    try {
      await onMove(folder.id, selectedParentId);
      onClose();
    } catch (e: any) {
      alert(e.message || '移動失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-medium">移動「{folder.name}」至</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 max-h-64 overflow-y-auto">
          {/* 根層級選項 */}
          <button
            className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 flex items-center gap-2 ${
              selectedParentId === null ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'hover:bg-gray-50 text-gray-700'
            }`}
            onClick={() => setSelectedParentId(null)}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
            </svg>
            根層級（無父資料夾）
          </button>
          {availableFolders.map((f) => (
            <button
              key={f.id}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 flex items-center gap-2 ${
                selectedParentId === f.id ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'hover:bg-gray-50 text-gray-700'
              }`}
              onClick={() => setSelectedParentId(f.id)}
            >
              <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
              </svg>
              {f.path}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button
            onClick={handleMove}
            disabled={saving || selectedParentId === folder.parent_id}
          >
            {saving ? '移動中...' : '移動'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Create Folder Modal
// =============================================================================

function CreateFolderModal({
  isOpen,
  folders,
  selectedFolderId,
  onClose,
  onCreateFolder,
}: {
  isOpen: boolean;
  folders: MediaFolder[];
  selectedFolderId: number | null;
  onClose: () => void;
  onCreateFolder: (name: string, parentId?: number) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const parentId = (selectedFolderId !== null && selectedFolderId > 0) ? selectedFolderId : undefined;

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await onCreateFolder(name.trim(), parentId);
      setName('');
      onClose();
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-medium">新增資料夾</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-3">
          {parentId && (
            <p className="text-xs text-gray-500">
              建立在「{folders.find((f) => f.id === parentId)?.name}」之下
            </p>
          )}
          <input
            type="text"
            placeholder="資料夾名稱..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? '建立中...' : '建立'}
          </Button>
        </div>
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
  folders: MediaFolder[];
  tags: MediaTag[];
  onClose: () => void;
  onSave: (id: number, data: { alt_text?: string; caption?: string; folder_id?: number | null; tag_ids?: number[] }) => Promise<void>;
  onTagCreated: () => void;
}

function EditModal({ file, folders, tags, onClose, onSave, onTagCreated }: EditModalProps) {
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

// =============================================================================
// Import Modal Component (GCS 掃描匯入)
// =============================================================================

interface ImportModalProps {
  isOpen: boolean;
  folders: MediaFolder[];
  onClose: () => void;
  onImportComplete: () => void;
}

function ImportModal({ isOpen, folders, onClose, onImportComplete }: ImportModalProps) {
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [scannedFiles, setScannedFiles] = useState<GcsScanFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [targetFolderId, setTargetFolderId] = useState<number | null>(null);
  const [genVariants, setGenVariants] = useState(false);
  const [prefix, setPrefix] = useState('media/');
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: any[] } | null>(null);

  const handleScan = async () => {
    setScanning(true);
    setResult(null);
    try {
      const data = await importApi.scan(prefix);
      setScannedFiles(data.files);
      setSelectedFiles(new Set(data.files.map((f) => f.gcs_path)));
    } catch (error) {
      alert(`掃描失敗: ${(error as Error).message}`);
    } finally {
      setScanning(false);
    }
  };

  const toggleFile = (gcsPath: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(gcsPath)) next.delete(gcsPath);
      else next.add(gcsPath);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedFiles.size === scannedFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(scannedFiles.map((f) => f.gcs_path)));
    }
  };

  const handleImport = async () => {
    const filesToImport = scannedFiles.filter((f) => selectedFiles.has(f.gcs_path));
    if (filesToImport.length === 0) return;
    setImporting(true);
    try {
      const res = await importApi.execute({
        files: filesToImport,
        folder_id: targetFolderId,
        generate_variants: genVariants,
      });
      setResult(res);
      setScannedFiles((prev) => prev.filter((f) => !selectedFiles.has(f.gcs_path)));
      setSelectedFiles(new Set());
      onImportComplete();
    } catch (error) {
      alert(`匯入失敗: ${(error as Error).message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setScannedFiles([]);
    setSelectedFiles(new Set());
    setResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-medium">從 GCS 匯入現有圖片</h3>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded" disabled={importing}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">GCS 路徑前綴</label>
              <input type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="media/" />
            </div>
            <Button onClick={handleScan} disabled={scanning}>
              {scanning ? '掃描中...' : '掃描 GCS'}
            </Button>
          </div>

          {scannedFiles.length > 0 && (
            <div className="flex gap-4 items-center flex-wrap p-3 bg-blue-50 rounded-lg">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-gray-600 mb-1">匯入到資料夾</label>
                <select value={targetFolderId ?? ''} onChange={(e) => setTargetFolderId(e.target.value ? Number(e.target.value) : null)} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded">
                  <option value="">未分類（根目錄）</option>
                  {folders.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={genVariants} onChange={(e) => setGenVariants(e.target.checked)} className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
                <span>產生縮圖變體</span>
                <span className="text-xs text-gray-500">（較慢）</span>
              </label>
            </div>
          )}

          {scannedFiles.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedFiles.size === scannedFiles.length} onChange={toggleAll} className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
                  <span className="text-sm font-medium text-gray-700">
                    找到 {scannedFiles.length} 個未匯入的檔案
                    {selectedFiles.size > 0 && ` (已選 ${selectedFiles.size})`}
                  </span>
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                {scannedFiles.map((f) => (
                  <label key={f.gcs_path} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={selectedFiles.has(f.gcs_path)} onChange={() => toggleFile(f.gcs_path)} className="w-4 h-4 text-blue-600 border-gray-300 rounded flex-shrink-0" />
                    {f.mime_type.startsWith('image/') ? (
                      <img src={f.public_url} alt={f.filename} className="w-10 h-10 object-cover rounded flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder.svg'; }} />
                    ) : (
                      <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{f.filename}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(f.file_size)} · {f.mime_type}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {scanning && scannedFiles.length === 0 && (
            <div className="text-center py-8 text-gray-500">掃描 GCS 中...</div>
          )}

          {!scanning && scannedFiles.length === 0 && result === null && (
            <div className="text-center py-8 text-gray-500">
              <p>點擊「掃描 GCS」查找尚未匯入媒體庫的檔案</p>
              <p className="text-xs mt-1">會掃描指定路徑前綴下所有檔案，比對資料庫中已有記錄</p>
            </div>
          )}

          {result && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
              <p className="font-medium text-green-800">匯入完成</p>
              <p className="text-green-700">
                成功匯入 {result.imported} 個檔案
                {result.skipped > 0 && `，跳過 ${result.skipped} 個已存在`}
                {result.errors.length > 0 && `，${result.errors.length} 個失敗`}
              </p>
            </div>
          )}
        </div>

        {scannedFiles.length > 0 && (
          <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
            <Button variant="outline" onClick={handleClose}>取消</Button>
            <Button onClick={handleImport} disabled={importing || selectedFiles.size === 0}>
              {importing ? '匯入中...' : `匯入 ${selectedFiles.size} 個檔案`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SubFolderSection — 可展開/收合的次資料夾區塊
// =============================================================================

function SubFolderSection({
  folder,
  onEditFile,
}: {
  folder: MediaFolder;
  onEditFile: (item: MediaItem) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const handleToggle = async () => {
    if (!isExpanded && !loaded) {
      setLoading(true);
      try {
        const result = await mediaApi.getMediaList({
          folder_id: folder.id,
          per_page: 100,
        });
        setMediaItems(result.media);
        setLoaded(true);
      } catch (error) {
        console.error('Failed to load sub-folder media:', error);
      } finally {
        setLoading(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  return (
    <div>
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 py-3 text-left w-full hover:text-blue-600 transition-colors"
      >
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="currentColor" viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900">{folder.name}</h3>
        <span className="text-sm text-gray-400">({folder.file_count})</span>
      </button>

      {isExpanded && (
        <div className="pb-4">
          {loading ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, 180px)" }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="w-[180px] h-[180px] bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : mediaItems.length > 0 ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, 180px)" }}>
              {mediaItems.map((item) => (
                <div
                  key={item.id}
                  className="w-[180px] h-[180px] relative group rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onEditFile(item)}
                >
                  <img
                    src={getImageUrl(getSmallUrl(item))}
                    alt={item.alt_text || item.original_filename}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder.svg'; }}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-2">此資料夾中沒有媒體文件</p>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Inline Upload Zone (嵌入在內容區的拖曳上傳區)
// =============================================================================

function InlineUploadZone({
  folderId,
  onUploadComplete,
}: {
  folderId: number | null;
  onUploadComplete: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
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
  }, [folderId]);

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
      const targetFolderId = folderId && folderId > 0 ? folderId : undefined;
      for (const file of files) {
        await mediaApi.uploadMedia(file, targetFolderId, (percent) => {
          setUploadProgress((prev) => ({ ...prev, [file.name]: percent }));
        });
      }
      onUploadComplete();
    } catch (error) {
      alert(`上傳失敗: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center transition-colors h-full min-h-[200px] ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'
      }`}
    >
      {isUploading ? (
        <div className="px-4 w-full space-y-2">
          {Object.entries(uploadProgress).map(([filename, progress]) => (
            <div key={filename} className="text-xs">
              <div className="flex justify-between mb-0.5">
                <span className="truncate">{filename}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Plus icon */}
          <div className="w-12 h-12 border-2 border-gray-300 rounded-lg flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">
            Drag and drop or{' '}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-blue-500 hover:text-blue-600 underline"
            >
              browse
            </button>
            {' '}your files
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />
        </>
      )}
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

  const toggleSelectAll = () => {
    if (selectedIds.length === mediaItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(mediaItems.map((f) => f.id));
    }
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

  return (
    <AdminLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* ===================== 左欄側邊欄 ===================== */}
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

        {/* ===================== 右欄主內容區 ===================== */}
        <div className="flex-1 overflow-y-auto">
          {/* 頂部工具列：搜尋 + 全選 + 批次操作 */}
          <div className="px-8 pt-6 flex items-end gap-4">
            {/* 搜尋列 - 底線設計 */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pb-2 text-lg border-0 border-b border-gray-300 bg-transparent focus:outline-none focus:border-gray-500 placeholder-gray-400 transition-colors"
              />
            </div>

            {/* 右側：全選 + 批次操作 */}
            <div className="flex items-center gap-3 flex-shrink-0 pb-1">
              {mediaItems.length > 0 && (
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === mediaItems.length && mediaItems.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600 whitespace-nowrap">全選</span>
                </label>
              )}
              {selectedIds.length > 0 && (
                <>
                  <span className="text-sm text-blue-700 whitespace-nowrap">已選 {selectedIds.length} 項</span>
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
                </>
              )}
            </div>
          </div>

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
                  <div className="flex-1 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, 180px)" }}>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <div key={i} className="w-[180px] h-[180px] bg-gray-200 rounded-lg animate-pulse" />
                    ))
                  ) : (
                    mediaItems.map((item) => (
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
                        {/* Checkbox */}
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
                    ))
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
                {pagination && pagination.pages > 1 && (
                  <div className="mt-4 flex justify-center items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage - 1)} disabled={!pagination.has_prev}>
                      上一頁
                    </Button>
                    <span className="text-sm text-gray-600">第 {pagination.page} 頁，共 {pagination.pages} 頁</span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage + 1)} disabled={!pagination.has_next}>
                      下一頁
                    </Button>
                  </div>
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
                  <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, 180px)" }}>
                    {[...Array(14)].map((_, i) => (
                      <div key={i} className="w-[180px] h-[180px] bg-gray-200 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : mediaItems.length > 0 ? (
                  <>
                    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, 180px)" }}>
                      {mediaItems.map((item) => (
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
                      ))}
                    </div>

                    {/* 分頁 */}
                    {pagination && pagination.pages > 1 && (
                      <div className="mt-6 flex justify-center items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage - 1)} disabled={!pagination.has_prev}>
                          上一頁
                        </Button>
                        <span className="text-sm text-gray-600">第 {pagination.page} 頁，共 {pagination.pages} 頁</span>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage + 1)} disabled={!pagination.has_next}>
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
                        : '開始上傳您的第一個媒體文件'}
                    </p>
                    <Button onClick={() => setShowUploadModal(true)}>上傳文件</Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

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
