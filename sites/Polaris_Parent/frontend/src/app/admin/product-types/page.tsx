'use client';

import { useState, useEffect } from 'react';
import { adminCommerceApi } from '@/lib/api';
import type { ExternalProduct } from '@/lib/api/membership';
import { AdminLayout } from '@ows/admin-app';
import Button from '@/components/platform/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/platform/ui/Card';

const EMPTY: Partial<ExternalProduct> = { name: '', platform: '蝦皮', external_url: '', active: true };

export default function ProductTypesPage() {
  const [rows, setRows] = useState<ExternalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<ExternalProduct> | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await adminCommerceApi.productTypes();
      setRows(res.products || []);
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
    if (!editing.name?.trim()) {
      setErr('商品名稱必填');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const body = {
        name: editing.name?.trim(),
        platform: editing.platform?.trim() || null,
        external_url: editing.external_url?.trim() || null,
        active: editing.active ?? true,
      };
      if (editing.id) {
        await adminCommerceApi.updateProductType(editing.id, body);
      } else {
        await adminCommerceApi.createProductType(body);
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      setErr(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('確認刪除此商品？（若已有訂單引用會改為下架）')) return;
    try {
      const res = await adminCommerceApi.deleteProductType(id);
      if (res.message) alert(res.message);
      await load();
    } catch (e: any) {
      setErr(e.message || '刪除失敗');
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">外部商品</h1>
            <p className="text-gray-600">維護導流到蝦皮 / Pinkoi 的商品連結（會員「為這張盤下單」用）。</p>
          </div>
          <Button onClick={() => setEditing({ ...EMPTY })}>新增商品</Button>
        </div>

        {err && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{err}</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>商品列表<span className="text-sm font-normal text-gray-500 ml-2">共 {rows.length} 項</span></CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />)}</div>
            ) : rows.length === 0 ? (
              <p className="text-center py-12 text-gray-500">尚無商品</p>
            ) : (
              <div className="space-y-3">
                {rows.map((p) => (
                  <div key={p.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center gap-4">
                    <div className="text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{p.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{p.platform || '—'}</span>
                        {!p.active && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">已下架</span>}
                      </div>
                      {p.external_url && (
                        <a href={p.external_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline break-all">
                          {p.external_url}
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(p)}>編輯</Button>
                      <Button size="sm" variant="outline" onClick={() => remove(p.id)}>刪除</Button>
                    </div>
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
              <h3 className="text-lg font-medium text-gray-900">{editing.id ? '編輯商品' : '新增商品'}</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">商品名稱 *</label>
                <input
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="例：分析報告 / 祝福命理書 / 真人解讀"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">平台</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">商品連結</label>
                <input
                  value={editing.external_url || ''}
                  onChange={(e) => setEditing({ ...editing, external_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="https://shopee.tw/..."
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={editing.active ?? true}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                上架（會員可見並可下單）
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
