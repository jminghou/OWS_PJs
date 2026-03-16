'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import type { MediaFolder } from '@/lib/api/strapi';

// =============================================================================
// Create Folder Modal
// =============================================================================

export function CreateFolderModal({
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
