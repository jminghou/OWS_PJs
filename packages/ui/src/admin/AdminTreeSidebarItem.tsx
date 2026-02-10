'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { TreeNode } from './AdminTreeSidebar';

export interface ContextMenuAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
}

export interface AdminTreeSidebarItemProps<T extends TreeNode> {
  node: T;
  selectedId: number | null;
  expandedIds: Set<number>;
  onSelect: (id: number) => void;
  onToggleExpand: (id: number) => void;
  contextMenuActions?: (node: T) => ContextMenuAction[];
  depth: number;
}

export function AdminTreeSidebarItem<T extends TreeNode>({
  node,
  selectedId,
  expandedIds,
  onSelect,
  onToggleExpand,
  contextMenuActions,
  depth,
}: AdminTreeSidebarItemProps<T>) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!contextMenuActions) return;
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  const actions = contextMenuActions ? contextMenuActions(node) : [];

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2 cursor-pointer transition-colors ${
          isSelected
            ? 'border-l-2 border-blue-500 bg-blue-50 text-blue-700'
            : 'border-l-2 border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`}
        style={{ paddingLeft: `${16 + depth * 20}px`, paddingRight: '12px' }}
        onClick={() => onSelect(node.id)}
        onContextMenu={handleContextMenu}
      >
        {/* 展開/收合箭頭 */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id); }}
            className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="currentColor" viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* 文件圖示 */}
        <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <span className="flex-1 truncate text-sm">{node.name}</span>
      </div>

      {/* 右鍵選單 */}
      {showMenu && actions.length > 0 && (
        <div
          ref={menuRef}
          className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-[100] min-w-[140px]"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          {actions.map((action, index) => (
            <React.Fragment key={index}>
              {index > 0 && action.variant === 'destructive' && (
                <div className="border-t border-gray-100 my-1" />
              )}
              <button
                className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                  action.variant === 'destructive'
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => { setShowMenu(false); action.onClick(); }}
              >
                {action.icon}
                {action.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* 子層遞迴渲染 */}
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <AdminTreeSidebarItem
              key={child.id}
              node={child as T}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              contextMenuActions={contextMenuActions}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
