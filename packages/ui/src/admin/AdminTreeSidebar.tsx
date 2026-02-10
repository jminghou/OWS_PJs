'use client';

import React, { useState } from 'react';
import { AdminTreeSidebarItem, type ContextMenuAction } from './AdminTreeSidebarItem';

export interface TreeNode {
  id: number;
  name: string;
  children?: TreeNode[];
}

export interface AdminTreeSidebarProps<T extends TreeNode = TreeNode> {
  title: string;
  nodes: T[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  addActions?: Array<{ label: string; onClick: () => void }>;
  fixedItems?: Array<{
    id: number | null;
    label: string;
    icon: React.ReactNode;
  }>;
  contextMenuActions?: (node: T) => ContextMenuAction[];
}

export function AdminTreeSidebar<T extends TreeNode = TreeNode>({
  title,
  nodes,
  selectedId,
  onSelect,
  addActions,
  fixedItems,
  contextMenuActions,
}: AdminTreeSidebarProps<T>) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const handleToggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="w-full h-full flex-shrink-0 border-r bg-white flex flex-col">
      <div className="p-6 pb-2">
        <h1 className="text-xl font-bold text-gray-900 mb-6">{title}</h1>

        {/* Add New 區塊 */}
        {addActions && addActions.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Add New</p>
            {addActions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 transition-colors py-1"
              >
                <span className="text-lg leading-none">+</span> {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 導覽列表 */}
      <nav className="flex-1 overflow-y-auto">
        {/* 固定項目 */}
        {fixedItems?.map((item) => (
          <button
            key={String(item.id)}
            onClick={() => onSelect(item.id)}
            className={`w-full flex items-center gap-3 px-6 py-2.5 text-left transition-colors ${
              selectedId === item.id
                ? 'border-l-2 border-blue-500 bg-blue-50 text-blue-700'
                : 'border-l-2 border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {item.icon}
            <span className="text-sm">{item.label}</span>
          </button>
        ))}

        {/* 樹狀節點列表 */}
        {nodes.length > 0 && (
          <div className="mt-2">
            {nodes.map((node) => (
              <AdminTreeSidebarItem
                key={node.id}
                node={node}
                selectedId={selectedId}
                expandedIds={expandedIds}
                onSelect={onSelect}
                onToggleExpand={handleToggleExpand}
                contextMenuActions={contextMenuActions}
                depth={0}
              />
            ))}
          </div>
        )}
      </nav>
    </div>
  );
}
