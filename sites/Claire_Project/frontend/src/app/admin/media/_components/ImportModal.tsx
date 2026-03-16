'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { importApi } from '@/lib/api/media';
import type { GcsScanFile } from '@/lib/api/media';
import type { MediaFolder } from '@/lib/api/strapi';
import { formatFileSize } from './utils';

// =============================================================================
// Import Modal Component (GCS 掃描匯入)
// =============================================================================

export interface ImportModalProps {
  isOpen: boolean;
  folders: MediaFolder[];
  onClose: () => void;
  onImportComplete: () => void;
}

export function ImportModal({ isOpen, folders, onClose, onImportComplete }: ImportModalProps) {
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
