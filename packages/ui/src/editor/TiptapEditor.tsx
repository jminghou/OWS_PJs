"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { createRoot } from 'react-dom/client';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  ImageIcon,
  Strikethrough,
  Link as LinkIcon,
  Code,
  Terminal,
  Type,
  Plus,
  X,
  GripVertical,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Copy,
  Check,
  ExternalLink,
  Unlink,
} from 'lucide-react';
import { useEffect, useCallback, useState, useRef } from 'react';
import MediaBrowser from '@/components/admin/MediaBrowser';
import { getImageUrl, getGcsImageUrl } from '@/lib/utils';

// ============ Types ============
export interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  /** Tailwind 色彩 class，用於工具列高亮等 (例如 'text-purple-400') */
  accentColorClass?: string;
  /** 是否啟用區塊把手 (Plus/Grip) */
  showBlockHandle?: boolean;
}

export interface EditorLabels {
  bold?: string;
  italic?: string;
  strikethrough?: string;
  link?: string;
  code?: string;
  text?: string;
  heading1?: string;
  heading2?: string;
  heading3?: string;
  bulletList?: string;
  orderedList?: string;
  quote?: string;
  codeBlock?: string;
  image?: string;
  basicBlocks?: string;
  addBlock?: string;
  dragBlock?: string;
  enterLinkUrl?: string;
  enterImageUrl?: string;
  moveBlock?: string;
}

const defaultLabels: EditorLabels = {
  bold: '粗體',
  italic: '斜體',
  strikethrough: '刪除線',
  link: '超連結',
  code: '行內程式碼',
  text: '文字',
  heading1: '標題 1',
  heading2: '標題 2',
  heading3: '標題 3',
  bulletList: '項目清單',
  orderedList: '編號清單',
  quote: '引用',
  codeBlock: '程式碼區塊',
  image: '圖片',
  basicBlocks: '基本區塊',
  addBlock: '點擊新增區塊',
  dragBlock: '拖曳移動區塊',
  enterLinkUrl: '輸入連結網址:',
  enterImageUrl: '輸入圖片網址:',
  moveBlock: '移動區塊',
};

// ============ Lowlight Instance ============
const lowlight = createLowlight(common);

// ============ Code Block Languages ============
const CODE_LANGUAGES = [
  { value: '', label: 'Auto' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'xml', label: 'XML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'yaml', label: 'YAML' },
];

// ============ Code Block NodeView ============
const CodeBlockComponent = ({ node, updateAttributes, deleteNode, editor }: any) => {
  const [copied, setCopied] = useState(false);

  const copyCode = useCallback(() => {
    const text = node.textContent;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [node]);

  // 將程式碼區塊轉換為一般段落文字
  const convertToText = useCallback(() => {
    if (!editor) return;
    const text = node.textContent;
    // 刪除程式碼區塊，再插入一般段落
    deleteNode();
    editor.chain().focus().insertContent(`<p>${text}</p>`).run();
  }, [editor, node, deleteNode]);

  return (
    <NodeViewWrapper className="relative my-4">
      <div className="flex items-center justify-between bg-slate-800 rounded-t-md px-3 py-1.5 border-b border-slate-700">
        <select
          value={node.attrs.language || ''}
          onChange={(e) => updateAttributes({ language: e.target.value })}
          contentEditable={false}
          className="bg-transparent text-xs text-slate-400 outline-none cursor-pointer hover:text-slate-200 transition-colors"
        >
          {CODE_LANGUAGES.map(lang => (
            <option key={lang.value} value={lang.value} className="bg-slate-800 text-slate-200">
              {lang.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1" contentEditable={false}>
          <button
            type="button"
            onClick={copyCode}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-0.5 rounded hover:bg-slate-700"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? '已複製' : '複製'}
          </button>
          <button
            type="button"
            onClick={convertToText}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-0.5 rounded hover:bg-slate-700"
            title="轉換為一般文字"
          >
            <Type size={12} />
          </button>
          <button
            type="button"
            onClick={deleteNode}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-0.5 rounded hover:bg-slate-700"
            title="刪除程式碼區塊"
          >
            <X size={12} />
          </button>
        </div>
      </div>
      <pre className="rounded-b-md rounded-t-none !mt-0 bg-slate-900 text-slate-100 p-4 font-mono text-sm">
        <NodeViewContent as="div" className="hljs" />
      </pre>
    </NodeViewWrapper>
  );
};

// ============ Slash Command Items ============
interface SlashCommandItem {
  title: string;
  description: string;
  icon: any;
  action: (editor: any) => void;
  aliases?: string[];
}

const createSlashCommandItems = (onImageRequest?: () => void): SlashCommandItem[] => [
  { title: '文字', description: '一般段落文字', icon: Type, aliases: ['text', 'paragraph', 'p'],
    action: (editor) => editor.chain().focus().setParagraph().run() },
  { title: '標題 1', description: '大標題', icon: Heading1, aliases: ['h1', 'heading1'],
    action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run() },
  { title: '標題 2', description: '中標題', icon: Heading2, aliases: ['h2', 'heading2'],
    action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
  { title: '標題 3', description: '小標題', icon: Heading3, aliases: ['h3', 'heading3'],
    action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run() },
  { title: '項目清單', description: '建立項目符號清單', icon: List, aliases: ['bullet', 'list', 'ul'],
    action: (editor) => editor.chain().focus().toggleBulletList().run() },
  { title: '編號清單', description: '建立編號清單', icon: ListOrdered, aliases: ['number', 'ordered', 'ol'],
    action: (editor) => editor.chain().focus().toggleOrderedList().run() },
  { title: '引用', description: '插入引用區塊', icon: Quote, aliases: ['quote', 'blockquote'],
    action: (editor) => editor.chain().focus().toggleBlockquote().run() },
  { title: '程式碼區塊', description: '插入程式碼', icon: Terminal, aliases: ['code', 'codeblock'],
    action: (editor) => editor.chain().focus().toggleCodeBlock().run() },
  { title: '圖片', description: '從媒體庫選擇圖片', icon: ImageIcon, aliases: ['image', 'img', 'photo'],
    action: () => onImageRequest?.() },
];

// ============ Slash Command Menu Component ============
const SlashCommandMenuComponent = ({
  items,
  selectedIndex,
  onSelect,
}: {
  items: SlashCommandItem[];
  selectedIndex: number;
  onSelect: (item: SlashCommandItem) => void;
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const activeEl = menuRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 py-2 w-64">
        <div className="px-3 py-2 text-sm text-gray-400">找不到相符的區塊類型</div>
      </div>
    );
  }

  return (
    <div ref={menuRef} className="bg-white rounded-lg shadow-xl border border-gray-200 py-2 w-64 max-h-80 overflow-y-auto">
      <div className="px-3 py-2 text-xs font-medium text-gray-400 uppercase">基本區塊</div>
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <button
            key={item.title}
            type="button"
            data-index={i}
            onClick={() => onSelect(item)}
            className={`w-full px-3 py-2 flex items-start gap-3 transition-colors text-left ${
              i === selectedIndex ? 'bg-gray-50' : 'hover:bg-gray-50'
            }`}
          >
            <div className="p-1.5 bg-gray-100 rounded text-gray-600">
              <Icon size={18} />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">{item.title}</div>
              <div className="text-xs text-gray-500">{item.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

// ============ Slash Commands Extension ============
const createSlashCommandsExtension = (onImageRequest?: () => void) => {
  const allItems = createSlashCommandItems(onImageRequest);

  return Extension.create({
    name: 'slashCommands',
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: '/',
          allowSpaces: false,
          startOfLine: false,
          items: ({ query }) => {
            const q = query.toLowerCase();
            if (!q) return allItems;
            return allItems.filter(item =>
              item.title.toLowerCase().includes(q) ||
              item.description.toLowerCase().includes(q) ||
              item.aliases?.some(a => a.includes(q))
            );
          },
          command: ({ editor, range, props }: { editor: any; range: any; props: any }) => {
            editor.chain().focus().deleteRange(range).run();
            props.action(editor);
          },
          render: () => {
            let popup: HTMLDivElement | null = null;
            let root: any = null;
            let selectedIndex = 0;
            let currentItems: SlashCommandItem[] = [];
            let currentCommand: ((props: any) => void) | null = null;

            const updateMenu = () => {
              if (!root) return;
              root.render(
                <SlashCommandMenuComponent
                  items={currentItems}
                  selectedIndex={selectedIndex}
                  onSelect={(item) => {
                    if (currentCommand) currentCommand(item);
                  }}
                />
              );
            };

            return {
              onStart: (props) => {
                popup = document.createElement('div');
                popup.style.position = 'absolute';
                popup.style.zIndex = '50';
                document.body.appendChild(popup);
                root = createRoot(popup);

                currentItems = props.items;
                currentCommand = props.command;
                selectedIndex = 0;

                const rect = props.clientRect?.();
                if (rect && popup) {
                  popup.style.left = `${rect.left}px`;
                  popup.style.top = `${rect.bottom + 4}px`;
                }
                updateMenu();
              },
              onUpdate: (props) => {
                currentItems = props.items;
                currentCommand = props.command;
                selectedIndex = 0;

                const rect = props.clientRect?.();
                if (rect && popup) {
                  popup.style.left = `${rect.left}px`;
                  popup.style.top = `${rect.bottom + 4}px`;
                }
                updateMenu();
              },
              onKeyDown: ({ event }) => {
                if (event.key === 'ArrowUp') {
                  selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
                  updateMenu();
                  return true;
                }
                if (event.key === 'ArrowDown') {
                  selectedIndex = (selectedIndex + 1) % currentItems.length;
                  updateMenu();
                  return true;
                }
                if (event.key === 'Enter') {
                  if (currentItems[selectedIndex] && currentCommand) {
                    currentCommand(currentItems[selectedIndex]);
                  }
                  return true;
                }
                if (event.key === 'Escape') {
                  return true;
                }
                return false;
              },
              onExit: () => {
                if (root) {
                  root.unmount();
                  root = null;
                }
                if (popup) {
                  popup.remove();
                  popup = null;
                }
                currentItems = [];
                currentCommand = null;
                selectedIndex = 0;
              },
            };
          },
        }),
      ];
    },
  });
};

// ============ Styles ============
const tiptapStyles = `
  .tiptap p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    color: #94a3b8;
    pointer-events: none;
    height: 0;
  }
  .tiptap p {
    margin-top: 0.25rem;
    margin-bottom: 0.25rem;
  }
  .tiptap h1, .tiptap h2, .tiptap h3 {
    margin-top: 1rem;
    margin-bottom: 0.25rem;
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
  .tiptap .dragging {
    opacity: 0.5;
    background: #f1f5f9;
  }
  /* Code block syntax highlighting (atom-one-dark) */
  .tiptap .hljs-keyword,
  .tiptap .hljs-selector-tag,
  .tiptap .hljs-type { color: #c678dd; }
  .tiptap .hljs-string,
  .tiptap .hljs-attr,
  .tiptap .hljs-selector-id,
  .tiptap .hljs-selector-class { color: #98c379; }
  .tiptap .hljs-number,
  .tiptap .hljs-literal { color: #d19a66; }
  .tiptap .hljs-comment,
  .tiptap .hljs-doctag { color: #5c6370; font-style: italic; }
  .tiptap .hljs-built_in,
  .tiptap .hljs-builtin-name { color: #e6c07b; }
  .tiptap .hljs-function,
  .tiptap .hljs-title { color: #61afef; }
  .tiptap .hljs-variable,
  .tiptap .hljs-template-variable { color: #e06c75; }
  .tiptap .hljs-tag { color: #e06c75; }
  .tiptap .hljs-name { color: #e06c75; }
  .tiptap .hljs-attribute { color: #d19a66; }
  .tiptap .hljs-regexp { color: #98c379; }
  .tiptap .hljs-symbol,
  .tiptap .hljs-bullet { color: #56b6c2; }
  .tiptap .hljs-meta { color: #61afef; }
  .tiptap .hljs-deletion { color: #e06c75; background: rgba(224,108,117,0.1); }
  .tiptap .hljs-addition { color: #98c379; background: rgba(152,195,121,0.1); }
`;

// 樣式注入組件 - 只在客戶端渲染一次
const TiptapStyles = () => {
  useEffect(() => {
    const styleId = 'tiptap-editor-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = tiptapStyles;
    document.head.appendChild(style);

    return () => {
      // 不移除樣式，因為可能有多個編輯器實例
    };
  }, []);

  return null;
};

// ============ Sub Components ============

// --- 連結編輯浮動面板 (Inline Link Editor) ---
const LinkEditor = ({
  editor,
  onClose,
  savedSelection,
}: {
  editor: any;
  onClose: () => void;
  savedSelection: { from: number; to: number } | null;
}) => {
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const existingHref = editor?.getAttributes('link').href || '';

  useEffect(() => {
    setUrl(existingHref);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [existingHref]);

  // 計算浮動位置
  useEffect(() => {
    if (!editor || !savedSelection) return;
    try {
      const coords = editor.view.coordsAtPos(savedSelection.from);
      const editorRect = editor.view.dom.closest('.w-full')?.getBoundingClientRect();
      if (editorRect) {
        setPosition({
          top: coords.bottom - editorRect.top + 8,
          left: coords.left - editorRect.left,
        });
      }
    } catch {
      // 如果座標計算失敗，居中顯示
      setPosition({ top: 40, left: 100 });
    }
  }, [editor, savedSelection]);

  // 點擊外部關閉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const applyLink = useCallback(() => {
    if (!editor || !savedSelection) return;
    // 恢復選取範圍
    editor.chain().focus().setTextSelection(savedSelection).run();
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      const normalizedUrl = url.match(/^https?:\/\//) ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href: normalizedUrl }).run();
    }
    onClose();
  }, [editor, url, savedSelection, onClose]);

  const removeLink = useCallback(() => {
    if (!editor || !savedSelection) return;
    editor.chain().focus().setTextSelection(savedSelection).extendMarkRange('link').unsetLink().run();
    onClose();
  }, [editor, savedSelection, onClose]);

  if (!position) return null;

  return (
    <div
      ref={panelRef}
      className="absolute z-50 flex items-center gap-1 p-1.5 bg-slate-900 rounded-lg shadow-xl border border-slate-700"
      style={{ top: position.top, left: position.left }}
    >
      <input
        ref={inputRef}
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        }}
        placeholder="輸入連結網址..."
        className="bg-slate-800 text-white text-sm px-3 py-1.5 rounded outline-none border border-slate-600 focus:border-purple-400 w-64 transition-colors"
      />
      <button
        type="button"
        onClick={applyLink}
        className="p-1.5 rounded hover:bg-slate-700 text-green-400 transition-colors"
        title="套用連結"
      >
        <Check size={16} />
      </button>
      {existingHref && (
        <>
          <button
            type="button"
            onClick={() => window.open(existingHref, '_blank')}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="開啟連結"
          >
            <ExternalLink size={16} />
          </button>
          <button
            type="button"
            onClick={removeLink}
            className="p-1.5 rounded hover:bg-slate-700 text-red-400 transition-colors"
            title="移除連結"
          >
            <Unlink size={16} />
          </button>
        </>
      )}
    </div>
  );
};

// --- 統一氣泡選單 (Unified Bubble Menu) ---
const EditorBubbleMenu = ({
  editor,
  labels = defaultLabels,
  accentColorClass = 'text-purple-400',
  onLinkEdit,
}: {
  editor: any;
  labels?: EditorLabels;
  accentColorClass?: string;
  onLinkEdit?: () => void;
}) => {
  // 用 state 追蹤是否選取了圖片，透過 onSelectionUpdate 確保同步
  const [isImageSelected, setIsImageSelected] = useState(false);

  useEffect(() => {
    if (!editor) return;
    const onSelectionUpdate = () => {
      const { selection } = editor.state;
      setIsImageSelected(
        selection instanceof NodeSelection && editor.isActive('image')
      );
    };
    editor.on('selectionUpdate', onSelectionUpdate);
    return () => { editor.off('selectionUpdate', onSelectionUpdate); };
  }, [editor]);

  if (!editor) return null;

  const align = editor.getAttributes('image').align || 'center';

  // 文字格式按鈕
  const textItems = [
    {
      icon: <Bold size={16} />,
      title: labels.bold,
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
    },
    {
      icon: <Italic size={16} />,
      title: labels.italic,
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
    },
    {
      icon: <Strikethrough size={16} />,
      title: labels.strikethrough,
      action: () => editor.chain().focus().toggleStrike().run(),
      isActive: editor.isActive('strike'),
    },
    {
      icon: <LinkIcon size={16} />,
      title: labels.link,
      action: () => onLinkEdit?.(),
      isActive: editor.isActive('link'),
    },
    {
      icon: <Code size={16} />,
      title: labels.code,
      action: () => editor.chain().focus().toggleCode().run(),
      isActive: editor.isActive('code'),
    },
  ];

  // 圖片對齊按鈕
  const imageItems = [
    {
      icon: <AlignLeft size={16} />,
      title: '靠左文繞圖',
      action: () => editor.chain().focus().updateAttributes('image', { align: 'left' }).run(),
      isActive: align === 'left',
    },
    {
      icon: <AlignCenter size={16} />,
      title: '置中',
      action: () => editor.chain().focus().updateAttributes('image', { align: 'center' }).run(),
      isActive: align === 'center',
    },
    {
      icon: <AlignRight size={16} />,
      title: '靠右文繞圖',
      action: () => editor.chain().focus().updateAttributes('image', { align: 'right' }).run(),
      isActive: align === 'right',
    },
  ];

  const items = isImageSelected ? imageItems : textItems;

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ state, editor }) => {
        // 圖片 NodeSelection 或文字選取都顯示
        if (state.selection instanceof NodeSelection && editor.isActive('image')) return true;
        return !state.selection.empty;
      }}
      className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg shadow-xl border border-slate-700 overflow-hidden"
    >
      {items.map((item, i) => (
        <button
          key={`${isImageSelected ? 'img' : 'txt'}-${i}`}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            item.action();
          }}
          className={`p-2 rounded hover:bg-slate-700 transition-colors ${
            item.isActive ? accentColorClass : 'text-white'
          }`}
          title={item.title}
        >
          {item.icon}
        </button>
      ))}
    </BubbleMenu>
  );
};

// --- 區塊選單 (Block Menu) ---
interface BlockMenuProps {
  editor: any;
  position: { top: number; left: number };
  onClose: () => void;
  labels?: EditorLabels;
}

const BlockMenu = ({ editor, position, onClose, labels = defaultLabels }: BlockMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showMediaBrowser, setShowMediaBrowser] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [pendingImage, setPendingImage] = useState<any>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // 如果媒體庫開啟中，不處理點擊外部關閉選單
      if (showMediaBrowser) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, showMediaBrowser]);

  const handleImageSelect = (media: any) => {
    const imagePath = media.file_path || media.url || media.path;
    if (imagePath) {
      // 開啟尺寸選擇對話框，而不是直接插入
      setPendingImage(media);
      setShowVariantModal(true);
    }
    setShowMediaBrowser(false);
  };

  const insertImageWithVariant = (variant?: string) => {
    if (!pendingImage) return;
    
    const imagePath = pendingImage.file_path || pendingImage.url || pendingImage.path;
    
    console.log('Inserting image:', { imagePath, variant });
    
    if (!variant) {
      const fullUrl = getImageUrl(imagePath);
      editor.chain().focus().setImage({ src: fullUrl }).run();
    } else {
      const isGcs = imagePath.includes('storage.googleapis.com');
      let fullUrl = '';
      
      if (isGcs) {
        const lastSlashIndex = imagePath.lastIndexOf('/');
        const baseUrl = imagePath.substring(0, lastSlashIndex + 1);
        const filename = imagePath.substring(lastSlashIndex + 1);
        
        // 1. 移除可能存在的所有變體前綴 (thumbnail_, small_, medium_, large_)
        let cleanFilename = filename.replace(/^(thumbnail|small|medium|large)_/, '');
        
        // 2. 處理副檔名：
        // 如果檔名包含底線副檔名 (例如 _png)，但沒有點副檔名
        // 根據截圖，縮圖檔名規律是：variant + "_" + filename + ".png" (或原本的副檔名)
        // 例如：原圖 f2ed679d_png -> 縮圖 small_f2ed679d_png.png
        // 例如：原圖 d959857f_purple_universe.png -> 縮圖 medium_d959857f_purple_universe.png
        
        // 我們先檢查 cleanFilename 是否包含點
        const hasDot = cleanFilename.includes('.');
        
        if (!hasDot) {
          // 如果沒有點，假設它是 f2ed679d_png 這種格式，我們需要補上點副檔名
          const extensionMatch = cleanFilename.match(/_(png|jpg|jpeg|webp|gif)$/i);
          if (extensionMatch) {
            const ext = extensionMatch[1];
            fullUrl = `${baseUrl}${variant}_${cleanFilename}.${ext}`;
          } else {
            // 萬一沒匹配到，就直接拼
            fullUrl = `${baseUrl}${variant}_${cleanFilename}`;
          }
        } else {
          // 如果已經有點 (例如 d959857f_purple_universe.png)，直接拼前綴
          fullUrl = `${baseUrl}${variant}_${cleanFilename}`;
        }
      } else {
        fullUrl = getImageUrl(imagePath, variant);
      }
      
      console.log('Generated URL:', fullUrl);
      editor.chain().focus().setImage({ src: fullUrl }).run();
    }
    
    setShowVariantModal(false);
    setPendingImage(null);
    onClose();
  };

  const addImage = () => {
    setShowMediaBrowser(true);
  };

  const menuItems = [
    {
      icon: <Type size={18} />,
      title: labels.text,
      description: '一般段落文字',
      action: () => { editor.chain().focus().setParagraph().run(); onClose(); },
    },
    {
      icon: <Heading1 size={18} />,
      title: labels.heading1,
      description: '大標題',
      action: () => { editor.chain().focus().toggleHeading({ level: 1 }).run(); onClose(); },
    },
    {
      icon: <Heading2 size={18} />,
      title: labels.heading2,
      description: '中標題',
      action: () => { editor.chain().focus().toggleHeading({ level: 2 }).run(); onClose(); },
    },
    {
      icon: <Heading3 size={18} />,
      title: labels.heading3,
      description: '小標題',
      action: () => { editor.chain().focus().toggleHeading({ level: 3 }).run(); onClose(); },
    },
    {
      icon: <List size={18} />,
      title: labels.bulletList,
      description: '建立項目符號清單',
      action: () => { editor.chain().focus().toggleBulletList().run(); onClose(); },
    },
    {
      icon: <ListOrdered size={18} />,
      title: labels.orderedList,
      description: '建立編號清單',
      action: () => { editor.chain().focus().toggleOrderedList().run(); onClose(); },
    },
    {
      icon: <Quote size={18} />,
      title: labels.quote,
      description: '插入引用區塊',
      action: () => { editor.chain().focus().toggleBlockquote().run(); onClose(); },
    },
    {
      icon: <Terminal size={18} />,
      title: labels.codeBlock,
      description: '插入程式碼',
      action: () => { editor.chain().focus().toggleCodeBlock().run(); onClose(); },
    },
    {
      icon: <ImageIcon size={18} />,
      title: labels.image,
      description: '從媒體庫選擇圖片',
      action: addImage,
    },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-2 w-64 max-h-80 overflow-y-auto"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 py-2 text-xs font-medium text-gray-400 uppercase">{labels.basicBlocks}</div>
      {menuItems.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            item.action();
          }}
          className="w-full px-3 py-2 flex items-start gap-3 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="p-1.5 bg-gray-100 rounded text-gray-600">
            {item.icon}
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">{item.title}</div>
            <div className="text-xs text-gray-500">{item.description}</div>
          </div>
        </button>
      ))}

      <MediaBrowser
        isOpen={showMediaBrowser}
        onClose={() => setShowMediaBrowser(false)}
        onSelect={handleImageSelect}
      />

      {/* 圖片尺寸選擇彈窗 */}
      {showVariantModal && pendingImage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">選擇插入尺寸</h3>
              <button 
                onClick={() => { setShowVariantModal(false); onClose(); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="aspect-video w-full rounded-lg bg-gray-50 border border-gray-100 overflow-hidden mb-6">
                <img 
                  src={getImageUrl(pendingImage.file_path || pendingImage.url || pendingImage.path, 'small')} 
                  className="w-full h-full object-contain"
                  alt="Preview"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: undefined, label: '原始圖片', desc: '不壓縮' },
                  { id: 'large', label: '大型 (Large)', desc: '適合滿版' },
                  { id: 'medium', label: '中型 (Medium)', desc: '適合內文' },
                  { id: 'small', label: '小型 (Small)', desc: '適合側欄' },
                  { id: 'thumbnail', label: '縮圖 (Thumb)', desc: '正方形' },
                ].map((variant) => (
                  <button
                    key={variant.id || 'original'}
                    onClick={() => insertImageWithVariant(variant.id)}
                    className="flex flex-col items-start p-3 rounded-xl border border-gray-200 hover:border-brand-purple-500 hover:bg-brand-purple-50 transition-all text-left group"
                  >
                    <span className="text-sm font-bold text-gray-900 group-hover:text-brand-purple-700">{variant.label}</span>
                    <span className="text-[10px] text-gray-500 group-hover:text-brand-purple-500">{variant.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 flex justify-end">
              <button 
                onClick={() => { setShowVariantModal(false); onClose(); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- 區塊把手 (Block Handle) ---
interface BlockHandleProps {
  editor: any;
  editorRef: React.RefObject<HTMLDivElement | null>;
  labels?: EditorLabels;
  accentColorClass?: string;
}

// 找到區塊元素的輔助函數
const findBlockNode = (target: HTMLElement, proseMirror: Element): HTMLElement | null => {
  const blockElements = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE', 'PRE'];
  let blockNode = target;

  while (blockNode && blockNode !== proseMirror) {
    if (blockElements.includes(blockNode.tagName)) {
      if (blockNode.parentElement === proseMirror) {
        return blockNode;
      }
    }
    blockNode = blockNode.parentElement as HTMLElement;
  }

  return null;
};

const BlockHandle = ({ editor, editorRef, labels = defaultLabels, accentColorClass = 'bg-purple-500' }: BlockHandleProps) => {
  const [handlePosition, setHandlePosition] = useState<{ top: number } | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [currentNode, setCurrentNode] = useState<HTMLElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<{ top: number; show: boolean }>({ top: 0, show: false });
  const draggedNodeRef = useRef<HTMLElement | null>(null);
  const draggedPosRef = useRef<{ from: number; to: number } | null>(null);
  // 儲存預計算的放置位置，確保 dragover 和 drop 使用相同的位置
  const dropTargetRef = useRef<{ blockNode: HTMLElement; insertBefore: boolean } | null>(null);

  // 打字時隱藏把手
  useEffect(() => {
    if (!editorRef.current) return;

    const editorElement = editorRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略功能鍵和組合鍵
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // 忽略導航鍵
      const navigationKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Escape', 'Tab'];
      if (navigationKeys.includes(e.key)) return;

      // 打字時隱藏把手
      if (!showMenu && !isDragging) {
        setHandlePosition(null);
        setCurrentNode(null);
      }
    };

    editorElement.addEventListener('keydown', handleKeyDown);
    return () => editorElement.removeEventListener('keydown', handleKeyDown);
  }, [editorRef, showMenu, isDragging]);

  useEffect(() => {
    if (!editorRef.current || !editor) return;

    const editorElement = editorRef.current;
    const proseMirror = editorElement.querySelector('.ProseMirror');
    if (!proseMirror) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging || showMenu) return;

      const target = e.target as HTMLElement;
      if (target.closest('.block-handle-container')) return;

      const blockNode = findBlockNode(target, proseMirror);

      if (blockNode) {
        const rect = blockNode.getBoundingClientRect();
        const editorRect = editorElement.getBoundingClientRect();

        setHandlePosition({
          top: rect.top - editorRect.top,
        });
        setCurrentNode(blockNode);
      }
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (relatedTarget?.closest('.block-handle-container')) return;

      if (!showMenu && !isDragging) {
        setHandlePosition(null);
        setCurrentNode(null);
      }
    };

    // 拖曳經過時顯示 drop indicator
    const handleDragOver = (e: DragEvent) => {
      if (!draggedNodeRef.current) return;

      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }

      const target = e.target as HTMLElement;

      // 重新獲取 proseMirror 確保是最新的
      const currentProseMirror = editorElement.querySelector('.ProseMirror');
      if (!currentProseMirror) return;

      const blockNode = findBlockNode(target, currentProseMirror);

      // 檢查是否為有效的放置目標（不是被拖曳的區塊）
      if (blockNode && !blockNode.classList.contains('dragging')) {
        const rect = blockNode.getBoundingClientRect();
        const editorRect = editorElement.getBoundingClientRect();
        const mouseY = e.clientY;
        const blockMiddle = rect.top + rect.height / 2;

        // 決定放在上方還是下方
        const insertBefore = mouseY < blockMiddle;

        // 預先驗證此放置位置是否有效（避免指示器顯示但實際無法放置的情況）
        let isValidDrop = true;
        if (editor && draggedPosRef.current) {
          try {
            const targetPos = editor.view.posAtDOM(blockNode, 0);
            const targetResolvedPos = editor.state.doc.resolve(targetPos);
            let targetNodeStart: number = -1;
            let targetNodeEnd: number = -1;

            try {
              targetNodeStart = targetResolvedPos.before(1);
              targetNodeEnd = targetResolvedPos.after(1);
            } catch {
              const depth = targetResolvedPos.depth;
              if (depth > 0) {
                targetNodeStart = targetResolvedPos.before(depth);
                targetNodeEnd = targetResolvedPos.after(depth);
              } else {
                isValidDrop = false;
              }
            }

            if (isValidDrop && targetNodeStart >= 0 && targetNodeEnd >= 0) {
              const { from: dragFrom, to: dragTo } = draggedPosRef.current;
              const insertPos = insertBefore ? targetNodeStart : targetNodeEnd;

              // 檢查是否為無效的相鄰位置
              // 如果插入位置在拖曳範圍內或緊鄰拖曳範圍，則視為無效
              if (insertPos >= dragFrom && insertPos <= dragTo) {
                isValidDrop = false;
              }
            }
          } catch {
            // 如果無法計算位置，仍然顯示指示器（讓 drop 處理錯誤）
          }
        }

        if (isValidDrop) {
          const indicatorTop = insertBefore
            ? rect.top - editorRect.top - 1
            : rect.bottom - editorRect.top - 1;

          // 儲存目標資訊供 drop 使用
          dropTargetRef.current = { blockNode, insertBefore };
          setDropIndicator({ top: indicatorTop, show: true });
        } else {
          dropTargetRef.current = null;
          setDropIndicator({ top: 0, show: false });
        }
      } else {
        // 如果找不到有效的區塊或正在拖曳的區塊上方，隱藏指示器
        dropTargetRef.current = null;
        setDropIndicator({ top: 0, show: false });
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      // 只有真正離開編輯區時才隱藏指示器
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (!editorElement.contains(relatedTarget)) {
        setDropIndicator({ top: 0, show: false });
        dropTargetRef.current = null;
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDropIndicator({ top: 0, show: false });

      if (!draggedNodeRef.current || !draggedPosRef.current || !editor) {
        draggedNodeRef.current = null;
        draggedPosRef.current = null;
        dropTargetRef.current = null;
        return;
      }

      // 使用預先儲存的目標資訊（確保與指示器顯示一致）
      const savedTarget = dropTargetRef.current;

      // 重新獲取 proseMirror 確保是最新的
      const currentProseMirror = editorElement.querySelector('.ProseMirror');
      if (!currentProseMirror) {
        draggedNodeRef.current = null;
        draggedPosRef.current = null;
        dropTargetRef.current = null;
        return;
      }

      // 優先使用儲存的目標，否則重新計算
      let blockNode: HTMLElement | null = null;
      let insertBefore: boolean;

      if (savedTarget && currentProseMirror.contains(savedTarget.blockNode)) {
        blockNode = savedTarget.blockNode;
        insertBefore = savedTarget.insertBefore;
      } else {
        // 備用方案：從滑鼠位置重新計算
        const target = e.target as HTMLElement;
        blockNode = findBlockNode(target, currentProseMirror);

        if (blockNode) {
          const rect = blockNode.getBoundingClientRect();
          const mouseY = e.clientY;
          const blockMiddle = rect.top + rect.height / 2;
          insertBefore = mouseY < blockMiddle;
        } else {
          draggedNodeRef.current = null;
          draggedPosRef.current = null;
          dropTargetRef.current = null;
          return;
        }
      }

      if (!blockNode) {
        draggedNodeRef.current = null;
        draggedPosRef.current = null;
        dropTargetRef.current = null;
        return;
      }

      // 檢查目標是否在被拖曳的範圍內（防止放到自己身上）
      if (blockNode.classList.contains('dragging')) {
        draggedNodeRef.current = null;
        draggedPosRef.current = null;
        dropTargetRef.current = null;
        return;
      }

      try {
        const { from: dragFrom, to: dragTo } = draggedPosRef.current;

        // 獲取目標節點的位置
        let targetPos: number;
        try {
          targetPos = editor.view.posAtDOM(blockNode, 0);
        } catch {
          console.warn('Could not get target position');
          draggedNodeRef.current = null;
          draggedPosRef.current = null;
          dropTargetRef.current = null;
          return;
        }

        const targetResolvedPos = editor.state.doc.resolve(targetPos);

        // 找到目標節點的邊界
        let targetNodeStart: number = -1;
        let targetNodeEnd: number = -1;
        try {
          targetNodeStart = targetResolvedPos.before(1);
          targetNodeEnd = targetResolvedPos.after(1);
        } catch {
          const depth = targetResolvedPos.depth;
          if (depth > 0) {
            targetNodeStart = targetResolvedPos.before(depth);
            targetNodeEnd = targetResolvedPos.after(depth);
          } else {
            draggedNodeRef.current = null;
            draggedPosRef.current = null;
            dropTargetRef.current = null;
            return;
          }
        }

        if (targetNodeStart < 0 || targetNodeEnd < 0) {
          draggedNodeRef.current = null;
          draggedPosRef.current = null;
          dropTargetRef.current = null;
          return;
        }

        // 計算插入位置
        const insertPos = insertBefore ? targetNodeStart : targetNodeEnd;

        // 檢查是否實際需要移動（插入位置在拖曳範圍內視為無效）
        if (insertPos >= dragFrom && insertPos <= dragTo) {
          draggedNodeRef.current = null;
          draggedPosRef.current = null;
          dropTargetRef.current = null;
          return;
        }

        // 獲取要移動的節點內容
        const nodeContent = editor.state.doc.slice(dragFrom, dragTo).content;

        // 使用單一 transaction 來確保原子操作
        const { tr } = editor.state;

        if (dragFrom < insertPos) {
          // 向下移動：目標位置在源位置之後
          tr.insert(insertPos, nodeContent);
          tr.delete(dragFrom, dragTo);
        } else {
          // 向上移動：目標位置在源位置之前
          tr.delete(dragFrom, dragTo);
          tr.insert(insertPos, nodeContent);
        }

        // 應用變更
        editor.view.dispatch(tr);

        // 設置游標到新位置
        setTimeout(() => {
          editor.commands.focus();
        }, 10);

      } catch (err) {
        console.warn('Drop failed:', err);
      } finally {
        draggedNodeRef.current = null;
        draggedPosRef.current = null;
        dropTargetRef.current = null;
      }
    };

    editorElement.addEventListener('mousemove', handleMouseMove);
    editorElement.addEventListener('mouseleave', handleMouseLeave as EventListener);
    editorElement.addEventListener('dragover', handleDragOver);
    editorElement.addEventListener('dragleave', handleDragLeave);
    editorElement.addEventListener('drop', handleDrop);

    return () => {
      editorElement.removeEventListener('mousemove', handleMouseMove);
      editorElement.removeEventListener('mouseleave', handleMouseLeave as EventListener);
      editorElement.removeEventListener('dragover', handleDragOver);
      editorElement.removeEventListener('dragleave', handleDragLeave);
      editorElement.removeEventListener('drop', handleDrop);
    };
  }, [editorRef, editor, showMenu, isDragging]);

  const handlePlusClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentNode || !editor) return;

    try {
      const pos = editor.view.posAtDOM(currentNode, 0);
      editor.chain().focus().setTextSelection(pos).run();
    } catch (err) {
      console.warn('Could not set selection:', err);
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 4,
      left: rect.left,
    });
    setShowMenu(true);
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!currentNode || !editor) return;

    setIsDragging(true);
    draggedNodeRef.current = currentNode;

    // 檢查是否有文字選擇（多行拖曳）
    const { selection } = editor.state;
    const hasSelection = !selection.empty;

    try {
      let from: number;
      let to: number;

      if (hasSelection) {
        // 多行模式：使用選擇範圍，但擴展到完整的區塊
        const $from = selection.$from;
        const $to = selection.$to;

        // 找到選擇範圍內所有頂層節點的邊界
        from = $from.start(1);
        to = $to.end(1);

        // 確保包含完整的節點
        const resolvedFrom = editor.state.doc.resolve(from);
        const resolvedTo = editor.state.doc.resolve(to);
        from = resolvedFrom.before(1);
        to = resolvedTo.after(1);
      } else {
        // 單行模式：只拖曳當前行
        const pos = editor.view.posAtDOM(currentNode, 0);
        const resolvedPos = editor.state.doc.resolve(pos);
        from = resolvedPos.before(1);
        to = resolvedPos.after(1);
      }

      draggedPosRef.current = { from, to };

      // 標記所有被拖曳的節點
      if (hasSelection) {
        editor.state.doc.nodesBetween(from, to, (node: any, pos: number) => {
          if (pos >= from && pos < to) {
            try {
              const dom = editor.view.nodeDOM(pos);
              if (dom instanceof HTMLElement && dom.parentElement?.classList.contains('ProseMirror')) {
                dom.classList.add('dragging');
              }
            } catch {
              // 忽略無法獲取 DOM 的節點
            }
          }
          return true;
        });
      } else {
        currentNode.classList.add('dragging');
      }

    } catch (err) {
      console.warn('Could not get node position:', err);
      draggedPosRef.current = null;
    }

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-block-drag', 'true');

    // 設置拖曳圖像
    const dragImage = document.createElement('div');
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-9999px';
    dragImage.style.opacity = '0.9';
    dragImage.style.background = '#f8fafc';
    dragImage.style.padding = '12px 16px';
    dragImage.style.borderRadius = '8px';
    dragImage.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    dragImage.style.border = '1px solid #e2e8f0';
    dragImage.style.fontSize = '14px';
    dragImage.style.color = '#475569';
    dragImage.style.maxWidth = '300px';
    dragImage.style.overflow = 'hidden';
    dragImage.style.textOverflow = 'ellipsis';
    dragImage.style.whiteSpace = 'nowrap';

    // 顯示拖曳內容的預覽文字
    const moveBlockLabel = labels.moveBlock ?? defaultLabels.moveBlock ?? '移動區塊';
    const textContent = hasSelection
      ? `${moveBlockLabel} ${editor.state.doc.textBetween(draggedPosRef.current!.from, draggedPosRef.current!.to, ' ').slice(0, 50)}...`
      : currentNode.textContent?.slice(0, 50) || moveBlockLabel;
    dragImage.textContent = textContent ?? moveBlockLabel;

    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 20, 20);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDropIndicator({ top: 0, show: false });

    // 移除所有 dragging class（支援多行拖）
    if (editorRef.current) {
      const proseMirror = editorRef.current.querySelector('.ProseMirror');
      if (proseMirror) {
        const draggingNodes = proseMirror.querySelectorAll('.dragging');
        draggingNodes.forEach(node => node.classList.remove('dragging'));
      }
    }

    draggedNodeRef.current = null;
    draggedPosRef.current = null;
    dropTargetRef.current = null;
  };

  if (!handlePosition) return null;

  return (
    <>
      <div
        className="block-handle-container absolute flex items-center gap-0.5"
        style={{
          top: handlePosition.top,
          left: 0,
        }}
      >
        <button
          type="button"
          onClick={handlePlusClick}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          title={labels.addBlock}
        >
          <Plus size={18} />
        </button>
        <div
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-grab active:cursor-grabbing"
          title={labels.dragBlock}
        >
          <GripVertical size={18} />
        </div>
      </div>

      {/* Drop Indicator 放置指示器 */}
      {dropIndicator.show && (
        <div
          className={`absolute left-0 right-0 h-0.5 ${accentColorClass} pointer-events-none z-50`}
          style={{ top: dropIndicator.top }}
        >
          <div className={`absolute -left-1 -top-1 w-2 h-2 rounded-full ${accentColorClass}`} />
        </div>
      )}

      {showMenu && menuPosition && (
        <BlockMenu
          editor={editor}
          position={menuPosition}
          onClose={() => setShowMenu(false)}
          labels={labels}
        />
      )}
    </>
  );
};

// ============ Main Component ============
export function TiptapEditor({
  content,
  onChange,
  placeholder = '輸入 / 開啟選單...',
  minHeight = '400px',
  className = '',
  accentColorClass = 'text-purple-400',
  showBlockHandle = true,
}: TiptapEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkEditorSelection, setLinkEditorSelection] = useState<{ from: number; to: number } | null>(null);

  // 斜線命令圖片插入的狀態
  const [slashMediaOpen, setSlashMediaOpen] = useState(false);
  const [slashPendingImage, setSlashPendingImage] = useState<any>(null);
  const [slashVariantModal, setSlashVariantModal] = useState(false);

  const openLinkEditor = useCallback((editorInstance: any) => {
    if (!editorInstance) return;
    const { from, to } = editorInstance.state.selection;
    if (from === to) return; // 沒有選取文字時不開啟
    setLinkEditorSelection({ from, to });
    setLinkEditorOpen(true);
  }, []);

  const closeLinkEditor = useCallback(() => {
    setLinkEditorOpen(false);
    setLinkEditorSelection(null);
  }, []);

  const slashCommandsExtension = useRef(
    createSlashCommandsExtension(() => setSlashMediaOpen(true))
  ).current;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }).extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockComponent);
        },
      }),
      BubbleMenuExtension,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-purple-600 underline cursor-pointer hover:text-purple-800 transition-colors',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-xl max-w-full h-auto border-4 border-transparent hover:border-purple-200 transition-all shadow-md my-8',
        },
      }).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            align: {
              default: 'center',
              renderHTML: attributes => {
                if (attributes.align === 'left') {
                  return { class: 'float-left mr-8 ml-0 mx-0' };
                }
                if (attributes.align === 'right') {
                  return { class: 'float-right ml-8 mr-0 mx-0' };
                }
                return { class: 'mx-auto block' };
              },
            },
          };
        },
      }),
      Placeholder.configure({
        placeholder: placeholder,
      }),
      slashCommandsExtension,
    ],
    content: content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `prose prose-purple max-w-none focus:outline-none text-slate-800 leading-normal`,
        style: `min-height: ${minHeight}`,
      },
      // 阻止編輯器的默認拖放行為（我們使用自定義拖放）
      handleDrop: (view, event) => {
        if (event.dataTransfer?.types.includes('application/x-block-drag')) {
          return true;
        }
        return false;
      },
      handleKeyDown: (view, event) => {
        // Ctrl+K / Cmd+K 開啟連結編輯器
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
          event.preventDefault();
          openLinkEditor(editor);
          return true;
        }

        // Ctrl+D / Cmd+D 複製區塊
        if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
          event.preventDefault();
          if (!editor) return true;
          const { state } = view;
          const { $from } = state.selection;
          // 找到游標所在的最頂層區塊節點
          const depth = $from.depth;
          const blockStart = $from.start(1);
          const blockEnd = $from.end(1);
          const blockNode = $from.node(1);
          if (blockNode) {
            const tr = state.tr;
            // 在當前區塊後面插入相同的節點
            tr.insert(blockEnd + 1, blockNode.copy(blockNode.content));
            view.dispatch(tr);
          }
          return true;
        }

        // Ctrl+Shift+K / Cmd+Shift+K 刪除區塊
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'K') {
          event.preventDefault();
          if (!editor) return true;
          const { state } = view;
          const { $from } = state.selection;
          const blockStart = $from.before(1);
          const blockEnd = $from.after(1);
          const tr = state.tr;
          tr.delete(blockStart, blockEnd);
          view.dispatch(tr);
          return true;
        }

        // Alt+↑ 向上移動區塊
        if (event.altKey && event.key === 'ArrowUp') {
          event.preventDefault();
          if (!editor) return true;
          const { state } = view;
          const { $from } = state.selection;
          const blockStart = $from.before(1);
          const blockEnd = $from.after(1);
          if (blockStart === 0) return true;
          const blockNode = $from.node(1);
          const $prevEnd = state.doc.resolve(blockStart - 1);
          const prevStart = $prevEnd.before(1);
          // 記住游標在區塊內的相對偏移
          const offsetInBlock = $from.pos - blockStart;
          const tr = state.tr;
          tr.delete(blockStart, blockEnd);
          tr.insert(prevStart, blockNode);
          // 游標跟著區塊走：新位置 = prevStart + 相對偏移
          const newPos = Math.min(prevStart + offsetInBlock, tr.doc.content.size);
          tr.setSelection(TextSelection.near(tr.doc.resolve(newPos)));
          view.dispatch(tr.scrollIntoView());
          return true;
        }

        // Alt+↓ 向下移動區塊
        if (event.altKey && event.key === 'ArrowDown') {
          event.preventDefault();
          if (!editor) return true;
          const { state } = view;
          const { $from } = state.selection;
          const blockStart = $from.before(1);
          const blockEnd = $from.after(1);
          if (blockEnd >= state.doc.content.size) return true;
          const blockNode = $from.node(1);
          const $nextStart = state.doc.resolve(blockEnd + 1);
          const nextEnd = $nextStart.after(1);
          const nextSize = nextEnd - blockEnd;
          // 記住游標在區塊內的相對偏移
          const offsetInBlock = $from.pos - blockStart;
          const tr = state.tr;
          // 先在下一個區塊之後插入複本，再刪除原來的
          tr.insert(nextEnd, blockNode);
          tr.delete(blockStart, blockEnd);
          // 游標跟著區塊走：新位置 = 原位置 + 下一個區塊的大小
          const newPos = Math.min(blockStart + nextSize + offsetInBlock, tr.doc.content.size);
          tr.setSelection(TextSelection.near(tr.doc.resolve(newPos)));
          view.dispatch(tr.scrollIntoView());
          return true;
        }

        return false;
      },
      handleDOMEvents: {
        dragover: (view, event) => {
          if (event.dataTransfer?.types.includes('application/x-block-drag')) {
            event.preventDefault();
            return true;
          }
          return false;
        },
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
    <div ref={editorContainerRef} className={`w-full bg-white relative ${showBlockHandle ? 'pl-14' : 'p-4'} ${className}`}>
      <EditorBubbleMenu editor={editor} accentColorClass={accentColorClass} onLinkEdit={() => openLinkEditor(editor)} />
      {linkEditorOpen && editor && (
        <LinkEditor
          editor={editor}
          onClose={closeLinkEditor}
          savedSelection={linkEditorSelection}
        />
      )}
      {showBlockHandle && (
        <BlockHandle
          editor={editor}
          editorRef={editorContainerRef}
          accentColorClass={accentColorClass.replace('text-', 'bg-')}
        />
      )}
      <EditorContent editor={editor} />
      <TiptapStyles />

      {/* 斜線命令的媒體庫 */}
      <MediaBrowser
        isOpen={slashMediaOpen}
        onClose={() => setSlashMediaOpen(false)}
        onSelect={(media: any) => {
          const imagePath = media.file_path || media.url || media.path;
          if (imagePath) {
            setSlashPendingImage(media);
            setSlashVariantModal(true);
          }
          setSlashMediaOpen(false);
        }}
      />

      {/* 斜線命令的圖片尺寸選擇 */}
      {slashVariantModal && slashPendingImage && editor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">選擇插入尺寸</h3>
              <button
                onClick={() => { setSlashVariantModal(false); setSlashPendingImage(null); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {[
                { label: '原始', variant: undefined },
                { label: 'Large', variant: 'large' },
                { label: 'Medium', variant: 'medium' },
                { label: 'Small', variant: 'small' },
                { label: 'Thumbnail', variant: 'thumbnail' },
              ].map(({ label, variant }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    const imagePath = slashPendingImage.file_path || slashPendingImage.url || slashPendingImage.path;
                    if (!variant) {
                      const fullUrl = getImageUrl(imagePath);
                      editor.chain().focus().setImage({ src: fullUrl }).run();
                    } else {
                      const isGcs = imagePath.includes('storage.googleapis.com');
                      let fullUrl = '';
                      if (isGcs) {
                        const lastSlashIndex = imagePath.lastIndexOf('/');
                        const baseUrl = imagePath.substring(0, lastSlashIndex + 1);
                        const filename = imagePath.substring(lastSlashIndex + 1);
                        const cleanFilename = filename.replace(/^(thumbnail|small|medium|large)_/, '');
                        const hasDot = cleanFilename.includes('.');
                        if (!hasDot) {
                          const extensionMatch = cleanFilename.match(/_(png|jpg|jpeg|webp|gif)$/i);
                          if (extensionMatch) {
                            fullUrl = `${baseUrl}${variant}_${cleanFilename}.${extensionMatch[1]}`;
                          } else {
                            fullUrl = `${baseUrl}${variant}_${cleanFilename}`;
                          }
                        } else {
                          fullUrl = `${baseUrl}${variant}_${cleanFilename}`;
                        }
                      } else {
                        fullUrl = getImageUrl(imagePath, variant);
                      }
                      editor.chain().focus().setImage({ src: fullUrl }).run();
                    }
                    setSlashVariantModal(false);
                    setSlashPendingImage(null);
                  }}
                  className="px-4 py-3 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-sm font-medium text-gray-700"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TiptapEditor;
