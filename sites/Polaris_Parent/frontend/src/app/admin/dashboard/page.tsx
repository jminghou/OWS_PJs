'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { contentApi } from '@/lib/api';
import { Content } from '@/types';
import AdminLayout from '@/components/admin/AdminLayout';
import Button from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Link from 'next/link';
import { formatDateTime, truncateText } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    draft: 0,
    views: 0,
  });

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);

      // 獲取最近的內容（已發布）
      const recentResponse = await contentApi.getList({
        per_page: 10,
        page: 1,
      });

      setPosts(recentResponse.contents);

      // 獲取全部統計數據 - 分別請求不同狀態
      const [publishedResponse, draftResponse] = await Promise.all([
        contentApi.getList({ status: 'published', per_page: 100 }),
        contentApi.getList({ status: 'draft', per_page: 100 })
      ]);

      const allContents = [...publishedResponse.contents, ...draftResponse.contents];
      const totalViews = allContents.reduce((sum, p) => sum + p.views_count, 0);

      setStats({
        total: publishedResponse.pagination.total + draftResponse.pagination.total,
        published: publishedResponse.pagination.total,
        draft: draftResponse.pagination.total,
        views: totalViews,
      });
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

        // 根據不同錯誤碼顯示不同訊息
        const errorMessage = error.message || '刪除失敗';
        const statusCode = error.status;

        if (statusCode === 401) {
          alert('未授權：請重新登入');
        } else if (statusCode === 403) {
          alert('權限不足：您沒有權限刪除此內容');
        } else if (statusCode === 404) {
          alert('內容不存在：可能已被刪除');
          fetchPosts();
        } else {
          alert(`刪除失敗：${errorMessage}`);
        }
      }
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            歡迎回來，{user?.username}！
          </h1>
          <p className="text-gray-600">
            這裡是您的管理儀表板，可以查看最近的內容和網站統計
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
                  <p className="text-sm text-gray-600">總文章數</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100 text-green-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-semibold text-gray-900">{stats.published}</p>
                  <p className="text-sm text-gray-600">已發布</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-semibold text-gray-900">{stats.draft}</p>
                  <p className="text-sm text-gray-600">草稿</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-semibold text-gray-900">{stats.views}</p>
                  <p className="text-sm text-gray-600">總瀏覽數</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>最近的內容</CardTitle>
            <Link href="/admin/articles/new">
              <Button size="sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                新增內容
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
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
                        <span>{formatDateTime(post.updated_at)}</span>
                        {post.author && <span>作者：{post.author.username}</span>}
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <Link href={`/admin/editor/${post.id}`}>
                        <Button variant="outline" size="sm">
                          編輯
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
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">還沒有任何內容</p>
                <Link href="/admin/articles/new">
                  <Button>開始創建第一篇內容</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}