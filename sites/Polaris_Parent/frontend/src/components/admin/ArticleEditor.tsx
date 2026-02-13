'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MoreVertical, Star, ChevronDown, Code, FileText } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import Button from '@/components/ui/Button';
import Popover from '@/components/ui/Popover';
import TiptapEditor from '@/components/admin/TiptapEditor';
import NotionTitleInput from '@/components/admin/NotionTitleInput';
import ArticleSettingsPanel from '@/components/admin/ArticleSettingsPanel';
import InlineImageSettings from '@/components/admin/InlineImageSettings';
import LanguageSelector from '@/components/admin/LanguageSelector';
import { Category, TranslationInfo } from '@/types';

interface I18nSettings {
  enabled: boolean;
  default_language: string;
  languages: string[];
  language_names: Record<string, string>;
}

export interface ArticleFormData {
  title: string;
  content: string;
  summary: string;
  slug: string;
  status: 'draft' | 'published';
  content_type: 'article';
  category_id: string;
  featured_image: string;
  cover_image: string;
  meta_title: string;
  meta_description: string;
  language: string;
  published_at: string;
}

interface ArticleEditorProps {
  mode: 'create' | 'edit';
  formData: ArticleFormData;
  setFormData: React.Dispatch<React.SetStateAction<ArticleFormData>>;
  categories: Category[];
  tagInput: string;
  setTagInput: (value: string) => void;
  parseTagInput: (input: string) => string[];
  i18nSettings: I18nSettings | null;
  isFeatured: boolean;
  setIsFeatured: (value: boolean) => void;
  loading: boolean;
  onSave: (status?: 'draft' | 'published') => Promise<void>;
  // For edit mode
  articleId?: number;
  translations?: TranslationInfo[];
  onRefresh?: () => void;
  // When embedded in two-column layout, skip AdminLayout wrapper and back button
  embedded?: boolean;
}

export default function ArticleEditor({
  mode,
  formData,
  setFormData,
  categories,
  tagInput,
  setTagInput,
  parseTagInput,
  i18nSettings,
  isFeatured,
  setIsFeatured,
  loading,
  onSave,
  articleId,
  translations,
  onRefresh,
  embedded = false
}: ArticleEditorProps) {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [publishMenuOpen, setPublishMenuOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'article' | 'html'>('article');

  // 計算字數（標題 + 內容）
  const wordCount = useMemo(() => {
    const titleLength = formData.title.length;
    const contentText = formData.content.replace(/<[^>]*>/g, '');
    const contentLength = contentText.length;
    return titleLength + contentLength;
  }, [formData.title, formData.content]);

  const handleTitleChange = (title: string) => {
    setFormData(prev => {
      const newData = { ...prev, title };
      // Only auto-generate slug and meta_title if they are empty or we are in create mode
      if (mode === 'create' || !prev.slug) {
        newData.slug = title
          .toLowerCase()
          .replace(/[\u4e00-\u9fff]/g, (match) => encodeURIComponent(match))
          .replace(/[^\w\-]/g, '-')
          .replace(/--+/g, '-')
          .replace(/^-|-$/g, '');
      }
      if (mode === 'create' || !prev.meta_title) {
        newData.meta_title = title;
      }
      return newData;
    });
  };

  const handleSaveDraft = async () => {
    setPublishMenuOpen(false);
    await onSave('draft');
  };

  const handlePublish = async () => {
    setPublishMenuOpen(false);
    await onSave('published');
  };

  const editorContent = (
      <div className="h-full flex flex-col bg-white">
        {/* 頂部工具列 */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          {/* 左側：返回按鈕（embedded 模式隱藏） */}
          {!embedded ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={18} className="mr-1" />
              返回
            </Button>
          ) : (
            <div />
          )}

          {/* 右側：字數統計 + Publish 按鈕 + 星星 + 三點選單 */}
          <div className="flex items-center gap-2">
            {/* 字數統計 */}
            <span className="text-sm text-gray-400 mr-2">
              {wordCount.toLocaleString()}
            </span>

            {/* 多語言切換按鈕 */}
            {i18nSettings?.enabled && (
              <LanguageSelector
                mode={mode}
                currentLanguage={formData.language}
                articleId={articleId}
                translations={translations}
                i18nSettings={i18nSettings}
                onLanguageChange={(lang) => setFormData(prev => ({ ...prev, language: lang }))}
                onRefresh={onRefresh}
                formData={formData}
              />
            )}

            {/* HTML/Article 模式切換按鈕 */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditorMode(editorMode === 'article' ? 'html' : 'article')}
              className="flex items-center gap-1 px-2.5 py-1 text-xs h-7"
              title={editorMode === 'article' ? '切換至 HTML 編輯模式' : '切換至文章編輯模式'}
            >
              {editorMode === 'article' ? (
                <>
                  <Code size={14} />
                  HTML
                </>
              ) : (
                <>
                  <FileText size={14} />
                  Article
                </>
              )}
            </Button>

            {/* Publish 按鈕 */}
            <Popover
              open={publishMenuOpen}
              onOpenChange={setPublishMenuOpen}
              placement="bottom-end"
              trigger={
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="flex items-center gap-1 px-2.5 py-1 text-xs h-7"
                >
                  Publish
                  <ChevronDown size={14} />
                </Button>
              }
              content={
                <div className="w-48 py-1">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={loading}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-between"
                  >
                    <span>儲存草稿</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={loading}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-between"
                  >
                    <span>立即發佈</span>
                  </button>
                </div>
              }
            />

            {/* 星星 Icon（首頁文章） */}
            <button
              type="button"
              onClick={() => setIsFeatured(!isFeatured)}
              className={`p-2 rounded-md transition-colors ${
                isFeatured
                  ? 'text-yellow-500 hover:text-yellow-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title={isFeatured ? '取消首頁推薦' : '設為首頁推薦'}
            >
              <Star size={20} fill={isFeatured ? 'currentColor' : 'none'} />
            </button>

            {/* 三點選單 */}
            <Popover
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              placement="bottom-end"
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  className="text-gray-600 hover:text-gray-900 p-2"
                >
                  <MoreVertical size={20} />
                </Button>
              }
              content={
                <ArticleSettingsPanel
                  formData={formData}
                  setFormData={setFormData}
                  categories={categories}
                  tagInput={tagInput}
                  setTagInput={setTagInput}
                  parseTagInput={parseTagInput}
                  i18nSettings={i18nSettings}
                  onClose={() => setSettingsOpen(false)}
                  // For edit mode
                  mode={mode}
                  articleId={articleId}
                  translations={translations}
                  onRefresh={onRefresh}
                />
              }
            />
          </div>
        </div>

        {/* 主編輯區 */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Notion 風格標題 */}
            <NotionTitleInput
              value={formData.title}
              onChange={handleTitleChange}
              placeholder="無標題"
            />

            {/* 圖片設定區塊 */}
            <InlineImageSettings
              formData={formData}
              setFormData={setFormData}
            />

            {/* 摘要編輯區 */}
            <div className="mt-6 px-14">
              <textarea
                value={formData.summary}
                onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
                className="w-full p-4 text-sm text-gray-600 bg-gray-50/50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-purple-500/20 focus:border-brand-purple-300 focus:bg-white transition-all duration-200 resize-none leading-relaxed"
                rows={2}
                placeholder="在此輸入文章摘要（選填）..."
              />
            </div>

            {/* 編輯器 */}
            <div className="mt-4">
              {editorMode === 'article' ? (
                <TiptapEditor
                  content={formData.content}
                  onChange={(content) => setFormData(prev => ({ ...prev, content }))}
                />
              ) : (
                <div className="pl-14">
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full min-h-[400px] p-4 font-mono text-sm text-gray-800 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent resize-y"
                    placeholder="在此輸入 HTML 原始碼..."
                    spellCheck={false}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
  );

  if (embedded) {
    return editorContent;
  }

  return (
    <AdminLayout>
      {editorContent}
    </AdminLayout>
  );
}
