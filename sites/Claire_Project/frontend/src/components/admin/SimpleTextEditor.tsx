'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
import { Bold, Italic, Strikethrough, Link as LinkIcon } from 'lucide-react';
import { useEffect, useCallback } from 'react';

export interface SimpleTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

// 樣式
const editorStyles = `
  .simple-editor p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    color: #94a3b8;
    pointer-events: none;
    height: 0;
  }
  .simple-editor p {
    margin-top: 0.25rem;
    margin-bottom: 0.25rem;
  }
  .simple-editor a {
    color: #2563eb;
    text-decoration: underline;
  }
`;

// 樣式注入
const EditorStyles = () => {
  useEffect(() => {
    const styleId = 'simple-text-editor-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = editorStyles;
    document.head.appendChild(style);
  }, []);

  return null;
};

// 氣泡選單
const EditorBubbleMenu = ({ editor }: { editor: any }) => {
  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('輸入連結網址:', previousUrl);

    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  const items = [
    {
      icon: <Bold size={16} />,
      title: '粗體',
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
    },
    {
      icon: <Italic size={16} />,
      title: '斜體',
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
    },
    {
      icon: <Strikethrough size={16} />,
      title: '刪除線',
      action: () => editor.chain().focus().toggleStrike().run(),
      isActive: editor.isActive('strike'),
    },
    {
      icon: <LinkIcon size={16} />,
      title: '超連結',
      action: setLink,
      isActive: editor.isActive('link'),
    },
  ];

  return (
    <BubbleMenu
      editor={editor}
      className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg shadow-xl border border-slate-700 overflow-hidden"
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            item.action();
          }}
          className={`p-2 rounded hover:bg-slate-700 transition-colors ${
            item.isActive ? 'text-blue-400' : 'text-white'
          }`}
          title={item.title}
        >
          {item.icon}
        </button>
      ))}
    </BubbleMenu>
  );
};

export default function SimpleTextEditor({
  content,
  onChange,
  placeholder = '輸入文字...',
  minHeight = '120px',
  className = '',
}: SimpleTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // 只保留基本功能
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      BubbleMenuExtension,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer hover:text-blue-800 transition-colors',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder,
      }),
    ],
    content: content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `simple-editor prose prose-sm max-w-none focus:outline-none text-slate-800 leading-relaxed`,
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  return (
    <div className={`w-full bg-white border border-gray-300 rounded-lg p-3 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 ${className}`}>
      <EditorBubbleMenu editor={editor} />
      <EditorContent editor={editor} />
      <EditorStyles />
    </div>
  );
}
