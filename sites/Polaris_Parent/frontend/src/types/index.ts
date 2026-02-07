export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'editor' | 'user';
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  last_login?: string;
  content_count?: number;
}

export interface Category {
  id: number;
  code: string; // 內部代碼
  slugs: Record<string, string>; // 多語言別名對照表
  parent_id?: number;
  sort_order: number;
  
  // 兼容 Content API 回傳的簡化欄位 (已本地化)
  name?: string; 
  slug?: string;
}

export interface Tag {
  id: number;
  code: string; // 內部代碼
  slugs: Record<string, string>; // 多語言別名對照表
  
  // 兼容 Content API 回傳的簡化欄位 (已本地化)
  name?: string;
  slug?: string;
}

// 翻譯資訊
export interface TranslationInfo {
  language: string;
  id: number;
  slug: string;
}

// 根據規格書更新的Content類型，支援不同的內容類型
export interface Content {
  id: number;
  title: string;
  content?: string; // 普通文章內容
  summary?: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  // 支援後端的兩種欄位名稱（列表API返回post_type，詳細API返回content_type）
  post_type?: 'article' | 'page' | 'report' | 'analysis';
  content_type?: 'article' | 'page' | 'report' | 'analysis';
  category?: Category;
  author?: User;
  tags?: Tag[];
  featured_image?: string; // 16:9 精選圖片，用於文章內文
  cover_image?: string; // 1:1 封面圖片，用於列表封面
  meta_title?: string;
  meta_description?: string;
  views_count: number;
  likes_count: number;
  published_at?: string;
  created_at: string;
  updated_at: string;
  // i18n 欄位
  language?: string;
  original_id?: number;
  translations?: TranslationInfo[];
  available_languages?: string[];
}

export interface Comment {
  id: number;
  author_name: string;
  comment_text: string;
  created_at: string;
  replies?: Comment[];
}

export interface PaginationInfo {
  page: number;
  pages: number;
  per_page: number;
  total: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ContentListResponse {
  contents: Content[];
  pagination: PaginationInfo;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: User;
}

export interface ApiError {
  message: string;
  status?: number;
  errors?: Record<string, string | string[]>;
}

export interface CreateContentData {
  title: string;
  content_type?: 'article' | 'page' | 'report' | 'analysis';
  content?: string; // 普通文章
  summary?: string;
  slug?: string;
  status?: 'draft' | 'published';
  category_id?: number;
  featured_image?: string; // 16:9 精選圖片，用於文章內文
  cover_image?: string; // 1:1 封面圖片，用於列表封面
  meta_title?: string;
  meta_description?: string;
  tag_ids?: number[]; // 新增標籤ID陣列
  language?: string; // 文章語言
  original_id?: number | null; // 原文 ID（用於翻譯關聯）
  published_at?: string; // 預約發布時間
}

export interface UpdateContentData extends Partial<CreateContentData> {
  id: number;
}

// 首頁幻燈片類型
export interface HomepageSlide {
  id: string;
  image_url: string;
  alt_text: string;
  sort_order: number;
  subtitles: Record<string, string>; // {zh-TW: "文字A", en: "Text A", ...}
}

export interface HomepageSettings {
  slides: HomepageSlide[];
  button_text: Record<string, string>; // {zh-TW: "關於我們", en: "About Us", ...}
  about_section?: Record<string, {
    title: string;
    philosophy: string;
    quote: string;
    mission_points: string[];
  }>;
  updated_at: string;
}

// 環境變數類型
export interface AppConfig {
  apiUrl: string;
  siteName: string;
}

// 訂單類型
export interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  currency?: string;  // 新增：幣值
}

export interface Order {
  id: number;
  order_no: string;
  amount: number;
  currency: string;  // 新增：幣值
  language: string;  // 新增：語言
  payment_method?: string;  // 新增：支付方式
  status: 'pending' | 'paid' | 'failed';
  items: OrderItem[];
  created_at: string;
  paid_at?: string | null;
}

export interface OrderListResponse {
  orders: Order[];
  pagination: PaginationInfo;
}

export interface OrderCreateData {
  items: OrderItem[];
  amount: number;
  currency?: string;  // 新增：幣值
  language?: string;  // 新增：語言
  payment_method?: string;  // 新增：支付方式
}

export interface OrderCreateResponse {
  message: string;
  order_no: string;
  payment_url: string | null;
}

// 產品類型
export interface Product {
  id: number;
  product_id: string;
  name: string;
  description: string;
  short_description?: string;
  price: number;
  original_price?: number;
  stock_quantity: number;
  stock_status: 'in_stock' | 'out_of_stock' | 'pre_order';
  image?: string;
  category?: {
    id: number;
    code: string;
    slug: string;
  };
  tags: Array<{
    id: number;
    code: string;
    slug: string;
  }>;
  is_featured: boolean;
  sort_order: number;
  views_count: number;
  sales_count: number;
  detail_content_id?: number;
  has_detail?: boolean;
  detail_content?: {
    id: number;
    title: string;
    slug: string;
    content: string;
    summary?: string;
    featured_image?: string;
    cover_image?: string;
    language: string;
    published_at?: string;
  };
  // 多語言與多幣值欄位
  language?: string;
  currency?: string;
  currency_symbol?: string;
  available_languages?: string[];
  available_currencies?: string[];
}

export interface ProductAdmin {
  id: number;
  product_id: string;
  names: Record<string, string>;
  descriptions: Record<string, string>;
  short_descriptions: Record<string, string>;
  price: number;
  original_price?: number;
  stock_quantity: number;
  stock_status: string;
  featured_image_id?: number;
  featured_image?: {
    id: number;
    file_path: string;
  };
  gallery_images: number[];
  category_id?: number;
  tag_ids: number[];
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  meta_title?: string;
  meta_description?: string;
  views_count: number;
  sales_count: number;
  created_at: string;
  updated_at: string;
  detail_content_id?: number;
  detail_content?: {
    id: number;
    title: string;
    slug: string;
    status: string;
    language: string;
  };
  // 多語言欄位
  language?: string;
  original_id?: number;
}

export interface ProductListResponse {
  products: Product[];
  pagination: PaginationInfo;
}

export interface ProductAdminListResponse {
  products: ProductAdmin[];
  pagination: PaginationInfo;
}

export interface CreateProductData {
  product_id: string;
  names: Record<string, string>;
  descriptions?: Record<string, string>;
  short_descriptions?: Record<string, string>;
  price: number;
  original_price?: number;
  stock_quantity?: number;
  stock_status?: string;
  featured_image_id?: number;
  gallery_images?: number[];
  category_id?: number;
  tag_ids?: number[];
  is_active?: boolean;
  is_featured?: boolean;
  sort_order?: number;
  meta_title?: string;
  meta_description?: string;
  detail_content_id?: number;
}

// 產品價格管理類型
export interface ProductPrice {
  id: number;
  product_id: number;
  currency: string;
  price: number;
  original_price?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductPriceListResponse {
  prices: ProductPrice[];
}

export interface CreateProductPriceData {
  currency: string;
  price: number;
  original_price?: number;
  is_active?: boolean;
}

// 產品翻譯類型
export interface ProductTranslation {
  id: number;
  product_id: string;
  language: string;
  name: string;
  description: string;
  short_description?: string;
  original_id?: number;
  created_at: string;
  updated_at: string;
}

export interface ProductTranslationListResponse {
  translations: ProductTranslation[];
}

// 支付方式類型
export interface PaymentMethod {
  id: number;
  code: string;
  name: string;
  description?: string;
  supported_currencies: string[];
  is_active: boolean;
  config?: Record<string, any>;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethodListResponse {
  payment_methods: PaymentMethod[];
}
