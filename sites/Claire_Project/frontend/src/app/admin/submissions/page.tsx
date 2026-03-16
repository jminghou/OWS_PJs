'use client';

import { useState, useEffect } from 'react';
import { submissionApi } from '@/lib/api';
import AdminLayout from '@/components/admin/AdminLayout';
import Button from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/utils';

interface Submission {
  id: number;
  character_name: string;
  birth_year: string;
  birth_month: string;
  birth_day: string;
  birth_time: string;
  birth_place: string;
  question: string;
  status: 'pending' | 'reviewed' | 'answered';
  admin_notes: string;
  created_at: string;
  updated_at: string;
}

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchSubmissions();
  }, [currentPage, statusFilter]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        per_page: 20,
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const response = await submissionApi.getList(params);
      setSubmissions(response.submissions);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (submissionId: number, newStatus: string) => {
    try {
      setUpdating(true);
      await submissionApi.update(submissionId, { status: newStatus });
      fetchSubmissions();
      if (selectedSubmission?.id === submissionId) {
        setSelectedSubmission(prev => prev ? { ...prev, status: newStatus as any } : null);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('更新狀態失敗，請稍後再試');
    } finally {
      setUpdating(false);
    }
  };

  const handleNotesUpdate = async () => {
    if (!selectedSubmission) return;

    try {
      setUpdating(true);
      await submissionApi.update(selectedSubmission.id, { admin_notes: adminNotes });
      
      // 更新本地狀態
      setSubmissions(prev => 
        prev.map(sub => 
          sub.id === selectedSubmission.id 
            ? { ...sub, admin_notes: adminNotes }
            : sub
        )
      );
      setSelectedSubmission(prev => prev ? { ...prev, admin_notes: adminNotes } : null);
      
      alert('備註更新成功');
    } catch (error) {
      console.error('Error updating notes:', error);
      alert('更新備註失敗，請稍後再試');
    } finally {
      setUpdating(false);
    }
  };

  const openSubmissionDetail = (submission: Submission) => {
    setSelectedSubmission(submission);
    setAdminNotes(submission.admin_notes || '');
  };

  const closeSubmissionDetail = () => {
    setSelectedSubmission(null);
    setAdminNotes('');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '待處理' },
      reviewed: { bg: 'bg-blue-100', text: 'text-blue-800', label: '已查看' },
      answered: { bg: 'bg-green-100', text: 'text-green-800', label: '已回覆' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const formatBirthInfo = (submission: Submission) => {
    const parts = [];
    if (submission.birth_year) parts.push(`${submission.birth_year}年`);
    if (submission.birth_month) parts.push(`${submission.birth_month}月`);
    if (submission.birth_day) parts.push(`${submission.birth_day}日`);
    if (submission.birth_time) parts.push(submission.birth_time);
    return parts.join('');
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">匿名提問管理</h1>
              <p className="text-gray-600">管理來自網站訪客的匿名提問</p>
            </div>
          </div>

          {/* 篩選器 */}
          <div className="flex space-x-4">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent"
            >
              <option value="all">所有狀態</option>
              <option value="pending">待處理</option>
              <option value="reviewed">已查看</option>
              <option value="answered">已回覆</option>
            </select>
          </div>
        </div>

        {/* 提問列表 */}
        <Card>
          <CardHeader>
            <CardTitle>
              提問列表
              {pagination && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  共 {pagination.total} 個提問
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="h-24 bg-gray-200 rounded animate-pulse"></div>
                ))}
              </div>
            ) : submissions.length > 0 ? (
              <>
                <div className="space-y-4">
                  {submissions.map((submission) => (
                    <div key={submission.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium text-gray-900">
                              {submission.character_name || '未提供稱呼'}
                            </h3>
                            {getStatusBadge(submission.status)}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                            <div>
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">出生資訊：</span>
                                {formatBirthInfo(submission) || '未提供'}
                              </p>
                              {submission.birth_place && (
                                <p className="text-sm text-gray-600">
                                  <span className="font-medium">出生地：</span>
                                  {submission.birth_place}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">提交時間：</span>
                                {formatDateTime(submission.created_at)}
                              </p>
                            </div>
                          </div>

                          <div className="mb-3">
                            <p className="text-sm text-gray-600 mb-1">
                              <span className="font-medium">提問內容：</span>
                            </p>
                            <p className="text-sm text-gray-800 bg-gray-50 p-2 rounded">
                              {submission.question || '未提供問題內容'}
                            </p>
                          </div>

                          {submission.admin_notes && (
                            <div className="mb-3">
                              <p className="text-sm text-gray-600 mb-1">
                                <span className="font-medium">管理員備註：</span>
                              </p>
                              <p className="text-sm text-blue-800 bg-blue-50 p-2 rounded">
                                {submission.admin_notes}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col space-y-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSubmissionDetail(submission)}
                          >
                            詳細
                          </Button>
                          
                          <select
                            value={submission.status}
                            onChange={(e) => handleStatusChange(submission.id, e.target.value)}
                            disabled={updating}
                            className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-brand-purple-500"
                          >
                            <option value="pending">待處理</option>
                            <option value="reviewed">已查看</option>
                            <option value="answered">已回覆</option>
                          </select>
                        </div>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-4 text-sm font-medium text-gray-900">沒有找到提問</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {statusFilter !== 'all' ? '請調整篩選條件' : '還沒有訪客提問'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 提問詳細彈窗 */}
        {selectedSubmission && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={closeSubmissionDetail}></div>

              <div className="inline-block w-full max-w-2xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
                <div className="bg-white px-6 py-4 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">
                      提問詳細 #{selectedSubmission.id}
                    </h3>
                    <button onClick={closeSubmissionDetail} className="text-gray-400 hover:text-gray-600">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">稱呼</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedSubmission.character_name || '未提供'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">出生資訊</label>
                      <p className="mt-1 text-sm text-gray-900">{formatBirthInfo(selectedSubmission) || '未提供'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">出生地</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedSubmission.birth_place || '未提供'}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">提問內容</label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-900">{selectedSubmission.question || '未提供問題內容'}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">狀態</label>
                    <div className="mt-1">
                      {getStatusBadge(selectedSubmission.status)}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">管理員備註</label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent"
                      placeholder="添加管理員備註..."
                    />
                  </div>
                </div>

                <div className="bg-gray-50 px-6 py-3 flex justify-end space-x-2">
                  <Button variant="outline" onClick={closeSubmissionDetail}>
                    關閉
                  </Button>
                  <Button onClick={handleNotesUpdate} disabled={updating}>
                    {updating ? '更新中...' : '更新備註'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}