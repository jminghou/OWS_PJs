'use client';

import { useState, useEffect } from 'react';
import { contentApi } from '@/lib/api';
import { Content } from '@/types';

interface ContentSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function ContentSelector({ value, onChange }: ContentSelectorProps) {
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchContents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const fetchContents = async () => {
    try {
      setLoading(true);
      const response = await contentApi.getList({
        status: 'published',
        search,
        per_page: 50,
      });
      setContents(response.contents);
    } catch (error) {
      console.error('Error fetching contents:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="搜尋文章標題..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">-- 請選擇文章 --</option>
        {loading ? (
          <option disabled>載入中...</option>
        ) : (
          contents.map((content) => (
            <option key={content.id} value={content.id}>
              {content.title} ({content.slug}) [{content.language}]
            </option>
          ))
        )}
      </select>
    </div>
  );
}
