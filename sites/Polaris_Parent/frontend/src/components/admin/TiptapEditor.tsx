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

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
}

// --- 子組件：氣泡選單 (Bubble Menu) - 選取文字時出現 ---
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

// --- 子組件：區塊選單 (Block Menu) - 點擊 + 號時出現 ---
interface BlockMenuProps {
  editor: any;
  position: { top: number; left: number };
  onClose: () => void;
}

const BlockMenu = ({ editor, position, onClose }: BlockMenuProps) => {
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
    const url = window.prompt('輸入圖片網址:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
    onClose();
  };

  const menuItems = [
    {
      icon: <Type size={18} />,
      title: '文字',
      description: '一般段落文字',
      action: () => { editor.chain().focus().setParagraph().run(); onClose(); },
    },
    {
      icon: <Heading1 size={18} />,
      title: '標題 1',
      description: '大標題',
      action: () => { editor.chain().focus().toggleHeading({ level: 1 }).run(); onClose(); },
    },
    {
      icon: <Heading2 size={18} />,
      title: '標題 2',
      description: '中標題',
      action: () => { editor.chain().focus().toggleHeading({ level: 2 }).run(); onClose(); },
    },
    {
      icon: <Heading3 size={18} />,
      title: '標題 3',
      description: '小標題',
      action: () => { editor.chain().focus().toggleHeading({ level: 3 }).run(); onClose(); },
    },
    {
      icon: <List size={18} />,
      title: '項目清單',
      description: '建立項目符號清單',
      action: () => { editor.chain().focus().toggleBulletList().run(); onClose(); },
    },
    {
      icon: <ListOrdered size={18} />,
      title: '編號清單',
      description: '建立編號清單',
      action: () => { editor.chain().focus().toggleOrderedList().run(); onClose(); },
    },
    {
      icon: <Quote size={18} />,
      title: '引用',
      description: '插入引用區塊',
      action: () => { editor.chain().focus().toggleBlockquote().run(); onClose(); },
    },
    {
      icon: <Terminal size={18} />,
      title: '程式碼區塊',
      description: '插入程式碼',
      action: () => { editor.chain().focus().toggleCodeBlock().run(); onClose(); },
    },
    {
      icon: <ImageIcon size={18} />,
      title: '圖片',
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
      <div className="px-3 py-2 text-xs font-medium text-gray-400 uppercase">基本區塊</div>
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

// --- 子組件：區塊把手 (Block Handle) - hover 時在行首顯示 + 拖放功能 ---
interface BlockHandleProps {
  editor: any;
  editorRef: React.RefObject<HTMLDivElement | null>;
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

const BlockHandle = ({ editor, editorRef }: BlockHandleProps) => {
  const [handlePosition, setHandlePosition] = useState<{ top: number } | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [currentNode, setCurrentNode] = useState<HTMLElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<{ top: number; show: boolean }>({ top: 0, show: false });
  const draggedNodeRef = useRef<HTMLElement | null>(null);
  const draggedPosRef = useRef<{ from: number; to: number } | null>(null);

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
        const indicatorTop = insertBefore
          ? rect.top - editorRect.top - 1
          : rect.bottom - editorRect.top - 1;

        setDropIndicator({ top: indicatorTop, show: true });
      } else {
        // 如果找不到有效的區塊或正在拖曳的區塊上方，隱藏指示器
        setDropIndicator({ top: 0, show: false });
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      // 只有真正離開編輯區時才隱藏指示器
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (!editorElement.contains(relatedTarget)) {
        setDropIndicator({ top: 0, show: false });
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDropIndicator({ top: 0, show: false });

      if (!draggedNodeRef.current || !draggedPosRef.current || !editor) {
        draggedNodeRef.current = null;
        draggedPosRef.current = null;
        return;
      }

      // 重新獲取 proseMirror 確保是最新的
      const currentProseMirror = editorElement.querySelector('.ProseMirror');
      if (!currentProseMirror) {
        draggedNodeRef.current = null;
        draggedPosRef.current = null;
        return;
      }

      const target = e.target as HTMLElement;
      const blockNode = findBlockNode(target, currentProseMirror);

      if (!blockNode) {
        draggedNodeRef.current = null;
        draggedPosRef.current = null;
        return;
      }

      // 檢查目標是否在被拖曳的範圍內（防止放到自己身上）
      if (blockNode.classList.contains('dragging')) {
        draggedNodeRef.current = null;
        draggedPosRef.current = null;
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
          return;
        }

        const targetResolvedPos = editor.state.doc.resolve(targetPos);

        // 找到目標節點的邊界
        let targetNodeStart: number;
        let targetNodeEnd: number;
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
            return;
          }
        }

        // 決定插入到上方還是下方
        const rect = blockNode.getBoundingClientRect();
        const mouseY = e.clientY;
        const blockMiddle = rect.top + rect.height / 2;
        const insertBefore = mouseY < blockMiddle;

        // 計算插入位置
        const insertPos = insertBefore ? targetNodeStart : targetNodeEnd;

        // 檢查是否實際需要移動
        if (insertPos === dragFrom || insertPos === dragTo) {
          draggedNodeRef.current = null;
          draggedPosRef.current = null;
          return;
        }

        // 獲取要移動的節點內容
        const nodeContent = editor.state.doc.slice(dragFrom, dragTo).content;
        const nodeSize = dragTo - dragFrom;

        // 使用單一 transaction 來確保原子操作
        const { tr } = editor.state;

        if (dragFrom < insertPos) {
          // 向下移動：目標位置在源位置之後
          // 先插入（位置不變），再刪除（會影響文檔，但插入已完成）
          tr.insert(insertPos, nodeContent);
          tr.delete(dragFrom, dragTo);
        } else {
          // 向上移動：目標位置在源位置之前
          // 先刪除會改變後續位置，所以先計算
          tr.delete(dragFrom, dragTo);
          // 刪除後，如果 insertPos 在 dragFrom 之後，需要調整
          // 但因為 insertPos < dragFrom，所以不需要調整
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
        from = $from.start(1); // 第一個節點的開始
        to = $to.end(1); // 最後一個節點的結束

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
        // 遍歷選擇範圍內的所有頂層節點並添加 dragging class
        editor.state.doc.nodesBetween(from, to, (node, pos) => {
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
    const textContent = hasSelection
      ? `移動 ${editor.state.doc.textBetween(draggedPosRef.current!.from, draggedPosRef.current!.to, ' ').slice(0, 50)}...`
      : currentNode.textContent?.slice(0, 50) || '移動區塊';
    dragImage.textContent = textContent;

    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 20, 20);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDropIndicator({ top: 0, show: false });

    // 移除所有 dragging class（支援多行拖曳）
    if (editorRef.current) {
      const proseMirror = editorRef.current.querySelector('.ProseMirror');
      if (proseMirror) {
        const draggingNodes = proseMirror.querySelectorAll('.dragging');
        draggingNodes.forEach(node => node.classList.remove('dragging'));
      }
    }

    draggedNodeRef.current = null;
    draggedPosRef.current = null;
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
          title="點擊新增區塊"
        >
          <Plus size={18} />
        </button>
        <div
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-grab active:cursor-grabbing"
          title="拖曳移動區塊"
        >
          <GripVertical size={18} />
        </div>
      </div>

      {/* Drop Indicator 放置指示器 */}
      {dropIndicator.show && (
        <div
          className="absolute left-0 right-0 h-0.5 bg-brand-purple-500 pointer-events-none z-50"
          style={{ top: dropIndicator.top }}
        >
          <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-brand-purple-500" />
        </div>
      )}

      {showMenu && menuPosition && (
        <BlockMenu
          editor={editor}
          position={menuPosition}
          onClose={() => setShowMenu(false)}
        />
      )}
    </>
  );
};

export default function TiptapEditor({ content, onChange }: TiptapEditorProps) {
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
          class: 'text-brand-purple-600 underline cursor-pointer hover:text-brand-purple-800 transition-colors',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-xl max-w-full h-auto mx-auto border-4 border-transparent hover:border-brand-purple-200 transition-all shadow-md my-8',
        },
      }),
      Placeholder.configure({
        placeholder: '輸入 / 開啟選單...',
      }),
    ],
    content: content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-purple max-w-none focus:outline-none min-h-[400px] text-slate-800 leading-normal',
      },
      // 阻止編輯器的默認拖放行為（我們使用自定義拖放）
      handleDrop: (view, event) => {
        if (event.dataTransfer?.types.includes('application/x-block-drag')) {
          // 返回 true 表示我們已處理，阻止 ProseMirror 默認行為
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
    <div ref={editorContainerRef} className="w-full bg-white relative pl-14">
      <EditorBubbleMenu editor={editor} />
      <BlockHandle editor={editor} editorRef={editorContainerRef} />
      <EditorContent editor={editor} />

      <style jsx global>{`
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
      `}</style>
    </div>
  );
}
