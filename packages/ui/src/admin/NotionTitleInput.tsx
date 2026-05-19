'use client';

import { useRef, useEffect, useCallback } from 'react';

export interface NotionTitleInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function NotionTitleInput({
  value,
  onChange,
  placeholder = '無標題',
  className = '',
}: NotionTitleInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  useEffect(() => {
    adjustHeight();
  }, [adjustHeight]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const editor = document.querySelector('.tiptap.ProseMirror') as HTMLElement;
      if (editor) {
        editor.focus();
      }
    }
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      rows={1}
      className={`w-full text-4xl font-bold text-gray-900 placeholder-gray-300
                 border-none outline-none resize-none bg-transparent
                 focus:ring-0 leading-tight py-2 pl-14 ${className}`}
      style={{ minHeight: '3rem' }}
    />
  );
}

export default NotionTitleInput;
