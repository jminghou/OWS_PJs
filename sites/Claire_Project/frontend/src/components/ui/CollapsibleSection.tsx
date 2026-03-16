'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export default function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  className = '',
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(
    defaultOpen ? undefined : 0
  );

  useEffect(() => {
    if (contentRef.current) {
      if (isOpen) {
        setContentHeight(contentRef.current.scrollHeight);
        // 動畫完成後移除固定高度，讓內容可以自然伸展
        const timer = setTimeout(() => {
          setContentHeight(undefined);
        }, 200);
        return () => clearTimeout(timer);
      } else {
        // 先設定當前高度，再設為 0 以觸發動畫
        setContentHeight(contentRef.current.scrollHeight);
        requestAnimationFrame(() => {
          setContentHeight(0);
        });
      }
    }
  }, [isOpen]);

  return (
    <div className={`border-b border-gray-100 ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700">{title}</span>
        {isOpen ? (
          <ChevronDown size={16} className="text-gray-400" />
        ) : (
          <ChevronRight size={16} className="text-gray-400" />
        )}
      </button>
      <div
        ref={contentRef}
        style={{ height: contentHeight !== undefined ? `${contentHeight}px` : 'auto' }}
        className="overflow-hidden transition-[height] duration-200 ease-in-out"
      >
        <div className="pb-4">{children}</div>
      </div>
    </div>
  );
}
