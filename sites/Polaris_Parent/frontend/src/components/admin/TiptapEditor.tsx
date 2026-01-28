"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
import FloatingMenuExtension from '@tiptap/extension-floating-menu';
import { 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  Heading3,
  List, 
  Quote, 
  Undo, 
  Redo,
  ImageIcon,
  Strikethrough,
  Link as LinkIcon,
  Code,
  Terminal,
  Type
} from 'lucide-react';
import { useEffect, useCallback } from 'react';

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
}

// --- 子組件：氣泡選單 (Bubble Menu) ---
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
    {
      icon: <Code size={16} />,
      title: '行內程式碼',
      action: () => editor.chain().focus().toggleCode().run(),
      isActive: editor.isActive('code'),
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
            item.isActive ? 'text-brand-purple-400' : 'text-white'
          }`}
          title={item.title}
        >
          {item.icon}
        </button>
      ))}
    </BubbleMenu>
  );
};

// --- 子組件：浮動選單 (Floating Menu) ---
const EditorFloatingMenu = ({ editor }: { editor: any }) => {
  if (!editor) return null;

  const addImage = () => {
    const url = window.prompt('輸入圖片網址:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const items = [
    {
      icon: <Heading2 size={18} />,
      title: '標題 2',
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive('heading', { level: 2 }),
    },
    {
      icon: <Heading3 size={18} />,
      title: '標題 3',
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: editor.isActive('heading', { level: 3 }),
    },
    {
      icon: <List size={18} />,
      title: '項目清單',
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList'),
    },
    {
      icon: <Terminal size={18} />,
      title: '程式碼區塊',
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: editor.isActive('codeBlock'),
    },
    {
      icon: <ImageIcon size={18} />,
      title: '插入圖片',
      action: addImage,
      isActive: false,
    },
  ];

  return (
    <FloatingMenu 
      editor={editor} 
      className="flex items-center gap-1 p-1 bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden"
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            item.action();
          }}
          className={`p-2 rounded hover:bg-slate-100 transition-colors flex items-center gap-2 px-3 ${
            item.isActive ? 'text-brand-purple-600 bg-brand-purple-50' : 'text-slate-600'
          }`}
          title={item.title}
        >
          {item.icon}
          <span className="text-xs font-medium">{item.title}</span>
        </button>
      ))}
    </FloatingMenu>
  );
};

// --- 主工具列 (MenuBar) ---
const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) return null;

  const buttons = [
    {
      icon: <Type size={18} />,
      title: '本文',
      action: () => editor.chain().focus().setParagraph().run(),
      isActive: editor.isActive('paragraph'),
    },
    {
      icon: <Heading1 size={18} />,
      title: '標題 1',
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: editor.isActive('heading', { level: 1 }),
    },
    {
      icon: <Heading2 size={18} />,
      title: '標題 2',
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive('heading', { level: 2 }),
    },
    {
      icon: <Quote size={18} />,
      title: '引用',
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: editor.isActive('blockquote'),
    },
  ];

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b bg-slate-50 sticky top-0 z-30 backdrop-blur-sm">
      {buttons.map((btn, i) => (
        <button
          key={i}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            btn.action();
          }}
          className={`p-2 rounded hover:bg-white hover:shadow-sm transition-all ${
            btn.isActive ? 'bg-white text-brand-purple-600 shadow-sm' : 'text-slate-500'
          }`}
          title={btn.title}
        >
          {btn.icon}
        </button>
      ))}
      
      <div className="w-px h-6 bg-slate-200 mx-1 self-center" />

      <div className="ml-auto flex gap-1">
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); editor.chain().focus().undo().run(); }}
          className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
          disabled={!editor.can().undo()}
        >
          <Undo size={18} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); editor.chain().focus().redo().run(); }}
          className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
          disabled={!editor.can().redo()}
        >
          <Redo size={18} />
        </button>
      </div>
    </div>
  );
};

export default function TiptapEditor({ content, onChange }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: {
          HTMLAttributes: {
            class: 'rounded-md bg-slate-900 text-slate-100 p-4 font-mono text-sm my-4',
          },
        },
      }),
      Underline,
      BubbleMenuExtension,
      FloatingMenuExtension,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-brand-purple-600 underline cursor-pointer hover:text-brand-purple-800 transition-colors',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-xl max-w-full h-auto mx-auto border-4 border-transparent hover:border-brand-purple-200 transition-all shadow-md my-8',
        },
      }),
      Placeholder.configure({
        placeholder: '在此輸入內容，或在空白行輸入以開啟工具選單...',
      }),
    ],
    content: content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-purple max-w-none focus:outline-none min-h-[500px] p-8 md:p-12 text-slate-800 leading-relaxed',
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
    <div className="w-full border-2 border-slate-200 rounded-xl overflow-hidden bg-white focus-within:border-brand-purple-400 transition-all shadow-sm relative">
      <MenuBar editor={editor} />
      
      <div className="relative">
        <EditorBubbleMenu editor={editor} />
        <EditorFloatingMenu editor={editor} />
        <EditorContent editor={editor} />
      </div>
      
      <style jsx global>{`
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #94a3b8;
          pointer-events: none;
          height: 0;
        }
        .tiptap img.ProseMirror-selectednode {
          outline: 3px solid #8b5cf6;
          box-shadow: 0 0 0 6px rgba(139, 92, 246, 0.1);
        }
        .tiptap blockquote {
          border-left: 4px solid #8b5cf6;
          padding-left: 1.5rem;
          font-style: italic;
          color: #475569;
          background: #f8fafc;
          padding-top: 1rem;
          padding-bottom: 1rem;
          margin: 1.5rem 0;
        }
        .tiptap ul {
          list-style-type: disc;
          padding-left: 1.5rem;
        }
        .tiptap ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
        }
      `}</style>
    </div>
  );
}
