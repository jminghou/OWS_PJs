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
}

export interface MediaFolder {
  id: number;
  name: string;
  parent_id?: number;
  path: string;
  file_count: number;
  created_at: string;
}

export interface MediaTag {
  id: number;
  name: string;
  slug: string;
  color: string;
}
