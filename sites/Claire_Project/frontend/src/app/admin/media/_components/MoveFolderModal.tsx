'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import type { MediaFolder } from '@/lib/api/strapi';

// =============================================================================
// Move Folder Modal (移動資料夾)
// =============================================================================

export function MoveFolderModal({
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
