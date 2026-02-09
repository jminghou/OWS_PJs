/**
 * Media Library Types
 *
 * 媒體庫的型別定義，對應後端 packages/media_lib 的 API 回傳格式。
 */

// =============================================================================
// Types
// =============================================================================

export interface ImageFormat {
  url: string;
  width: number;
  height: number;
}

export interface ImageFormats {
  thumbnail?: ImageFormat;
  small?: ImageFormat;
  medium?: ImageFormat;
  large?: ImageFormat;
}

export interface FileMetadata {
  chart_id?: string;   // 命盤ID
  location?: string;   // 地點
  rating?: number;     // 評級 1-5
  status?: string;     // 狀態: draft/published/archived
  source?: string;     // 來源
  license?: string;    // 授權
  notes?: string;      // 備註
}

export interface MediaItem {
  id: number;
  filename: string;
  original_filename: string;
  file_path: string;  // public_url
  file_size: number;  // bytes
  mime_type: string;
  alt_text?: string;
  caption?: string;
  folder_id?: number;
  created_at: string;
  formats?: ImageFormats;
  width?: number;
  height?: number;
  tags?: { id: number; name: string; slug: string; color: string }[];
  metadata?: FileMetadata;
}

export interface MediaFolder {
  id: number;
  name: string;
  parent_id?: number;
  path: string;
  file_count: number;
  created_at: string;
  description?: string;
  thumbnail_id?: number;
  thumbnail?: { id: number; url: string; formats?: ImageFormats };
  children?: MediaFolder[];  // 前端建構樹狀結構用
}

export interface MediaTag {
  id: number;
  name: string;
  slug: string;
  color: string;
}
