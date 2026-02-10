'use client';

import { useState, useEffect, useRef } from 'react';

// =============================================================================
// EditableDescription (可編輯的資料夾描述)
// =============================================================================

export function EditableDescription({
  folderId,
  description,
  placeholder,
  onSave,
}: {
  folderId: number;
  description: string;
  placeholder: string;
  onSave: (desc: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(description);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 當外部 description 變化時同步
  useEffect(() => {
    setValue(description);
  }, [description, folderId]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (trimmed === description) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch (e) {
      console.error('Failed to save description:', e);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="mt-1">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSave();
            }
            if (e.key === 'Escape') {
              setValue(description);
              setEditing(false);
            }
          }}
          disabled={saving}
          rows={2}
          className="w-full text-sm text-gray-700 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500 resize-none"
          placeholder={placeholder}
        />
        <p className="text-xs text-gray-400 mt-0.5">Enter 儲存，Esc 取消</p>
      </div>
    );
  }

  return (
    <p
      className="text-sm text-gray-500 mt-1 cursor-pointer hover:text-gray-700 group"
      onClick={() => setEditing(true)}
      title="點擊編輯描述"
    >
      {description || <span className="italic">{placeholder}</span>}
      <svg className="inline-block w-3.5 h-3.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </p>
  );
}
