-- =============================================================================
-- OWS Multi-Site Core Database Schema
-- PostgreSQL 14+ with JSONB support
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For full-text search optimization

-- =============================================================================
-- RBAC TABLES (New)
-- =============================================================================

-- Roles table
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name JSONB DEFAULT '{}',              -- Multi-language: {"zh-TW": "管理員", "en": "Administrator"}
    description JSONB DEFAULT '{}',
    is_system BOOLEAN DEFAULT FALSE,       -- System roles cannot be deleted
    is_active BOOLEAN DEFAULT TRUE,
    permissions_snapshot JSONB DEFAULT '[]', -- Denormalized for fast lookup
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_roles_code ON roles(code);
CREATE INDEX idx_roles_is_active ON roles(is_active);

-- Permissions table
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,    -- e.g., 'contents.create', 'products.delete'
    name JSONB DEFAULT '{}',
    description JSONB DEFAULT '{}',
    module VARCHAR(50) NOT NULL,          -- e.g., 'contents', 'products', 'users'
    action VARCHAR(50) NOT NULL,          -- e.g., 'create', 'read', 'update', 'delete'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_permissions_code ON permissions(code);
CREATE INDEX idx_permissions_module ON permissions(module);

-- Role-Permission association table
CREATE TABLE role_permissions (
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER,
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Users table (enhanced with JSONB attributes)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',       -- Legacy field for backward compatibility
    is_active BOOLEAN DEFAULT TRUE,
    avatar VARCHAR(500),                   -- Profile image path (supports GCS long URLs)
    attributes JSONB DEFAULT '{}',         -- Extensible attributes
    meta_data JSONB DEFAULT '{}',          -- Site-specific metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_attributes ON users USING GIN(attributes jsonb_path_ops);

-- User-Role association table
CREATE TABLE user_roles (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER,
    expires_at TIMESTAMP,                  -- Optional expiration for temporary roles
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- Categories table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    slugs JSONB DEFAULT '{}',              -- {"zh-TW": "政治", "en-US": "politics"}
    parent_id INTEGER REFERENCES categories(id),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    attributes JSONB DEFAULT '{}',         -- Extensible attributes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_code ON categories(code);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_is_active ON categories(is_active);

-- Tags table
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    slugs JSONB DEFAULT '{}',
    attributes JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tags_code ON tags(code);

-- Contents table (enhanced)
CREATE TABLE contents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    summary TEXT,
    slug VARCHAR(200) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    content_type VARCHAR(50) DEFAULT 'article',
    category_id INTEGER REFERENCES categories(id),
    author_id INTEGER REFERENCES users(id),
    featured_image VARCHAR(500),           -- Supports GCS long URLs
    cover_image VARCHAR(500),
    meta_title VARCHAR(200),
    meta_description TEXT,
    views_count INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- i18n fields
    language VARCHAR(10) DEFAULT 'zh-TW' NOT NULL,
    original_id INTEGER REFERENCES contents(id),
    -- JSONB extension
    attributes JSONB DEFAULT '{}',         -- Custom fields per site
    meta_data JSONB DEFAULT '{}'           -- SEO, schema.org data, etc.
);

CREATE INDEX idx_contents_slug ON contents(slug);
CREATE INDEX idx_contents_status ON contents(status);
CREATE INDEX idx_contents_content_type ON contents(content_type);
CREATE INDEX idx_contents_category_id ON contents(category_id);
CREATE INDEX idx_contents_author_id ON contents(author_id);
CREATE INDEX idx_contents_published_at ON contents(published_at);
CREATE INDEX idx_contents_language ON contents(language);
CREATE INDEX idx_contents_attributes ON contents USING GIN(attributes jsonb_path_ops);

-- Content-Tag association
CREATE TABLE content_tags (
    content_id INTEGER NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (content_id, tag_id)
);

-- Comments table
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    content_id INTEGER NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    author_name VARCHAR(100),
    author_email VARCHAR(100),
    comment_text TEXT NOT NULL,
    parent_id INTEGER REFERENCES comments(id),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_comments_content_id ON comments(content_id);
CREATE INDEX idx_comments_status ON comments(status);

-- =============================================================================
-- MEDIA TABLES
-- =============================================================================

-- Media Folders
CREATE TABLE media_folders (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_id INTEGER REFERENCES media_folders(id),
    path VARCHAR(500) NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Media files
CREATE TABLE media (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,       -- Supports GCS long URLs
    file_size INTEGER,
    mime_type VARCHAR(100),
    alt_text VARCHAR(255),
    caption TEXT,
    folder_id INTEGER REFERENCES media_folders(id),
    uploaded_by INTEGER REFERENCES users(id),
    attributes JSONB DEFAULT '{}',         -- metadata like dimensions, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_media_folder_id ON media(folder_id);
CREATE INDEX idx_media_uploaded_by ON media(uploaded_by);

-- Content-Media association
CREATE TABLE content_media (
    content_id INTEGER NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    PRIMARY KEY (content_id, media_id)
);

-- =============================================================================
-- MENU TABLES
-- =============================================================================

CREATE TABLE menus (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE menu_items (
    id SERIAL PRIMARY KEY,
    menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    url VARCHAR(500),
    content_id INTEGER REFERENCES contents(id),
    parent_id INTEGER REFERENCES menu_items(id),
    sort_order INTEGER DEFAULT 0,
    css_class VARCHAR(100),
    target VARCHAR(20) DEFAULT '_self',
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_menu_items_menu_id ON menu_items(menu_id);

-- =============================================================================
-- SETTINGS TABLES
-- =============================================================================

CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    data_type VARCHAR(20) DEFAULT 'string',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_settings_key ON settings(key);

-- Homepage slides
CREATE TABLE homepage_slides (
    id SERIAL PRIMARY KEY,
    slide_id VARCHAR(100) UNIQUE NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(200),
    sort_order INTEGER DEFAULT 0 NOT NULL,
    subtitles JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Homepage settings
CREATE TABLE homepage_settings (
    id SERIAL PRIMARY KEY,
    button_text JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- ACTIVITY LOGS
-- =============================================================================

CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX idx_activity_logs_table_name ON activity_logs(table_name);

-- =============================================================================
-- SUBMISSIONS (Site-specific, can be extended)
-- =============================================================================

CREATE TABLE submissions (
    id SERIAL PRIMARY KEY,
    submission_type VARCHAR(50) DEFAULT 'general',  -- for multi-purpose
    character_name VARCHAR(100),
    birth_year VARCHAR(4),
    birth_month VARCHAR(2),
    birth_day VARCHAR(2),
    birth_time VARCHAR(50),
    birth_place VARCHAR(100),
    question TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    admin_notes TEXT,
    ip_address VARCHAR(45),
    attributes JSONB DEFAULT '{}',         -- extensible fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_created_at ON submissions(created_at);
CREATE INDEX idx_submissions_type ON submissions(submission_type);

-- =============================================================================
-- E-COMMERCE TABLES
-- =============================================================================

-- Products table (enhanced)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(100) NOT NULL,
    names JSONB DEFAULT '{}',
    descriptions JSONB DEFAULT '{}',
    short_descriptions JSONB DEFAULT '{}',
    price INTEGER NOT NULL,
    original_price INTEGER,
    stock_quantity INTEGER DEFAULT -1,
    stock_status VARCHAR(20) DEFAULT 'in_stock',
    featured_image_id INTEGER REFERENCES media(id),
    gallery_images JSONB DEFAULT '[]',
    category_id INTEGER REFERENCES categories(id),
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    meta_title VARCHAR(200),
    meta_description TEXT,
    views_count INTEGER DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    detail_content_id INTEGER REFERENCES contents(id) ON DELETE SET NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'zh-TW',
    original_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    -- JSONB extension
    attributes JSONB DEFAULT '{}',
    meta_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_product_id_language UNIQUE(product_id, language)
);

CREATE INDEX idx_products_product_id ON products(product_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_language ON products(language);
CREATE INDEX idx_products_attributes ON products USING GIN(attributes jsonb_path_ops);

-- Product-Tag association
CREATE TABLE product_tags (
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, tag_id)
);

-- Product prices (multi-currency)
CREATE TABLE product_prices (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL,
    price INTEGER NOT NULL,
    original_price INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_product_currency UNIQUE(product_id, currency)
);

CREATE INDEX idx_product_prices_product_id ON product_prices(product_id);
CREATE INDEX idx_product_prices_currency ON product_prices(currency);

-- Orders
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_no VARCHAR(50) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    items JSONB DEFAULT '[]',
    language VARCHAR(10) NOT NULL DEFAULT 'zh-TW',
    currency VARCHAR(10) NOT NULL DEFAULT 'TWD',
    payment_method VARCHAR(50),
    attributes JSONB DEFAULT '{}',         -- extensible
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
);

CREATE INDEX idx_orders_order_no ON orders(order_no);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_currency ON orders(currency);

-- Payment methods configuration
CREATE TABLE payment_methods (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name JSONB NOT NULL,
    description JSONB,
    supported_currencies JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_methods_code ON payment_methods(code);
CREATE INDEX idx_payment_methods_is_active ON payment_methods(is_active);

-- =============================================================================
-- ALEMBIC VERSION TRACKING
-- =============================================================================

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- =============================================================================
-- INITIAL DATA SEEDING
-- =============================================================================

-- Insert default roles
INSERT INTO roles (code, name, description, is_system) VALUES
('admin', '{"zh-TW": "管理員", "en": "Administrator"}', '{"zh-TW": "系統管理員，擁有所有權限", "en": "System administrator with full access"}', TRUE),
('editor', '{"zh-TW": "編輯", "en": "Editor"}', '{"zh-TW": "內容編輯者", "en": "Content editor"}', TRUE),
('user', '{"zh-TW": "用戶", "en": "User"}', '{"zh-TW": "一般用戶", "en": "Regular user"}', TRUE);

-- Insert default permissions
INSERT INTO permissions (code, name, module, action) VALUES
-- Contents
('contents.create', '{"zh-TW": "建立內容", "en": "Create Content"}', 'contents', 'create'),
('contents.read', '{"zh-TW": "閱讀內容", "en": "Read Content"}', 'contents', 'read'),
('contents.update', '{"zh-TW": "更新內容", "en": "Update Content"}', 'contents', 'update'),
('contents.delete', '{"zh-TW": "刪除內容", "en": "Delete Content"}', 'contents', 'delete'),
('contents.publish', '{"zh-TW": "發布內容", "en": "Publish Content"}', 'contents', 'publish'),
-- Products
('products.create', '{"zh-TW": "建立產品", "en": "Create Product"}', 'products', 'create'),
('products.read', '{"zh-TW": "閱讀產品", "en": "Read Product"}', 'products', 'read'),
('products.update', '{"zh-TW": "更新產品", "en": "Update Product"}', 'products', 'update'),
('products.delete', '{"zh-TW": "刪除產品", "en": "Delete Product"}', 'products', 'delete'),
-- Users
('users.create', '{"zh-TW": "建立用戶", "en": "Create User"}', 'users', 'create'),
('users.read', '{"zh-TW": "閱讀用戶", "en": "Read User"}', 'users', 'read'),
('users.update', '{"zh-TW": "更新用戶", "en": "Update User"}', 'users', 'update'),
('users.delete', '{"zh-TW": "刪除用戶", "en": "Delete User"}', 'users', 'delete'),
-- Media
('media.upload', '{"zh-TW": "上傳媒體", "en": "Upload Media"}', 'media', 'upload'),
('media.delete', '{"zh-TW": "刪除媒體", "en": "Delete Media"}', 'media', 'delete'),
-- Settings
('settings.read', '{"zh-TW": "閱讀設定", "en": "Read Settings"}', 'settings', 'read'),
('settings.update', '{"zh-TW": "更新設定", "en": "Update Settings"}', 'settings', 'update'),
-- Orders
('orders.read', '{"zh-TW": "閱讀訂單", "en": "Read Orders"}', 'orders', 'read'),
('orders.update', '{"zh-TW": "更新訂單", "en": "Update Orders"}', 'orders', 'update');

-- Assign all permissions to admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    (SELECT id FROM roles WHERE code = 'admin'),
    id
FROM permissions;

-- Assign content permissions to editor role
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    (SELECT id FROM roles WHERE code = 'editor'),
    id
FROM permissions
WHERE module IN ('contents', 'media') OR code = 'products.read';

-- =============================================================================
-- TRIGGER FUNCTIONS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contents_updated_at BEFORE UPDATE ON contents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_prices_updated_at BEFORE UPDATE ON product_prices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_homepage_slides_updated_at BEFORE UPDATE ON homepage_slides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_homepage_settings_updated_at BEFORE UPDATE ON homepage_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- COMMENTS
-- =============================================================================
-- Total Tables: 26
-- RBAC Tables: roles, permissions, role_permissions, user_roles (4)
-- Core Tables: users, categories, tags, contents, content_tags, comments (6)
-- Media Tables: media_folders, media, content_media (3)
-- Menu Tables: menus, menu_items (2)
-- Settings Tables: settings, homepage_slides, homepage_settings (3)
-- E-commerce Tables: products, product_tags, product_prices, orders, payment_methods (5)
-- Other Tables: activity_logs, submissions, alembic_version (3)
-- =============================================================================
