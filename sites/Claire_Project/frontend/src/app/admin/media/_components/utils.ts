import type { MediaItem, MediaFolder } from '@/lib/api/strapi';

// =============================================================================
// Helper Functions
// =============================================================================

export const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/** 取得 small 變體 URL（相片列表用） */
export const getSmallUrl = (item: MediaItem): string => {
  if (item.formats?.small?.url) return item.formats.small.url;
  if (item.formats?.thumbnail?.url) return item.formats.thumbnail.url;
  return item.file_path;
};

// =============================================================================
// Folder Tree Helpers
// =============================================================================

export function buildFolderTree(folders: MediaFolder[]): MediaFolder[] {
  const map = new Map<number, MediaFolder>();
  const roots: MediaFolder[] = [];
  for (const f of folders) {
    map.set(f.id, { ...f, children: [] });
  }
  for (const f of folders) {
    const node = map.get(f.id)!;
    if (f.parent_id && map.has(f.parent_id)) {
      map.get(f.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export function flattenFolderTree(tree: MediaFolder[], depth = 0): { folder: MediaFolder; depth: number }[] {
  const result: { folder: MediaFolder; depth: number }[] = [];
  for (const node of tree) {
    result.push({ folder: node, depth });
    if (node.children && node.children.length > 0) {
      result.push(...flattenFolderTree(node.children, depth + 1));
    }
  }
  return result;
}
