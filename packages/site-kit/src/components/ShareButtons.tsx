'use client';

import { useState } from 'react';
import { Share2, Link2, Check } from 'lucide-react';

interface ShareButtonsProps {
  url: string;
  title: string;
}

/**
 * 文章社群分享按鈕。針對台灣/亞洲讀者，優先 LINE / Facebook，並提供 X / Threads / 複製連結。
 * 純前端互動（複製用 clipboard），各平台用標準 share intent URL。
 */
export default function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;

  const targets = [
    { name: 'LINE', href: `https://social-plugins.line.me/lineit/share?url=${enc(url)}` },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { name: 'X', href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}` },
    { name: 'Threads', href: `https://www.threads.net/intent/post?text=${enc(`${title} ${url}`)}` },
  ];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 部分瀏覽器/權限可能不允許，忽略即可 */
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mt-8 pt-6 border-t border-gray-200">
      <span className="flex items-center text-sm font-medium text-gray-600 mr-1">
        <Share2 size={16} className="mr-1.5" />
        分享
      </span>

      {targets.map((t) => (
        <a
          key={t.name}
          href={t.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors"
        >
          {t.name}
        </a>
      ))}

      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-1 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors"
      >
        {copied ? (
          <>
            <Check size={14} className="text-green-600" />
            已複製
          </>
        ) : (
          <>
            <Link2 size={14} />
            複製連結
          </>
        )}
      </button>
    </div>
  );
}
