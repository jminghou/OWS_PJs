'use client';

export interface UploadItem {
  id: string;
  filename: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

interface UploadProgressProps {
  items: UploadItem[];
  onDismiss?: (id: string) => void;
}

export default function UploadProgress({ items, onDismiss }: UploadProgressProps) {
  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h4 className="text-sm font-medium text-gray-700">
          上傳進度 ({items.filter((i) => i.status === 'uploading').length}/{items.length})
        </h4>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className="px-4 py-3 border-b border-gray-100 last:border-b-0"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-700 truncate flex-1 mr-2" title={item.filename}>
                {item.filename}
              </span>
              {item.status === 'completed' && (
                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {item.status === 'error' && (
                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {item.status === 'uploading' && (
                <span className="text-xs text-gray-500 flex-shrink-0">{item.progress}%</span>
              )}
            </div>

            {/* 進度條 */}
            {item.status === 'uploading' && (
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            )}

            {/* 完成狀態 */}
            {item.status === 'completed' && (
              <div className="w-full bg-green-500 rounded-full h-1.5" />
            )}

            {/* 錯誤狀態 */}
            {item.status === 'error' && (
              <>
                <div className="w-full bg-red-500 rounded-full h-1.5" />
                {item.error && (
                  <p className="text-xs text-red-500 mt-1">{item.error}</p>
                )}
              </>
            )}

            {/* 關閉按鈕（僅完成或錯誤時顯示） */}
            {(item.status === 'completed' || item.status === 'error') && onDismiss && (
              <button
                onClick={() => onDismiss(item.id)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
