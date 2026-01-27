'use client';

import { useState, useEffect } from 'react';
import { contentApi } from '@/lib/api';
import { Content } from '@/types';
import AdminLayout from '@/components/admin/AdminLayout';
import Button from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Link from 'next/link';
import { formatDateTime } from '@/lib/utils';

export default function PostsPage() {
  const [posts, setPosts] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    type: 'all'
  });

  useEffect(() => {
    fetchPosts();
  }, [currentPage, filters]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        per_page: 20,
      };

      if (filters.status !== 'all') {
        params.status = filters.status;
      }

      if (filters.type !== 'all') {
        params.type = filters.type;
      }

      if (filters.search) {
        params.search = filters.search;
      }

      const response = await contentApi.getList(params);
      setPosts(response.contents);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('確定要刪除這篇內容嗎？此操作無法復原。')) {
      try {
        await contentApi.delete(id);
        alert('刪除成功！');
        fetchPosts();
      } catch (error: any) {
        console.error('Error deleting post:', error.message || error);

        // 提供更詳細的錯誤訊息
        const errorMessage = error.message || '刪除失敗';
        const statusCode = error.status;

        if (statusCode === 401) {
          alert('未授權：請重新登入');
        } else if (statusCode === 403) {
          alert('權限不足：您沒有權限刪除此內容');
        } else if (statusCode === 404) {
          alert('內容不存在：可能已被刪除');
          fetchPosts(); // 重新載入列表
        } else {
          alert(`刪除失敗：${errorMessage}`);
        }
      }
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchPosts();
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">內容管理</h1>
              <p className="text-gray-600">管理所有的文章和內容</p>
            </div>
            <Link href="/admin/articles/new">
              <Button>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                新增內容
              </Button>
            </Link>
          </div>

          {/* 搜尋和篩選 */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Input
                      placeholder="搜尋標題..."
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    />
                  </div>
                  <div>
                    <select
                      value={filters.status}
                      onChange={(e) => handleFilterChange('status', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent"
                    >
                      <option value="all">所有狀態</option>
                      <option value="published">已發布</option>
                      <option value="draft">草稿</option>
                    </select>
                  </div>
                  <div>
                    <select
                      value={filters.type}
                      onChange={(e) => handleFilterChange('type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent"
                    >
                      <option value="all">所有類型</option>
                      <option value="article">親紫專欄</option>
                    </select>
                  </div>
                  <div>
                    <Button type="submit" className="w-full">
                      搜尋
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* 內容列表 */}
        <Card>
          <CardHeader>
            <CardTitle>
              內容列表 
              {pagination && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  共 {pagination.total} 篇
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4 border border-gray-100 rounded-lg">
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                    </div>
                    <div className="flex space-x-2">
                      <div className="w-16 h-8 bg-gray-200 rounded animate-pulse"></div>
                      <div className="w-16 h-8 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : posts.length > 0 ? (
              <>
                <div className="space-y-4">
                  {posts.map((post) => (
                    <div key={post.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900 truncate">
                            {post.title}
                          </h3>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              post.status === 'published'
                                ? 'bg-green-100 text-green-800'
                                : post.status === 'draft'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {post.status === 'published' ? '已發布' : post.status === 'draft' ? '草稿' : post.status}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            親紫專欄
                          </span>
                        </div>
                        <div className="flex items-center text-sm text-gray-500 space-x-4">
                          <span>瀏覽：{post.views_count}</span>
                          <span>更新：{formatDateTime(post.updated_at)}</span>
                          {post.published_at && (
                            <span>發布：{formatDateTime(post.published_at)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <Link href={`/admin/editor/${post.id}`}>
                          <Button variant="outline" size="sm">
                            編輯
                          </Button>
                        </Link>
                        <Link href={`/posts/${post.slug}?preview=true`} target="_blank">
                          <Button variant="outline" size="sm">
                            預覽
                          </Button>
                        </Link>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(post.id)}
                        >
                          刪除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 分頁 */}
                {pagination && pagination.pages > 1 && (
                  <div className="flex justify-center items-center space-x-2 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={!pagination.has_prev}
                    >
                      上一頁
                    </Button>
                    
                    <span className="text-sm text-gray-600">
                      第 {pagination.page} 頁，共 {pagination.pages} 頁
                    </span>
                    
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={!pagination.has_next}
                    >
                      下一頁
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-4 text-sm font-medium text-gray-900">沒有找到內容</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {filters.search || filters.status !== 'all' || filters.type !== 'all' 
                    ? '請調整搜尋條件或篩選器' 
                    : '開始創建您的第一篇內容'}
                </p>
                {(!filters.search && filters.status === 'all' && filters.type === 'all') && (
                  <div className="mt-6">
                    <Link href="/admin/editor">
                      <Button>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        新增內容
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}