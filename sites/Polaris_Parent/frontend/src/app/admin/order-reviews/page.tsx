'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminCommerceApi } from '@/lib/api';
import type { AdminOrderSubmission } from '@/lib/api/admin-commerce';
import AdminLayout from '@/components/admin/AdminLayout';
import Button from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/utils';

const STATUSES = ['待審核', '通過', '退回'] as const;

const statusBadge = (status: string) => {
  const cfg: Record<string, { bg: string; text: string }> = {
    待審核: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    通過: { bg: 'bg-green-100', text: 'text-green-800' },
    退回: { bg: 'bg-red-100', text: 'text-red-800' },
  };
  const c = cfg[status] || cfg['待審核'];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {status}
    </span>
  );
};

export default function OrderReviewsPage() {
  const [status, setStatus] = useState<string>('待審核');
  const [rows, setRows] = useState<AdminOrderSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await adminCommerceApi.orderSubmissions(status);
      setRows(res.submissions || []);
    } catch (e: any) {
      setErr(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id: number) => {
    if (!confirm('確認通過此訂單並發出折扣碼？')) return;
    setBusyId(id);
    setErr('');
    try {
      const res = await adminCommerceApi.approveOrder(id);
      alert(`已通過，折扣碼：${res.coupon_code ?? '(已發過)'}`);
      await load();
    } catch (e: any) {
      setErr(e.message || '通過失敗');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: number) => {
    const note = prompt('退回原因（會顯示給會員）：');
    if (!note || !note.trim()) return;
    setBusyId(id);
    setErr('');
    try {
      await adminCommerceApi.rejectOrder(id, note.trim());
      await load();
    } catch (e: any) {
      setErr(e.message || '退回失敗');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">訂單審核</h1>
            <p className="text-gray-600">審核會員登錄的外部訂單號，通過後自動發出折扣碼。</p>
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple-500"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {err && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{err}</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              {status} 訂單
              <span className="text-sm font-normal text-gray-500 ml-2">共 {rows.length} 筆</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-20 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <p className="text-center py-12 text-gray-500">沒有 {status} 的訂單</p>
            ) : (
              <div className="space-y-3">
                {rows.map((r) => (
                  <div key={r.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 text-sm text-gray-700 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{r.product_name}</span>
                          {statusBadge(r.status)}
                          <span className="text-xs text-gray-400">#{r.id}</span>
                        </div>
                        <p>會員：{r.member_email || `app_user ${r.member_id}`}</p>
                        <p>平台：{r.platform}　訂單號：<span className="font-mono">{r.external_order_no}</span></p>
                        {r.chart_id && <p>命盤：<span className="font-mono">{r.chart_id}</span></p>}
                        {r.coupon_code && <p>已發折扣碼：<span className="font-mono text-green-700">{r.coupon_code}</span></p>}
                        {r.note && <p className="text-gray-500">備註：{r.note}</p>}
                        <p className="text-xs text-gray-400">提交於 {formatDateTime(r.created_at || '')}</p>
                      </div>
                      {r.status === '待審核' && (
                        <div className="flex flex-col gap-2">
                          <Button size="sm" onClick={() => approve(r.id)} disabled={busyId === r.id}>
                            通過
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => reject(r.id)} disabled={busyId === r.id}>
                            退回
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
