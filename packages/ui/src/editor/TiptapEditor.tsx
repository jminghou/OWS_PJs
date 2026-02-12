"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
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
  GripVertical,
} from 'lucide-react';
import { useEffect, useCallback, useState, useRef } from 'react';

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

// --- 氣泡選單 (Bubble Menu) ---
const EditorBubbleMenu = ({
  editor,
  labels = defaultLabels,
  accentColorClass = 'text-purple-400'
}: {
  editor: any;
  labels?: EditorLabels;
  accentColorClass?: string;
}) => {
  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt(labels.enterLinkUrl || defaultLabels.enterLinkUrl, previousUrl);

    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor, labels]);

  if (!editor) return null;

  const items = [
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
      action: setLink,
      isActive: editor.isActive('link'),
    },
    {
      icon: <Code size={16} />,
      title: labels.code,
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const addImage = () => {
    const url = window.prompt(labels.enterImageUrl || defaultLabels.enterImageUrl);
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
    onClose();
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
      description: '插入圖片網址',
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
      BubbleMenuExtension,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-purple-600 underline cursor-pointer hover:text-purple-800 transition-colors',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-xl max-w-full h-auto mx-auto border-4 border-transparent hover:border-purple-200 transition-all shadow-md my-8',
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
      <EditorBubbleMenu editor={editor} accentColorClass={accentColorClass} />
      {showBlockHandle && (
        <BlockHandle
          editor={editor}
          editorRef={editorContainerRef}
          accentColorClass={accentColorClass.replace('text-', 'bg-')}
        />
      )}
      <EditorContent editor={editor} />
      <TiptapStyles />
    </div>
  );
}

export default TiptapEditor;
