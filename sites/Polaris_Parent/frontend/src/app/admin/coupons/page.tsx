'use client';

import { useState, useEffect } from 'react';
import { adminCommerceApi } from '@/lib/api';
import type { CouponConfig } from '@/lib/api/admin-commerce';
import AdminLayout from '@/components/platform/admin/AdminLayout';
import Button from '@/components/platform/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/platform/ui/Card';
import { formatDateTime } from '@/lib/utils';

const EMPTY: Partial<CouponConfig> = {
  code: '', platform: '蝦皮', discount_desc: '', valid_from: null, valid_to: null, active: true,
};

export default function CouponsPage() {
  const [rows, setRows] = useState<CouponConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<CouponConfig> | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await adminCommerceApi.couponConfigs();
      setRows(res.coupons || []);
    } catch (e: any) {
      setErr(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.code?.trim() || !editing.platform?.trim()) {
      setErr('折扣碼與平台必填');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const body = {
        code: editing.code?.trim(),
        platform: editing.platform?.trim(),
        discount_desc: editing.discount_desc?.trim() || null,
        valid_from: editing.valid_from || null,
        valid_to: editing.valid_to || null,
        active: editing.active ?? true,
      };
      if (editing.id) {
        await adminCommerceApi.updateCouponConfig(editing.id, body);
      } else {
        await adminCommerceApi.createCouponConfig(body);
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      setErr(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">折扣碼設定</h1>
            <p className="text-gray-600">
              設定目前有效的共用折扣碼；同平台設為「啟用」時會自動停用其他碼（保持單一有效碼）。
            </p>
          </div>
          <Button onClick={() => setEditing({ ...EMPTY })}>新增折扣碼</Button>
        </div>

        {err && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{err}</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>折扣碼列表<span className="text-sm font-normal text-gray-500 ml-2">共 {rows.length} 筆</span></CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />)}</div>
            ) : rows.length === 0 ? (
              <p className="text-center py-12 text-gray-500">尚無折扣碼</p>
            ) : (
              <div className="space-y-3">
                {rows.map((c) => (
                  <div key={c.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center gap-4">
                    <div className="text-sm text-gray-700 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-gray-900">{c.code}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c.platform || '—'}</span>
                        {c.active
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">啟用中</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">停用</span>}
                      </div>
                      {c.discount_desc && <p>{c.discount_desc}</p>}
                      {(c.valid_from || c.valid_to) && (
                        <p className="text-xs text-gray-400">
                          效期：{c.valid_from ? formatDateTime(c.valid_from) : '—'} ~ {c.valid_to ? formatDateTime(c.valid_to) : '—'}
                        </p>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setEditing(c)}>編輯</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setEditing(null)} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
              <h3 className="text-lg font-medium text-gray-900">{editing.id ? '編輯折扣碼' : '新增折扣碼'}</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">折扣碼 *</label>
                <input
                  value={editing.code || ''}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                  placeholder="平台後台建立的共用碼"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">平台 *</label>
                <select
                  value={editing.platform || ''}
                  onChange={(e) => setEditing({ ...editing, platform: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="蝦皮">蝦皮</option>
                  <option value="Pinkoi">Pinkoi</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">折扣說明</label>
                <input
                  value={editing.discount_desc || ''}
                  onChange={(e) => setEditing({ ...editing, discount_desc: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="例：8折"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">生效</label>
                  <input
                    type="datetime-local"
                    value={editing.valid_from ? String(editing.valid_from).slice(0, 16) : ''}
                    onChange={(e) => setEditing({ ...editing, valid_from: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">截止</label>
                  <input
                    type="datetime-local"
                    value={editing.valid_to ? String(editing.valid_to).slice(0, 16) : ''}
                    onChange={(e) => setEditing({ ...editing, valid_to: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={editing.active ?? true}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                設為目前有效碼（會停用同平台其他碼）
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
                <Button onClick={save} disabled={saving}>{saving ? '儲存中…' : '儲存'}</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
