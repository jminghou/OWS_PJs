'use client';

import { Content } from '@/types';
import { formatDate } from '@/lib/utils';
import { Trash2 } from 'lucide-react';

interface ArticleListItemProps {
  article: Content;
  isSelected: boolean;
  onClick: () => void;
  onDelete: (id: number) => void;
}

export default function ArticleListItem({
  article,
  isSelected,
  onClick,
  onDelete,
}: ArticleListItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className={`group w-full text-left px-3 py-2.5 border-l-3 transition-colors cursor-pointer ${
        isSelected
          ? 'border-l-blue-600 bg-blue-50'
          : 'border-l-transparent hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
            {article.title || '無標題'}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                article.status === 'published' ? 'bg-green-500' : 'bg-yellow-500'
              }`}
            />
            <span className="text-xs text-gray-400">
              {article.status === 'published' ? '已發佈' : '草稿'}
            </span>
            <span className="text-xs text-gray-300">·</span>
            <span className="text-xs text-gray-400">
              {formatDate(article.updated_at)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(article.id);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
          title="刪除"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
