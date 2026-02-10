'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import type { MediaFolder } from '@/lib/api/strapi';

// =============================================================================
// Rename Folder Modal (重新命名資料夾)
// =============================================================================

export function RenameFolderModal({
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
